(() => {
  const DB_NAME = "karaoke_lyrics_db";
  const DB_VERSION = 1;
  const STORE_NAME = "lyrics";

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
    currentMediaEl: null,
    currentRecord: null,
    isEditing: false,
    scrollRAF: null,
    scrollStartMs: 0,
    scrollDurationMs: 0,
    scrollFrom: 0,
    scrollTo: 0,
    lastMediaKey: null,
    mutationObserver: null,
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

  function safeDurationSeconds(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value);
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function getPublishedMediaTitle() {
    const mediaSessionTitle =
      navigator.mediaSession &&
      navigator.mediaSession.metadata &&
      typeof navigator.mediaSession.metadata.title === "string"
        ? navigator.mediaSession.metadata.title
        : "";

    return mediaSessionTitle || document.title || "Unknown title";
  }

  function buildMediaIdentity(mediaEl) {
    const title = getPublishedMediaTitle();
    const durationSec = safeDurationSeconds(mediaEl?.duration || 0);
    const mediaKey = `${normalizeTitle(title)}::${durationSec}`;

    return {
      title,
      durationSec,
      mediaKey,
    };
  }

  function setStatus(text, mode = "") {
    els.status.textContent = text;
    els.status.className = `status ${mode}`.trim();
  }

  function setMetaUI(identity) {
    els.title.textContent = identity.title || "Unknown title";
    els.duration.textContent = formatTime(identity.durationSec);
    els.mediaMeta.textContent = `${identity.title} • ${formatTime(identity.durationSec)}`;
  }

  function renderLyrics(text) {
    els.lyricsContent.textContent = text || "";
    els.lyricsEditor.value = text || "";
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

  function computeScrollPlan() {
    const viewport = els.lyricsViewport;
    const content = els.lyricsContent;
    const media = state.currentMediaEl;

    if (!viewport || !content || !media) return null;

    const maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);
    const durationSec = safeDurationSeconds(media.duration || 0);

    if (!maxScroll || durationSec <= 0) {
      return {
        from: 0,
        to: 0,
        durationMs: 0,
      };
    }

    return {
      from: 0,
      to: maxScroll,
      durationMs: durationSec * 1000,
    };
  }

  function applyScroll(y) {
    els.lyricsContent.style.transform = `translateY(${-y}px)`;
  }

  function restartAutoScroll({ syncToCurrentTime = true } = {}) {
    cancelAutoScroll();

    if (state.isEditing) return;
    if (!state.currentMediaEl) return;

    const plan = computeScrollPlan();
    if (!plan) return;

    state.scrollFrom = plan.from;
    state.scrollTo = plan.to;
    state.scrollDurationMs = plan.durationMs;

    if (plan.durationMs <= 0 || plan.to <= 0) {
      applyScroll(0);
      return;
    }

    const media = state.currentMediaEl;
    const currentMs =
      syncToCurrentTime && Number.isFinite(media.currentTime)
        ? Math.min(media.currentTime * 1000, plan.durationMs)
        : 0;

    const initialProgress = currentMs / plan.durationMs;
    const initialY = plan.to * initialProgress;

    applyScroll(initialY);
    state.scrollStartMs = performance.now() - currentMs;

    const tick = (now) => {
      if (!state.currentMediaEl || state.currentMediaEl.paused || state.isEditing) {
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

    if (!media.paused) {
      state.scrollRAF = requestAnimationFrame(tick);
    }
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
    } else {
      els.editToggleBtn.textContent = "✍️";
      els.editToggleBtn.setAttribute("aria-label", "Edit lyrics");
      renderLyrics(els.lyricsEditor.value);
      requestAnimationFrame(() => restartAutoScroll({ syncToCurrentTime: true }));
    }
  }

  async function saveCurrentLyrics() {
    if (!state.currentRecord) return;

    const nextText = els.lyricsEditor.value || "";
    state.currentRecord.lyrics = nextText;
    state.currentRecord.updatedAt = Date.now();

    await putRecord(state.currentRecord);
    renderLyrics(nextText);

    // Important: changing lyrics changes scroll height, so recompute immediately.
    requestAnimationFrame(() => {
      restartAutoScroll({ syncToCurrentTime: true });
    });
  }

  // -----------------------------
  // Media detection
  // -----------------------------
  async function onPotentialNewMedia(mediaEl) {
    if (!mediaEl) return;

    // wait until duration becomes usable
    const identity = buildMediaIdentity(mediaEl);

    if (!identity.title || identity.durationSec <= 0) {
      return;
    }

    if (identity.mediaKey === state.lastMediaKey) {
      setMetaUI(identity);
      return;
    }

    state.currentMediaEl = mediaEl;
    state.lastMediaKey = identity.mediaKey;
    setMetaUI(identity);

    let record = await getRecord(identity.mediaKey);

    if (!record) {
      record = {
        mediaKey: identity.mediaKey,
        title: identity.title,
        durationSec: identity.durationSec,
        lyrics: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await putRecord(record);
    }

    state.currentRecord = record;
    renderLyrics(record.lyrics || "");
    setStatus(mediaEl.paused ? "paused" : "playing", mediaEl.paused ? "paused" : "playing");

    requestAnimationFrame(() => restartAutoScroll({ syncToCurrentTime: true }));
  }

  function attachMediaListeners(mediaEl) {
    if (!mediaEl || mediaEl.__karaokeBound) return;
    mediaEl.__karaokeBound = true;

    mediaEl.addEventListener("play", async () => {
      setStatus("playing", "playing");
      await onPotentialNewMedia(mediaEl);
      restartAutoScroll({ syncToCurrentTime: true });
    });

    mediaEl.addEventListener("pause", () => {
      setStatus("paused", "paused");
      cancelAutoScroll();
    });

    mediaEl.addEventListener("ended", () => {
      setStatus("ended");
      cancelAutoScroll();
    });

    mediaEl.addEventListener("timeupdate", () => {
      // if user seeks or timing drifts, resync softly
      if (!state.isEditing && !mediaEl.paused && mediaEl === state.currentMediaEl && !state.scrollRAF) {
        restartAutoScroll({ syncToCurrentTime: true });
      }
    });

    mediaEl.addEventListener("loadedmetadata", async () => {
      await onPotentialNewMedia(mediaEl);
    });

    mediaEl.addEventListener("durationchange", async () => {
      await onPotentialNewMedia(mediaEl);
    });

    mediaEl.addEventListener("seeked", () => {
      if (!state.isEditing) {
        restartAutoScroll({ syncToCurrentTime: true });
      }
    });
  }

  function scanMediaElements() {
    const mediaNodes = document.querySelectorAll("audio, video");
    mediaNodes.forEach(attachMediaListeners);
  }

  function observeDomForMedia() {
    state.mutationObserver = new MutationObserver(() => {
      scanMediaElements();
    });

    state.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // -----------------------------
  // Media Session hooks
  // -----------------------------
  function bindMediaSessionHooks() {
    if (!("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler("play", async () => {
        const media = state.currentMediaEl;
        if (!media) return;
        await media.play();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        const media = state.currentMediaEl;
        if (!media) return;
        media.pause();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        // Placeholder for future queue logic
        console.log("Next track requested");
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        // Placeholder for future queue logic
        console.log("Previous track requested");
      });
    } catch (err) {
      console.warn("Media Session action handler setup failed:", err);
    }
  }

  function syncPositionState() {
    if (!("mediaSession" in navigator)) return;
    const media = state.currentMediaEl;
    if (!media) return;

    try {
      if (
        Number.isFinite(media.duration) &&
        media.duration > 0 &&
        Number.isFinite(media.currentTime)
      ) {
        navigator.mediaSession.setPositionState({
          duration: media.duration,
          playbackRate: media.playbackRate || 1,
          position: media.currentTime,
        });
      }
    } catch (err) {
      // Ignore unsupported browsers
    }
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
      restartAutoScroll({ syncToCurrentTime: true });
    });

    els.lyricsEditor.addEventListener("input", () => {
      // Re-render only in editor shadow state now; actual save persists to DB.
      // Optional live preview recalculation:
      els.lyricsContent.textContent = els.lyricsEditor.value;
      requestAnimationFrame(() => {
        const media = state.currentMediaEl;
        if (!media) return;
        const wasEditing = state.isEditing;
        if (wasEditing) {
          // recompute geometry while editing, final restart happens on save
          computeScrollPlan();
        }
      });
    });

    setInterval(syncPositionState, 1000);
  }

  // -----------------------------
  // Bootstrap
  // -----------------------------
  async function init() {
    state.db = await openDb();
    bindUi();
    bindMediaSessionHooks();
    scanMediaElements();
    observeDomForMedia();
    setStatus("idle");
  }

  init().catch((err) => {
    console.error(err);
    setStatus("error");
    els.mediaMeta.textContent = "Initialization failed";
  });
})();
