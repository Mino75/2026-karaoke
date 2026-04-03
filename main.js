(() => {
  const DB_NAME = "karaoke_lyrics_db";
  const DB_VERSION = 1;
  const STORE_NAME = "lyrics";

  const PLAYER_ORIGIN = "https://shenyin.kahiether.com";
  const MESSAGE_TYPE_TRACK_CHANGE = "karaoke-track-change";
  const MESSAGE_TYPE_PLAYBACK_STATE = "karaoke-playback-state";

  const els = {
    mediaMeta: document.getElementById("mediaMeta"),
    title: document.getElementById("title"),
    duration: document.getElementById("duration"),
    status: document.getElementById("status"),
    lyricsViewport: document.getElementById("lyricsViewport"),
    lyricsContent: document.getElementById("lyricsContent"),
    lyricsEditor: document.getElementById("lyricsEditor"),
    editToggleBtn: document.getElementById("editToggleBtn"),
    resetScrollBtn: document.getElementById("resetScrollBtn"),
  };

  const state = {
    db: null,
    currentRecord: null,
    isEditing: false,
    scrollRAF: null,
    scrollStartMs: 0,
    scrollDurationMs: 0,
    scrollTo: 0,
    lastMediaKey: null,
    currentTime: 0,
    duration: 0,
    playbackState: "paused",
  };

  // -----------------------------
  // IndexedDB
  // -----------------------------
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "mediaKey" });
          store.createIndex("title", "title", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txStore(mode = "readonly") {
    const tx = state.db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  function getRecord(mediaKey) {
    return new Promise((resolve, reject) => {
      const req = txStore("readonly").get(mediaKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function putRecord(record) {
    return new Promise((resolve, reject) => {
      const req = txStore("readwrite").put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  function normalizeTitle(title) {
    return (title || "unknown title")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function buildMediaKeyFromPayload(title, duration) {
    return `${normalizeTitle(title)}::${Math.round(duration || 0)}`;
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function setStatus(text, mode = "") {
    els.status.textContent = text || "idle";
    els.status.className = `status ${mode}`.trim();
  }

  function setMetaUI(title, durationSec) {
    els.title.textContent = title || "Unknown title";
    els.duration.textContent = formatTime(durationSec);
    els.mediaMeta.textContent = `${title || "Unknown title"} • ${formatTime(durationSec)}`;
  }

  function renderLyrics(text) {
    const nextText = text || "";
    els.lyricsContent.textContent = nextText;
    els.lyricsEditor.value = nextText;
  }

  // -----------------------------
  // Scroll engine
  // -----------------------------
  function cancelAutoScroll() {
    if (state.scrollRAF) {
      cancelAnimationFrame(state.scrollRAF);
      state.scrollRAF = null;
    }
  }

  function applyScroll(y) {
    els.lyricsContent.style.transform = `translateY(${-y}px)`;
  }

  function computeExternalScrollPlan() {
    const viewport = els.lyricsViewport;
    const content = els.lyricsContent;
    const durationSec = Math.max(0, Math.round(state.duration || 0));

    if (!viewport || !content) return null;

    const maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);

    if (!maxScroll || durationSec <= 0) {
      return {
        to: 0,
        durationMs: 0,
      };
    }

    return {
      to: maxScroll,
      durationMs: durationSec * 1000,
    };
  }

  function restartAutoScrollFromExternalState() {
    cancelAutoScroll();

    if (state.isEditing) return;

    const plan = computeExternalScrollPlan();
    if (!plan) return;

    state.scrollTo = plan.to;
    state.scrollDurationMs = plan.durationMs;

    if (plan.durationMs <= 0 || plan.to <= 0) {
      applyScroll(0);
      return;
    }

    const currentMs = Math.min(
      Math.max(0, Math.round(state.currentTime || 0)) * 1000,
      plan.durationMs
    );

    const initialProgress = currentMs / plan.durationMs;
    const initialY = plan.to * initialProgress;

    applyScroll(initialY);
    state.scrollStartMs = performance.now() - currentMs;

    if (state.playbackState !== "playing") return;

    const tick = (now) => {
      if (state.isEditing || state.playbackState !== "playing") {
        state.scrollRAF = null;
        return;
      }

      const elapsed = Math.min(now - state.scrollStartMs, state.scrollDurationMs);
      const progress = state.scrollDurationMs > 0 ? elapsed / state.scrollDurationMs : 0;
      const y = state.scrollTo * progress;

      applyScroll(y);

      if (elapsed < state.scrollDurationMs) {
        state.scrollRAF = requestAnimationFrame(tick);
      } else {
        state.scrollRAF = null;
      }
    };

    state.scrollRAF = requestAnimationFrame(tick);
  }

  // -----------------------------
  // Edit mode
  // -----------------------------
  function setEditMode(enabled) {
    state.isEditing = enabled;

    els.lyricsViewport.classList.toggle("hidden", enabled);
    els.lyricsEditor.classList.toggle("hidden", !enabled);

    if (enabled) {
      cancelAutoScroll();
      els.editToggleBtn.textContent = "Save";
      els.editToggleBtn.setAttribute("aria-label", "Save lyrics");
      els.lyricsEditor.focus();
      return;
    }

    els.editToggleBtn.textContent = "✍️";
    els.editToggleBtn.setAttribute("aria-label", "Edit lyrics");
    renderLyrics(els.lyricsEditor.value);

    requestAnimationFrame(() => {
      restartAutoScrollFromExternalState();
    });
  }

  async function saveCurrentLyrics() {
    if (!state.currentRecord) return;

    const nextText = els.lyricsEditor.value || "";
    state.currentRecord.lyrics = nextText;
    state.currentRecord.updatedAt = Date.now();

    await putRecord(state.currentRecord);
    renderLyrics(nextText);

    requestAnimationFrame(() => {
      restartAutoScrollFromExternalState();
    });
  }

  // -----------------------------
  // Incoming player messages
  // -----------------------------
  async function loadLyricsFromIncomingTrack(payload) {
    const title = payload?.title || "Untitled";
    const durationSec = Math.round(payload?.duration || 0);
    const currentTime = Math.round(payload?.currentTime || 0);
    const playbackState = payload?.state || "paused";

    if (!title || durationSec <= 0) return;

    const mediaKey = buildMediaKeyFromPayload(title, durationSec);

    state.currentTime = currentTime;
    state.duration = durationSec;
    state.playbackState = playbackState;

    if (state.lastMediaKey === mediaKey) {
      setMetaUI(title, durationSec);
      setStatus(
        playbackState,
        playbackState === "playing" ? "playing" : playbackState === "paused" ? "paused" : ""
      );

      if (!state.isEditing) {
        requestAnimationFrame(() => {
          restartAutoScrollFromExternalState();
        });
      }
      return;
    }

    state.lastMediaKey = mediaKey;

    let record = await getRecord(mediaKey);

    if (!record) {
      record = {
        mediaKey,
        title,
        durationSec,
        lyrics: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await putRecord(record);
    }

    state.currentRecord = record;

    setMetaUI(title, durationSec);
    setStatus(
      playbackState,
      playbackState === "playing" ? "playing" : playbackState === "paused" ? "paused" : ""
    );
    renderLyrics(record.lyrics || "");

    if (!state.isEditing) {
      requestAnimationFrame(() => {
        restartAutoScrollFromExternalState();
      });
    }
  }

  function handlePlaybackStateMessage(payload) {
    state.currentTime = Math.round(payload?.currentTime || 0);
    state.duration = Math.round(payload?.duration || state.duration || 0);
    state.playbackState = payload?.state || "paused";

    setStatus(
      state.playbackState,
      state.playbackState === "playing" ? "playing" : state.playbackState === "paused" ? "paused" : ""
    );

    if (!state.isEditing) {
      restartAutoScrollFromExternalState();
    }
  }

  function bindPlayerMessages() {
    window.addEventListener("message", async (event) => {
      if (event.origin !== PLAYER_ORIGIN) return;

      const data = event.data;
      if (!data || !data.type || !data.payload) return;

      if (data.type === MESSAGE_TYPE_TRACK_CHANGE) {
        await loadLyricsFromIncomingTrack(data.payload);
        return;
      }

      if (data.type === MESSAGE_TYPE_PLAYBACK_STATE) {
        handlePlaybackStateMessage(data.payload);
      }
    });
  }

  // -----------------------------
  // UI events
  // -----------------------------
  function bindUi() {
    els.editToggleBtn.addEventListener("click", async () => {
      if (!state.currentRecord) return;

      if (!state.isEditing) {
        setEditMode(true);
      } else {
        await saveCurrentLyrics();
        setEditMode(false);
      }
    });

    els.resetScrollBtn.addEventListener("click", () => {
      restartAutoScrollFromExternalState();
    });

    els.lyricsEditor.addEventListener("input", () => {
      els.lyricsContent.textContent = els.lyricsEditor.value;

      requestAnimationFrame(() => {
        if (state.isEditing) {
          computeExternalScrollPlan();
        }
      });
    });
  }

  // -----------------------------
  // Bootstrap
  // -----------------------------
  async function init() {
    state.db = await openDb();
    bindUi();
    bindPlayerMessages();
    setStatus("idle");
    setMetaUI("Waiting for track…", 0);
    renderLyrics("");
  }

  init().catch((err) => {
    console.error(err);
    setStatus("error");
    els.mediaMeta.textContent = "Initialization failed";
  });
})();
