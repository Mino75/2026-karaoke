(() => {
  const css = `
    :root {
      color-scheme: dark;
      --bg: #08090b;
      --bg-elevated: #0f1115;
      --panel: rgba(18, 20, 26, 0.88);
      --panel-strong: rgba(24, 27, 35, 0.96);
      --text: #f5f7fb;
      --muted: #98a0ae;
      --line: rgba(255, 255, 255, 0.08);
      --line-strong: rgba(255, 255, 255, 0.12);
      --accent: #ffffff;
      --success: #34d399;
      --warning: #f59e0b;
      --radius: 20px;
      --radius-sm: 14px;
      --shadow: 0 18px 60px rgba(0, 0, 0, 0.38);
      --pad: 16px;
      --safe-bottom: max(16px, env(safe-area-inset-bottom));
      --topbar-bg: rgba(8, 9, 11, 0.78);
      --viewport-h: 60dvh;
      --viewport-min-h: 340px;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      background:
        radial-gradient(circle at top, rgba(255,255,255,0.055), transparent 34%),
        linear-gradient(180deg, #06070a 0%, #090b10 100%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    }

    body {
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      overscroll-behavior-y: none;
    }

    button,
    textarea,
    input {
      font: inherit;
    }

    #app {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      min-height: 100dvh;
      padding: 14px 14px var(--safe-bottom);
    }




    .topbar {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0 14px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      background: linear-gradient(180deg, var(--topbar-bg), rgba(8, 9, 11, 0.42));
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1 1 auto;
    }

    .brand__dot {
      width: 12px;
      height: 12px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 18px rgba(255, 255, 255, 0.42);
    }

    .brand h1 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.1;
    }

    .brand p {
      margin: 4px 0 0;
      max-width: 58vw;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--muted);
      font-size: 0.79rem;
      line-height: 1.2;
    }

    .shell {
      display: grid;
      gap: 14px;
    }

    .card {
      background:
        linear-gradient(180deg, var(--panel), var(--panel-strong));
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: var(--pad);
    }

    .label {
      display: inline-block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .now h2 {
      margin: 0 0 10px;
      font-size: 1.28rem;
      line-height: 1.18;
      font-weight: 700;
      word-break: break-word;
    }

    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 1.2em;
      text-transform: lowercase;
    }

    .status::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      display: inline-block;
      background: var(--muted);
      box-shadow: 0 0 0 4px rgba(255,255,255,0.03);
    }

    .status.playing::before {
      background: var(--success);
    }

    .status.paused::before {
      background: var(--warning);
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }

    .icon-btn,
    .ghost-btn {
      appearance: none;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      color: var(--text);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition:
        transform 0.14s ease,
        background 0.14s ease,
        border-color 0.14s ease,
        opacity 0.14s ease;
    }

    .icon-btn:hover,
    .ghost-btn:hover {
      background: rgba(255,255,255,0.07);
      border-color: var(--line-strong);
    }

    .icon-btn:active,
    .ghost-btn:active {
      transform: scale(0.98);
    }

    .icon-btn:disabled,
    .ghost-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .icon-btn {
      width: 46px;
      height: 46px;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.08rem;
      font-weight: 600;
    }

    .ghost-btn {
      padding: 10px 12px;
      font-size: 0.86rem;
      line-height: 1;
    }

    .lyrics-viewport {
      position: relative;
      height: var(--viewport-h);
      min-height: var(--viewport-min-h);
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid var(--line);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
      isolation: isolate;
    }

    .lyrics-viewport::before,
    .lyrics-viewport::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      z-index: 2;
      pointer-events: none;
      height: 32px;
    }

    .lyrics-viewport::before {
      top: 0;
      background: linear-gradient(180deg, rgba(10, 11, 15, 0.95), rgba(10, 11, 15, 0));
    }

    .lyrics-viewport::after {
      bottom: 0;
      background: linear-gradient(180deg, rgba(10, 11, 15, 0), rgba(10, 11, 15, 0.95));
    }

    .lyrics-content {
      padding: 24px 18px 42vh;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.9;
      font-size: 1.08rem;
      letter-spacing: 0.01em;
      will-change: transform;
      transform: translateY(0);
    }

    .lyrics-editor {
      width: 100%;
      height: var(--viewport-h);
      min-height: var(--viewport-min-h);
      resize: none;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #0b0d11;
      color: var(--text);
      padding: 18px;
      line-height: 1.7;
      outline: none;
    }

    .lyrics-editor:focus {
      border-color: var(--line-strong);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.06);
    }

    .hidden {
      display: none !important;
    }

    @media (min-width: 768px) {
      :root {
        --pad: 18px;
        --viewport-h: 62dvh;
      }

      #app {
        padding-top: 22px;
      }

      .now h2 {
        font-size: 1.46rem;
      }

      .lyrics-content {
        padding-left: 26px;
        padding-right: 26px;
        font-size: 1.22rem;
      }

      .brand p {
        max-width: 420px;
      }
    }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();
