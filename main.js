(() => {
  const DB_NAME = "karaoke_lyrics_db";
  const DB_VERSION = 1;
  const STORE_NAME = "lyrics";

  const PLAYER_ORIGIN = "https://shenyin.kahiether.com";
  const MESSAGE_TYPE_TRACK_CHANGE = "karaoke-track-change";
  const MESSAGE_TYPE_PLAYBACK_STATE = "karaoke-playback-state";

  const FONT_STORAGE_KEY = "karaoke_lyrics_font_size";
  const DEFAULT_FONT_SIZE = 1.35;
  const MIN_FONT_SIZE = 1.0;
  const MAX_FONT_SIZE = 2.4;
  const FONT_STEP = 0.12;

  const USER_SCROLL_PAUSE_MS = 4000;

  const els = {
    mediaMeta: document.getElementById("mediaMeta"),
    title: document.getElementById("title"),
    duration: document.getElementById("duration"),
    status: document.getElementById("status"),
    lyricsViewport: document.getElementById("lyricsViewport"),
    lyricsContent: document.getElementById("lyricsContent"),
    lyricsEditor: document.getElementById("lyricsEditor"),
    editToggleBtn: document.getElementById("editToggleBtn"),
    autoScrollToggleBtn: document.getElementById("autoScrollToggleBtn"),
    fontDecreaseBtn: document.getElementById("fontDecreaseBtn"),
    fontIncreaseBtn: document.getElementById("fontIncreaseBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFileInput: document.getElementById("importFileInput"),
  };

  const state = {
    db: null,
    currentRecord: null,
    isEditing: false,
    scrollRAF: null,
    lastMediaKey: null,
    currentTime: 0,
    duration: 0,
    playbackState: "paused",
    fontSize: DEFAULT_FONT_SIZE,
    isUserInteractingScroll: false,
    userScrollPauseUntil: 0,
    autoScrollEnabled: true,
    suppressScrollEvent: false,
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

  function getAllRecords() {
    return new Promise((resolve, reject) => {
      const req = txStore("readonly").getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
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
  function updateAutoScrollUi() {
  els.autoScrollToggleBtn.textContent = state.autoScrollEnabled
    ? "Auto-scroll: ON"
    : "Auto-scroll: OFF";

  els.autoScrollToggleBtn.setAttribute(
    "aria-pressed",
    String(state.autoScrollEnabled)
  );
}

function setAutoScrollEnabled(enabled) {
  state.autoScrollEnabled = Boolean(enabled);
  updateAutoScrollUi();

  if (!state.autoScrollEnabled) {
    cancelAutoScroll();
    return;
  }

  syncScrollToPlayback();
}
  
  
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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function downloadTextFile(filename, text, mimeType = "application/json") {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  function sanitizeImportedRecord(item) {
    if (!item || typeof item !== "object") return null;

    const title = String(item.title || "").trim();
    const durationSec = Math.round(
      Number(
        item.durationSec ??
        item.duration ??
        0
      )
    );

    if (!title || durationSec <= 0) return null;

    const mediaKey = buildMediaKeyFromPayload(title, durationSec);
    const now = Date.now();

    return {
      mediaKey,
      title,
      durationSec,
      lyrics: String(item.lyrics || ""),
      createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : now,
      updatedAt: now,
    };
  }

  async function exportLyricsDatabase() {
    const records = await getAllRecords();

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      total: records.length,
      records: records.map((record) => ({
        title: record.title || "",
        durationSec: Math.round(record.durationSec || 0),
        lyrics: record.lyrics || "",
        createdAt: record.createdAt || Date.now(),
        updatedAt: record.updatedAt || Date.now(),
      })),
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadTextFile(`karaoke-lyrics-export-${stamp}.json`, JSON.stringify(payload, null, 2));
    setStatus(`exported ${records.length} record(s)`, "success");
  }

  async function importLyricsDatabaseFromFile(file) {
    if (!file) return;

    const text = await file.text();
    const parsed = JSON.parse(text);

    const incomingRecords = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
      ? parsed.records
      : [];

    let importedCount = 0;

    for (const item of incomingRecords) {
      const normalized = sanitizeImportedRecord(item);
      if (!normalized) continue;

      // overwrite if same title + duration combination already exists
      await putRecord(normalized);
      importedCount += 1;
    }

    setStatus(`imported ${importedCount} record(s)`, "success");

    // refresh current UI if imported record matches current track
    if (state.lastMediaKey) {
      const fresh = await getRecord(state.lastMediaKey);
      if (fresh) {
        state.currentRecord = fresh;
        renderLyrics(fresh.lyrics || "");

        if (!state.isEditing) {
          requestAnimationFrame(() => {
            restartAutoScrollFromExternalState(true);
          });
        }
      }
    }
  }


  
  // -----------------------------
  // Font size management
  // -----------------------------
  function loadFontSize() {
    const raw = localStorage.getItem(FONT_STORAGE_KEY);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_FONT_SIZE;
    return clamp(parsed, MIN_FONT_SIZE, MAX_FONT_SIZE);
  }

  function applyFontSize(size) {
    state.fontSize = clamp(size, MIN_FONT_SIZE, MAX_FONT_SIZE);
    document.documentElement.style.setProperty("--lyrics-font-size", `${state.fontSize}rem`);
    localStorage.setItem(FONT_STORAGE_KEY, String(state.fontSize));

    els.fontDecreaseBtn.disabled = state.fontSize <= MIN_FONT_SIZE;
    els.fontIncreaseBtn.disabled = state.fontSize >= MAX_FONT_SIZE;

    requestAnimationFrame(() => {
      syncScrollToPlayback();
    });
  }

  // -----------------------------
  // Scroll engine using native scrollTop
  // -----------------------------
  function cancelAutoScroll() {
    if (state.scrollRAF) {
      cancelAnimationFrame(state.scrollRAF);
      state.scrollRAF = null;
    }
  }

  function getMaxScroll() {
    const viewport = els.lyricsViewport;
    return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  }

  function setViewportScroll(y) {
    const viewport = els.lyricsViewport;
    const maxScroll = getMaxScroll();
    const nextY = clamp(y, 0, maxScroll);

    state.suppressScrollEvent = true;
    viewport.scrollTop = nextY;
    requestAnimationFrame(() => {
      state.suppressScrollEvent = false;
    });
  }

  function computeTargetScrollFromPlayback() {
    const durationSec = Math.max(0, state.duration || 0);
    const currentTimeSec = clamp(state.currentTime || 0, 0, durationSec);
    const maxScroll = getMaxScroll();

    if (durationSec <= 0 || maxScroll <= 0) return 0;

    const progress = currentTimeSec / durationSec;
    return maxScroll * progress;
  }

  function shouldPauseForManualScroll() {
    return Date.now() < state.userScrollPauseUntil;
  }

function syncScrollToPlayback() {
  cancelAutoScroll();

  if (state.isEditing) return;
  if (!state.autoScrollEnabled) return;

  const targetY = computeTargetScrollFromPlayback();
  setViewportScroll(targetY);

  if (state.playbackState !== "playing") return;
  if (shouldPauseForManualScroll()) return;

  const tick = () => {
    if (state.isEditing || state.playbackState !== "playing") {
      state.scrollRAF = null;
      return;
    }

    if (!state.autoScrollEnabled) {
      state.scrollRAF = null;
      return;
    }

    if (shouldPauseForManualScroll()) {
      state.scrollRAF = null;
      return;
    }

    const target = computeTargetScrollFromPlayback();
    const current = els.lyricsViewport.scrollTop;
    const delta = target - current;
    const next = Math.abs(delta) < 1 ? target : current + delta * 0.08;

    setViewportScroll(next);
    state.scrollRAF = requestAnimationFrame(tick);
  };

  state.scrollRAF = requestAnimationFrame(tick);
}

function restartAutoScrollFromExternalState(force = false) {
  if (force) {
    state.userScrollPauseUntil = 0;
  }

  if (!state.autoScrollEnabled) {
    cancelAutoScroll();
    return;
  }

  syncScrollToPlayback();
}

  function registerManualScrollIntent() {
    if (state.suppressScrollEvent || state.isEditing) return;
    state.userScrollPauseUntil = Date.now() + USER_SCROLL_PAUSE_MS;
    cancelAutoScroll();
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
      restartAutoScrollFromExternalState(true);
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
      restartAutoScrollFromExternalState(true);
    });
  }

  // -----------------------------
  // Incoming player messages
  // -----------------------------
  async function loadLyricsFromIncomingTrack(payload) {
    const title = payload?.title || "Untitled";
    const durationSec = Math.round(payload?.duration || 0);
    const currentTime = Number(payload?.currentTime || 0);
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
    state.userScrollPauseUntil = 0;

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
        restartAutoScrollFromExternalState(true);
      });
    }
  }

  function handlePlaybackStateMessage(payload) {
    state.currentTime = Number(payload?.currentTime || 0);
    state.duration = Math.round(payload?.duration || state.duration || 0);
    state.playbackState = payload?.state || "paused";

    setStatus(
      state.playbackState,
      state.playbackState === "playing" ? "playing" : state.playbackState === "paused" ? "paused" : ""
    );

    if (!state.isEditing) {
      syncScrollToPlayback();
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

    els.exportBtn?.addEventListener("click", async () => {
      try {
        await exportLyricsDatabase();
      } catch (err) {
        console.error(err);
        setStatus("export failed", "error");
      }
    });

    els.importBtn?.addEventListener("click", () => {
      if (!els.importFileInput) return;
      els.importFileInput.value = "";
      els.importFileInput.click();
    });

    els.importFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await importLyricsDatabaseFromFile(file);
      } catch (err) {
        console.error(err);
        setStatus("import failed", "error");
      }
    });

    
  els.autoScrollToggleBtn.addEventListener("click", () => {
    setAutoScrollEnabled(!state.autoScrollEnabled);
  });

    els.fontDecreaseBtn.addEventListener("click", () => {
      applyFontSize(state.fontSize - FONT_STEP);
    });

    els.fontIncreaseBtn.addEventListener("click", () => {
      applyFontSize(state.fontSize + FONT_STEP);
    });

    els.lyricsEditor.addEventListener("input", () => {
      els.lyricsContent.textContent = els.lyricsEditor.value;
    });

    els.lyricsViewport.addEventListener("wheel", registerManualScrollIntent, { passive: true });
    els.lyricsViewport.addEventListener("touchstart", registerManualScrollIntent, { passive: true });
    els.lyricsViewport.addEventListener("touchmove", registerManualScrollIntent, { passive: true });
    els.lyricsViewport.addEventListener("pointerdown", registerManualScrollIntent, { passive: true });
    els.lyricsViewport.addEventListener("scroll", () => {
      if (!state.suppressScrollEvent) {
        registerManualScrollIntent();
      }
    });

    window.addEventListener("resize", () => {
      syncScrollToPlayback();
    });
  }

  // -----------------------------
  // Bootstrap
  // -----------------------------
  async function init() {
    state.db = await openDb();
    state.fontSize = loadFontSize();
    applyFontSize(state.fontSize);

    bindUi();
    bindPlayerMessages();
    updateAutoScrollUi();
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
