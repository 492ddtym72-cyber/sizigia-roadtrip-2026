# Home Dashboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved refined Direction B home dashboard: route hero, professional section tiles, and a `Zur Übersicht` return control, without changing app data, persistence, Cloud Sync, backup, budget, route, or undo logic.

**Architecture:** Keep the app as a single offline `index.html`. Add a small navigation-shell layer around the existing `TABS`/`switchTab(id)` contract: `HOME_TILES`, inline SVG icon helpers, an inline route hero renderer, a `renderHomeDashboard(...)` section inside `renderOverview()`, and a `sectionBackButton()` helper prepended to non-home render functions. The legacy `nav#nav` remains in the DOM for render coordination but is visually removed so the dashboard becomes the main entry point.

**Tech Stack:** Vanilla HTML/CSS/JS inline in `index.html`; no build step, no external images, no CDNs. Route artwork is inline SVG/CSS first; generated bitmap art is allowed only if embedded as a small data URI and verified not to break offline single-file use.

---

## Files

- Modify: `index.html`
- Read-only reference: `docs/superpowers/specs/2026-07-08-home-dashboard-navigation-design.md`
- No schema migration, no new JavaScript files, no new runtime dependencies.

## Global Safety Rules

- Do not touch `CLOUD_URL`, `StorageAdapter`, `save()`, `syncNow()`, `scheduleSync()`, `openBackupLocal()`, `importData()`, `restoreSnapshot()`, `budgetCalc()`, or `applyRevert()` except for verification reads.
- Do not rename any existing `TABS` IDs.
- Do not change `state`, `schemaVersion`, `migrate()`, or default data.
- Keep all user-facing copy in German.
- Keep the app working through `file://`.

### Task 1: Add Static Navigation Guards

**Files:**
- Modify: none
- Test: one-off `node -e` checks run from repo root

- [ ] **Step 1: Run the pre-implementation guard and watch it fail**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); const required=['const HOME_TILES','function renderHomeDashboard','function sectionBackButton','function routeHeroSvg','function homeIconSvg']; for (const token of required) { if (!s.includes(token)) { console.error('missing '+token); process.exit(1); } }"
```

Expected: FAIL with `missing const HOME_TILES`.

- [ ] **Step 2: Record the current no-touch safety baseline**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); const ids=[...s.matchAll(/\\{id:'([^']+)',\\s+label:/g)].map(m=>m[1]); const expected=['uebersicht','route','spots','logistik','packen','einkauf','budget','festival','verlauf']; if(JSON.stringify(ids)!==JSON.stringify(expected)){ console.error('tab ids changed: '+ids.join(',')); process.exit(1); } for (const token of ['function save()','async function syncNow()','function openBackupLocal','function budgetCalc()','function applyRevert']) { if(!s.includes(token)){ console.error('missing safety token '+token); process.exit(1); } } console.log('baseline ok');"
```

Expected: PASS with `baseline ok`.

### Task 2: Add CSS For Home Dashboard, Route Hero, Tiles, And Back Control

**Files:**
- Modify: `index.html` CSS section near current navigation/general component styles

- [ ] **Step 1: Add CSS after the existing `.tab.active` / mobile nav rules**

Insert this CSS block after the current navigation CSS:

```css
nav{display:none}
.home-dashboard{display:grid;gap:14px;margin-bottom:16px}
.home-kicker{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--sun);font-weight:800}
.home-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:2px}
.home-intro h2{font-family:var(--font-display);font-size:20px;letter-spacing:.08em;text-transform:uppercase;color:var(--text);margin:0}
.home-intro p{font-size:13px;color:var(--muted);margin-top:3px;max-width:46ch}
.route-hero{
  position:relative;min-height:190px;border:1px solid var(--border);border-radius:22px;
  overflow:hidden;background:#101522;box-shadow:0 18px 45px rgba(0,0,0,.24);cursor:pointer;
}
.route-hero svg{position:absolute;inset:0;width:100%;height:100%}
.route-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,10,18,.94),rgba(7,10,18,.48) 58%,rgba(7,10,18,.84))}
.goa-ring{
  position:absolute;right:-26px;top:-28px;width:138px;height:138px;border-radius:50%;opacity:.16;z-index:1;
  background:repeating-conic-gradient(from 12deg,rgba(255,178,87,.9) 0 6deg,transparent 6deg 14deg);
}
.hero-copy{position:absolute;left:18px;right:18px;bottom:17px;z-index:2}
.hero-copy .eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--sun);font-weight:900}
.hero-copy b{display:block;font-size:25px;line-height:1.05;margin-top:5px}
.hero-copy span{display:block;font-size:13px;color:var(--muted);margin-top:4px}
.home-tile-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.home-tile{
  position:relative;min-height:106px;border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.045);
  padding:13px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;cursor:pointer;
  transition:border-color .16s,transform .16s,background .16s;
}
.home-tile:hover{border-color:var(--border-strong);background:rgba(255,255,255,.065);transform:translateY(-1px)}
.home-tile::before{
  content:"";position:absolute;right:-18px;top:-18px;width:78px;height:78px;border-radius:50%;
  background:var(--tile-glow,rgba(255,178,87,.22));opacity:.5;filter:blur(2px);
}
.home-icon{position:relative;width:31px;height:31px;color:var(--text);z-index:1}
.home-icon svg{width:100%;height:100%;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.home-tile b{position:relative;z-index:1;font-size:13.5px}
.home-tile small{position:relative;z-index:1;font-size:10.5px;color:var(--muted)}
.home-live{border:1px solid var(--border);border-radius:18px;background:rgba(255,255,255,.04);padding:13px}
.home-live b{display:block;color:var(--sun);font-size:13.5px}
.home-live span{display:block;color:var(--muted);font-size:12px;margin-top:3px}
.section-return{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.section-return button{
  width:38px;height:38px;border-radius:13px;border:1px solid var(--border);background:var(--card);color:var(--sun);
  font-size:18px;font-weight:900;cursor:pointer;
}
.section-return span{font-size:13px;color:var(--muted);font-weight:700}
@media(max-width:640px){
  .home-intro{display:block}
  .route-hero{min-height:166px}
  .home-tile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .home-tile{min-height:102px}
}
```

- [ ] **Step 2: Run CSS smoke check**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); for (const token of ['.home-dashboard','.route-hero','.home-tile-grid','.section-return','nav{display:none}']) { if(!s.includes(token)){ console.error('missing CSS '+token); process.exit(1); } } console.log('home css ok');"
```

Expected: PASS with `home css ok`.

### Task 3: Add Home Dashboard Data And Inline SVG Helpers

**Files:**
- Modify: `index.html` JavaScript section after `TABS` or before `renderNav()`

- [ ] **Step 1: Add `HOME_TILES` after `TABS`**

Insert this block directly after the `TABS` declaration:

```js
const HOME_TILES = [
  {id:'spots', label:'Stopps', sub:'Ideen & Voting', icon:'pin', glow:'rgba(255,107,74,.32)'},
  {id:'logistik', label:'Fahrzeuge', sub:'Sitze & Dokumente', icon:'van', glow:'rgba(142,168,255,.30)'},
  {id:'packen', label:'Packen', sub:'Listen & Zuständigkeit', icon:'bag', glow:'rgba(224,140,255,.28)'},
  {id:'einkauf', label:'Einkaufen', sub:'Vorräte & Wasser', icon:'cart', glow:'rgba(95,212,168,.30)'},
  {id:'budget', label:'Ausgaben', sub:'Salden & Ausgleich', icon:'money', glow:'rgba(255,215,107,.32)'},
  {id:'festival', label:'Festival', sub:'Infos & Anreise', icon:'tent', glow:'rgba(255,178,87,.30)'},
  {id:'verlauf', label:'Aktivität', sub:'Verlauf & Undo', icon:'activity', glow:'rgba(142,168,255,.26)'},
];
```

- [ ] **Step 2: Add `homeIconSvg(kind)` after `switchTab(id)`**

Insert this helper after `switchTab(id)`:

```js
function homeIconSvg(kind){
  const icons = {
    pin:'<svg viewBox="0 0 24 24"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    van:'<svg viewBox="0 0 24 24"><path d="M4 16V8h12l4 4v4"/><path d="M6 16a2 2 0 1 0 4 0"/><path d="M16 16a2 2 0 1 0 4 0"/><path d="M4 12h16"/></svg>',
    bag:'<svg viewBox="0 0 24 24"><path d="M7 9V7a5 5 0 0 1 10 0v2"/><path d="M5 9h14l-1 12H6L5 9Z"/><path d="M9 13h6"/></svg>',
    cart:'<svg viewBox="0 0 24 24"><path d="M4 5h2l2 11h10l2-8H7"/><path d="M9 20a1 1 0 1 0 0-2"/><path d="M17 20a1 1 0 1 0 0-2"/></svg>',
    money:'<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M17 7H9.5a3 3 0 0 0 0 6H14a3 3 0 0 1 0 6H6"/></svg>',
    tent:'<svg viewBox="0 0 24 24"><path d="M4 20 12 4l8 16"/><path d="M8 13h8"/><path d="M6 20h12"/></svg>',
    activity:'<svg viewBox="0 0 24 24"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M5 20h14"/></svg>',
  };
  return icons[kind] || icons.activity;
}
```

- [ ] **Step 3: Add `routeHeroSvg()` after `homeIconSvg(kind)`**

Insert this helper:

```js
function routeHeroSvg(){
  return `<svg viewBox="0 0 420 190" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="sea" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#18264a"/><stop offset="1" stop-color="#080d19"/></linearGradient>
      <linearGradient id="land" x1="0" x2="1"><stop stop-color="#182032"/><stop offset="1" stop-color="#0f1625"/></linearGradient>
      <filter id="routeGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="420" height="190" fill="url(#sea)"/>
    <path d="M0 48 C62 58 82 34 130 45 C184 58 176 91 236 88 C295 85 317 64 420 75 L420 0 L0 0Z" fill="url(#land)" opacity=".96"/>
    <path d="M0 144 C64 126 108 136 150 120 C203 100 247 118 294 103 C341 88 365 92 420 80 L420 190 L0 190Z" fill="#080b12" opacity=".72"/>
    <path d="M90 40 C132 66 150 97 182 112 C225 132 256 118 291 101 C323 86 348 82 382 72" stroke="#ffb257" stroke-width="3" fill="none" filter="url(#routeGlow)"/>
    <path d="M90 40 C132 66 150 97 182 112 C225 132 256 118 291 101 C323 86 348 82 382 72" stroke="#ff6b4a" stroke-width="1.1" stroke-dasharray="5 7" fill="none"/>
    <circle cx="90" cy="40" r="5" fill="#ffb257"/><circle cx="182" cy="112" r="5" fill="#ffb257"/><circle cx="291" cy="101" r="5" fill="#ffb257"/><circle cx="382" cy="72" r="6" fill="#ff6b4a"/>
    <text x="71" y="31" fill="#9da6c1" font-size="9">München</text>
    <text x="362" y="60" fill="#ffd39a" font-size="9">Huesca</text>
    <circle cx="352" cy="47" r="16" fill="none" stroke="#ffb257" stroke-width="1" opacity=".55"/>
    <circle cx="359" cy="42" r="15" fill="#0b0d16" opacity=".9"/>
  </svg>`;
}
```

- [ ] **Step 4: Run helper guard**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); for (const token of ['const HOME_TILES','function homeIconSvg(kind)','function routeHeroSvg()']) { if(!s.includes(token)){ console.error('missing helper '+token); process.exit(1); } } console.log('home helpers ok');"
```

Expected: PASS with `home helpers ok`.

### Task 4: Render The Home Dashboard In `renderOverview()`

**Files:**
- Modify: `index.html` JavaScript near `routeTotals()` / `renderOverview()`

- [ ] **Step 1: Add `renderHomeDashboard(route, tot, pCheck)` before `renderOverview()`**

Insert this helper after `routeTotals(stages)`:

```js
function renderHomeDashboard(route, tot, pCheck){
  return `
    <div class="home-dashboard">
      <div class="home-intro">
        <div>
          <div class="home-kicker">Start</div>
          <h2>Wohin willst du?</h2>
          <p>Der schnelle Einstieg für Route, Orga und Festival.</p>
        </div>
      </div>
      <div class="route-hero" onclick="switchTab('route')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' ')switchTab('route')">
        ${routeHeroSvg()}
        <div class="goa-ring" aria-hidden="true"></div>
        <div class="hero-copy">
          <div class="eyebrow">Roadtrip</div>
          <b>Route planen</b>
          <span>${esc(route.name)} · ca. ${tot.km} km · ~${tot.hTxt} Std</span>
        </div>
      </div>
      <div class="home-tile-grid">
        ${HOME_TILES.map(t=>`
          <button class="home-tile" style="--tile-glow:${t.glow}" onclick="switchTab('${t.id}')">
            <span class="home-icon">${homeIconSvg(t.icon)}</span>
            <b>${esc(t.label)}</b>
            <small>${esc(t.sub)}</small>
          </button>`).join('')}
      </div>
      <div class="home-live">
        <b>Heute im Blick</b>
        <span>${pCheck.done}/${pCheck.total} Punkte der Checkliste erledigt · Backup sicher lokal · Änderungen werden synchronisiert.</span>
      </div>
    </div>`;
}
```

- [ ] **Step 2: Add the dashboard at the top of `renderOverview()`**

Change this line:

```js
document.getElementById('page-uebersicht').innerHTML = `
```

to:

```js
document.getElementById('page-uebersicht').innerHTML = renderHomeDashboard(route, tot, pCheck) + `
```

- [ ] **Step 3: Run overview render static guard**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); if(!s.includes('function renderHomeDashboard(route, tot, pCheck)')){ console.error('missing renderHomeDashboard'); process.exit(1); } if(!s.includes(\"innerHTML = renderHomeDashboard(route, tot, pCheck) + `\")){ console.error('dashboard not prepended to overview'); process.exit(1); } console.log('overview dashboard guard ok');"
```

Expected: PASS with `overview dashboard guard ok`.

### Task 5: Add `Zur Übersicht` Back Control To Subpages

**Files:**
- Modify: `index.html` JavaScript render functions

- [ ] **Step 1: Add `sectionBackButton()` after `renderHomeDashboard(...)`**

Insert:

```js
function sectionBackButton(){
  return `<div class="section-return"><button onclick="switchTab('uebersicht')" aria-label="Zur Übersicht">←</button><span>Zur Übersicht</span></div>`;
}
```

- [ ] **Step 2: Prefix non-home page renders**

Apply these exact transformations:

```js
document.getElementById('page-route').innerHTML = `
```

becomes:

```js
document.getElementById('page-route').innerHTML = sectionBackButton() + `
```

Repeat the same pattern for:

```js
document.getElementById('page-spots').innerHTML =
document.getElementById('page-logistik').innerHTML =
document.getElementById(pageId).innerHTML = prefix + groups.map(g=>{
document.getElementById('page-budget').innerHTML = `
document.getElementById('page-festival').innerHTML =
document.getElementById('page-verlauf').innerHTML = `
```

For `renderCategoryLists(pageId, groups, kind, addCatLabel, prefix='', hideAdd=false)`, change the first assignment to:

```js
document.getElementById(pageId).innerHTML = sectionBackButton() + prefix + groups.map(g=>{
```

Do not add the back control to `page-uebersicht`.

- [ ] **Step 3: Run back-control static guard**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); if(!s.includes('function sectionBackButton()')){ console.error('missing sectionBackButton'); process.exit(1); } const count=(s.match(/sectionBackButton\\(\\)/g)||[]).length; if(count<8){ console.error('expected sectionBackButton in helper plus subpage renders, got '+count); process.exit(1); } console.log('back controls guard ok');"
```

Expected: PASS with `back controls guard ok`.

### Task 6: Render Verification In Browser

**Files:**
- Modify: none unless verification finds layout bugs
- Test: local static server and in-app browser

- [ ] **Step 1: Run static checks**

Run:

```bash
git diff --check
node -e "const fs=require('fs'); const s=fs.readFileSync('index.html','utf8'); const ids=[...s.matchAll(/\\{id:'([^']+)',\\s+label:/g)].map(m=>m[1]); const expected=['uebersicht','route','spots','logistik','packen','einkauf','budget','festival','verlauf']; if(JSON.stringify(ids)!==JSON.stringify(expected)){ console.error('tab ids changed: '+ids.join(',')); process.exit(1); } for (const token of ['function save()','async function syncNow()','function openBackupLocal','function budgetCalc()','function applyRevert']) { if(!s.includes(token)){ console.error('missing safety token '+token); process.exit(1); } } console.log('static safety ok');"
```

Expected: both commands exit 0; second prints `static safety ok`.

- [ ] **Step 2: Start local server**

Run:

```bash
python3 -m http.server 8082
```

Expected: server starts. If port `8082` is busy, use `8083` and keep the chosen port consistent in browser verification.

- [ ] **Step 3: Browser-check desktop and mobile**

Use the in-app browser on the local server URL. Verify:

- `Übersicht` renders the route hero, home tile grid, and `Heute im Blick`.
- Header save/sync status still renders.
- There is no visible old nav row competing with the dashboard.
- Clicking `Route planen` opens the route page.
- Clicking `Ausgaben` opens the budget page.
- `Zur Übersicht` returns to the dashboard from route and budget pages.
- At ~390 px width, tiles are two columns and no horizontal overflow occurs.
- At ~1540 px width, route hero and tiles are centered and professional.
- Console warnings/errors are empty or unrelated browser noise only.

- [ ] **Step 4: Save screenshot evidence outside the repo**

Save screenshots to:

```text
/tmp/sizigia-home-dashboard-desktop.png
/tmp/sizigia-home-dashboard-mobile.png
/tmp/sizigia-section-back.png
```

Expected: screenshots show the approved home dashboard and back control.

### Task 7: Publish To GitHub Pages

**Files:**
- Modify: none
- Git: commit and push

- [ ] **Step 1: Final working tree review**

Run:

```bash
git status -sb
git diff --stat
```

Expected: only `index.html` is modified for implementation.

- [ ] **Step 2: Commit**

Run:

```bash
git add index.html
git commit -m "Add home dashboard navigation"
```

Expected: commit succeeds.

- [ ] **Step 3: Push**

Run:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 4: Verify GitHub Pages**

Run:

```bash
gh run list --limit 1
```

Wait until the `pages build and deployment` run for the new commit is `completed success`.

Then run:

```bash
curl -L -sS -o /tmp/sizigia-live-home-dashboard.html https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/
rg -n "home-dashboard|route-hero|Zur Übersicht|HOME_TILES" /tmp/sizigia-live-home-dashboard.html
```

Expected: deployment succeeds and `rg` finds all four tokens in the live HTML.

## Self-Review Notes

- Spec coverage: The plan covers the approved B structure, route hero, professional icons, subtle Goa accent, back control, unchanged navigation contract, offline single-file artwork constraint, and public deployment verification.
- Deferred-marker scan: No deferred implementation markers are present.
- Type/name consistency: Uses existing `TABS`, `switchTab(id)`, `renderOverview()`, and page IDs. New names are consistent: `HOME_TILES`, `homeIconSvg`, `routeHeroSvg`, `renderHomeDashboard`, `sectionBackButton`.
