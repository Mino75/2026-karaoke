(() => {
  const css = `
    :root{
      color-scheme: dark;
      --bg: #09090b;
      --panel: #111114;
      --panel-2: #17171c;
      --text: #f4f4f5;
      --muted: #9a9aa3;
      --line: rgba(255,255,255,.08);
      --accent: #ffffff;
      --success: #7dd3fc;
      --radius: 18px;
      --shadow: 0 10px 40px rgba(0,0,0,.35);
      --pad: 16px;
      --safe-bottom: max(16px, env(safe-area-inset-bottom));
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      background: linear-gradient(180deg, #060608 0%, #0b0b0f 100%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      min-height: 100%;
    }

    body {
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    #app {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      min-height: 100dvh;
      padding: 14px 14px var(--safe-bottom);
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0 14px;
      backdrop-filter: blur(14px);
      background: linear-gradient(180deg, rgba(9,9,11,.92), rgba(9,9,11,.65));
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand__dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 18px rgba(255,255,255,.45);
      flex: 0 0 auto;
    }

    .brand h1 {
      margin: 0;
      font-size: 1rem;
      letter-spacing: .02em;
      font-weight: 700;
    }

    .brand p {
      margin: 2px 0 0;
      font-size: .78rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 52vw;
    }

    .shell {
      display: grid;
      gap: 14px;
    }

    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-2));
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: var(--pad);
    }

    .label {
      display: inline-block;
      font-size: .72rem;
      text-transform: uppercase;
      letter-spacing: .12em;
      color: var(--muted);
      margin-bottom: 8px;
    }

    .now h2 {
      margin: 0 0 8px;
      font-size: 1.25rem;
      line-height: 1.2;
      word-break: break-word;
    }

    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--muted);
      font-size: .92rem;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .status::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--muted);
      display: inline-block;
    }

    .status.playing::before { background: #34d399; }
    .status.paused::before { background: #f59e0b; }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }

    .icon-btn,
    .ghost-btn {
      border: 1px solid var(--line);
      background: rgba(255,255,255,.04);
      color: var(--text);
      border-radius: 14px;
      cursor: pointer;
      transition: transform .16s ease, background .16s ease, border-color .16s ease;
    }

    .icon-btn {
      width: 46px;
      height: 46px;
      font-size: 1.1rem;
      flex: 0 0 auto;
    }

    .ghost-btn {
      padding: 10px 12px;
      font-size: .85rem;
    }

    .icon-btn:active,
    .ghost-btn:active {
      transform: scale(.98);
    }

    .lyrics-viewport {
      position: relative;
      height: 58dvh;
      min-height: 320px;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid var(--line);
      background:
        linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015));
    }

    .lyrics-content {
      padding: 24px 18px 42vh;
      white-space: pre-wrap;
      line-height: 1.85;
      font-size: 1.1rem;
      word-break: break-word;
      will-change: transform;
      transform: translateY(0);
    }

    .lyrics-editor {
      width: 100%;
      height: 58dvh;
      min-height: 320px;
      resize: none;
      border-radius: 16px;
      border: 1px solid var(--line);
      background: #0c0c10;
      color: var(--text);
      padding: 18px;
      font: inherit;
      line-height: 1.65;
      outline: none;
    }

    .hidden {
      display: none !important;
    }

    @media (min-width: 768px) {
      #app {
        padding-top: 24px;
      }

      .now h2 {
        font-size: 1.45rem;
      }

      .lyrics-content {
        font-size: 1.22rem;
        padding-left: 26px;
        padding-right: 26px;
      }
    }
  `;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();
