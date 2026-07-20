# Sleep Card Status Tint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace campsite-card status stripes with a clear but calm full-card tint and reliably separate every action icon from its label.

**Architecture:** Keep the existing card markup and status classes. Implement status styling exclusively with CSS custom properties and gradients, then bump the versioned stylesheet/service-worker cache so previously installed clients cannot retain the old stripe design. No state, Firebase, or migration code changes.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, Node built-in test runner, service worker cache.

---

## File structure

- `tools/sleep-card-structure.test.mjs`: regression contract for tint classes, missing stripes, and icon spacing.
- `styles.css`: status-specific card tint variables and Flexbox spacing.
- `index.html`: stylesheet cache-busting query.
- `sw.js`: matching cached stylesheet URL and service-worker cache generation.

### Task 1: Pin the visual contract with a failing test

**Files:**
- Modify: `tools/sleep-card-structure.test.mjs`

- [ ] **Step 1: Add assertions for the approved card treatment**

Add assertions that require the approved status groups, a gradient driven by
`--sleep-card-tint`, no left-edge status treatment, and spacing in both button
and link actions:

```js
assert.match(css,/\.sleep-card\{[^}]*--sleep-card-tint:[^}]*background:linear-gradient\(135deg,var\(--sleep-card-tint\)/s);
assert.match(css,/\.sleep-card\.(?:available[^\n]*reservable|available),\.sleep-card\.reservable\{--sleep-card-tint:rgba\(95,212,168,\.13\)\}/);
assert.match(css,/\.sleep-card\.call\{--sleep-card-tint:rgba\(255,178,87,\.13\)\}/);
assert.match(css,/\.sleep-card\.awaiting[^\n]*--sleep-card-tint:rgba\(84,200,255,\.12\)/);
assert.doesNotMatch(css,/\.sleep-card[^\n{]*\{[^}]*border-left:/s);
assert.match(css,/\.sleep-actions \.btn\{[^}]*display:inline-flex[^}]*gap:8px/s);
assert.match(css,/\.sleep-link\{[^}]*gap:7px/s);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tools/sleep-card-structure.test.mjs
```

Expected: FAIL because the status tint variables and the larger explicit icon
gaps do not exist yet.

### Task 2: Implement the approved CSS and refresh cached clients

**Files:**
- Modify: `styles.css:637-646`
- Modify: `index.html:15`
- Modify: `sw.js:4-8`
- Test: `tools/sleep-card-structure.test.mjs`

- [ ] **Step 1: Add status tint variables and retain the status dot**

Use a neutral default plus the approved status groups:

```css
.sleep-card{
  --sleep-card-tint:rgba(255,255,255,.045);
  background:linear-gradient(135deg,var(--sleep-card-tint),rgba(255,255,255,.028) 72%);
}
.sleep-card.booked{--sleep-card-tint:rgba(142,168,255,.13)}
.sleep-card.available,.sleep-card.reservable{--sleep-card-tint:rgba(95,212,168,.13)}
.sleep-card.call{--sleep-card-tint:rgba(255,178,87,.13)}
.sleep-card.followup,.sleep-card.deposit_required{--sleep-card-tint:rgba(255,215,107,.13)}
.sleep-card.awaiting,.sleep-card.reserving,.sleep-card.draft_requested{--sleep-card-tint:rgba(84,200,255,.12)}
.sleep-card.unavailable{--sleep-card-tint:rgba(115,123,141,.11);opacity:.74}
```

- [ ] **Step 2: Make icon spacing independent of HTML whitespace**

Change the campsite action rules to:

```css
.sleep-actions .btn{display:inline-flex;align-items:center;gap:8px}
.sleep-link{display:inline-flex;align-items:center;gap:7px}
```

Keep `.sleep-icon` at a fixed 14 px width so different symbols align across
cards.

- [ ] **Step 3: Bump only the affected static cache generation**

Change the stylesheet query in `index.html` and `sw.js` from
`2026-07-20-sleep-ui-v24` to `2026-07-20-sleep-ui-v25`. Change `CACHE` in
`sw.js` from `sizigia-app-v25-active-sleep-map` to
`sizigia-app-v26-sleep-card-tint`. Do not change the `app.js` query because its
contents are untouched.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tools/sleep-card-structure.test.mjs
```

Expected: PASS with `groupedCards`, `contactIcons`, `answerPanel`,
`statusTints`, and `iconSpacing` all true.

### Task 3: Verify static, offline, and responsive behavior

**Files:**
- Verify only; no planned production changes.

- [ ] **Step 1: Run all automated verification**

Run:

```bash
git diff --check
node --test tools/*.test.mjs
node tools/verify-static-app.mjs
npm test --prefix cloud-mail
node tools/camping-mail-bridge.mjs self-test
```

Expected: every command exits 0 and the complete Node test run reports no
failures.

- [ ] **Step 2: Verify the rendered app at mobile and desktop widths**

Serve the existing static app locally, open the Schlafplätze list, and inspect
at approximately 375 px and 1100 px. Confirm:

- no left status stripe or clipping;
- mint, blue, orange, yellow, grey, and neutral cards are distinguishable;
- text and answer panels remain readable;
- symbol/label pairs have visible space;
- wrapped links and buttons do not overlap;
- console contains no app error.

- [ ] **Step 3: Commit and push to `main`**

```bash
git add styles.css index.html sw.js tools/sleep-card-structure.test.mjs docs/superpowers/plans/2026-07-20-sleep-card-status-tint-plan.md
git commit -m "Refine campsite card status styling"
git push origin main
```

Expected: GitHub regression tests and Pages deployment complete successfully.
