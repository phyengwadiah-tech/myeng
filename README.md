# MYENG — myeng.online

Static site for MYENG, Rotating Equipment Intelligence. Served by GitHub Pages (`CNAME` → `myeng.online`). No build step, no backend.

```
index.html            Two views: landing page (/) and full-screen Studio (#studio/tbe|hydraulics|parser)
404.html              Copy of index.html (GitHub Pages fallback); keep in sync
favicon.svg           MYENG mark
assets/css/myeng.css  Visual system (Ceramic Stone / Obsidian / Vermilion)
assets/js/engine.js   Deterministic engineering math: pure functions, no DOM
assets/js/app.js      UI: router, TBE matrix, hydraulics studio, BYOK parser, reports
assets/impeller-hero.jpg  Hero photograph
```

After editing `index.html`, run `cp index.html 404.html`.

The engine can be checked with Node: `node -e "require('./assets/js/engine.js'); console.log(MyengEngine.hydraulicPower(998, 420, 68))"`.

Privacy model: no cookies, no storage, no analytics. Azure / Gemini API keys entered in the parser exist only in tab memory.

Studio bid packages are saved in the browser's localStorage under `myeng.workspace.v1` (never uploaded). API keys and Entra ID tokens stay in tab memory only.
