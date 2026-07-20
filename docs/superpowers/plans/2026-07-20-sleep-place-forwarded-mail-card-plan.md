# Reliable Sleep Place, Forwarded Mail, and Card UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manually added sleeping places immediately recoverable on the map, recognize common forwarded-mail header formats without weakening matching, and restore calm visual grouping and contact cues to venue cards.

**Architecture:** Keep the existing `sleepPlaces` + `sleepSearches[].candidates` model and add only an optional `mapPinned` flag for future manual additions. Centralize positioned/unpositioned map row selection in pure helpers used by both map layers. Extend forwarded parsing behind an explicit `allowHeaderBlock` gate used only for forward-prefixed envelopes, while retaining exact embedded-address matching and manual review. Finish with markup/CSS-only card hierarchy changes.

**Tech Stack:** Static vanilla JavaScript, CSS, Node.js ESM, `node:test`/assertion scripts, VM-based app testbed, GitHub Actions Gmail runner.

---

## File map

- Create `tools/sleep-place-visibility.test.mjs`: real-`app.js` VM regression for missing positions, manual map pins, deduplication, and both map layers.
- Modify `app.js`: map position helpers, unpositioned queue markup, add feedback, optional `mapPinned`, and card icon markup.
- Modify `styles.css`: compact missing-position queue and quiet structured venue cards.
- Modify `tools/camping-mail-forwarding.test.mjs`: multiple real-world forwarded formats plus fail-closed cases.
- Modify `tools/camping-mail-core.mjs`: gated forwarded header-block parsing.
- Modify `cloud-mail/runner.mjs`: enable gated parsing only after an envelope subject is recognized as forwarded.
- Create `tools/sleep-card-structure.test.mjs`: static/VM assertions for visual structure and contact cues.

No task changes `SCHEMA_VERSION`, migrations, Firebase seed data, Gmail credentials, or the mail send boundary.

### Task 1: Keep every manually added place visible until it can be plotted

**Files:**
- Create: `tools/sleep-place-visibility.test.mjs`
- Modify: `app.js:3171-3259, 3431-3529`
- Modify: `styles.css` near the existing `.sleep-map*` rules

- [ ] **Step 1: Write the failing visibility regression**

Create `tools/sleep-place-visibility.test.mjs`:

```js
#!/usr/bin/env node
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

const app=loadApp();
await new Promise(resolve=>setImmediate(resolve));

const missing=app.run(`(()=>{
  const s=state.sleepSearches[0],place={id:'manual-place',name:'Manual Test Camp',region:'Testtal',createdAt:new Date().toISOString()},candidate=normalizeSleepCandidate({id:'manual-candidate',placeId:place.id,name:place.name,region:place.region,status:'new',mapPinned:true});
  state.sleepPlaces.push(place);s.candidates.push(candidate);sleepMapStatus='all';
  const rows=sleepUnpositionedRows('all'),html=buildSleepMap();
  return {count:rows.filter(row=>row.c.placeId===place.id).length,html};
})()`);
assert.equal(missing.count,1,'manuell hinzugefügter Ort ohne Position erscheint genau einmal');
assert.ok(missing.html.includes('Position fehlt'));
assert.ok(missing.html.includes('Manual Test Camp'));
assert.ok(missing.html.includes('Position setzen'));
assert.ok(missing.html.includes("editSleepCandidate('"),'Aktion nutzt den bestehenden Bearbeiten-Dialog');

const positioned=app.run(`(()=>{
  const s=state.sleepSearches[0],c=s.candidates.find(x=>x.id==='manual-candidate'),p=sleepPlace(c);
  p.lat=42.55;p.lng=1.58;c.status='awaiting';c.contactedAt=new Date().toISOString();
  sleepMapLayer='detail';buildSleepMap();const detail=sleepDetailRows.some(row=>row.c.id===c.id);
  sleepMapLayer='offline';const offline=buildSleepMap();
  return {missing:sleepUnpositionedRows('all').some(row=>row.c.id===c.id),detail,offline:offline.includes('map-pt')};
})()`);
assert.equal(positioned.missing,false);
assert.equal(positioned.detail,true,'positionierter Ort speist die Onlinekarte');
assert.equal(positioned.offline,true,'positionierter Ort speist die Offlinekarte');

const pinned=app.run(`(()=>{
  const s=state.sleepSearches[0],c=s.candidates.find(x=>x.id==='manual-candidate');
  c.status='new';c.contactedAt='';return sleepMapRows('open').some(row=>row.c.id===c.id);
})()`);
assert.equal(pinned,true,'manuell hinzugefügter neuer Ort darf nach Positionierung nicht wieder verschwinden');

console.log(JSON.stringify({ok:true,missingVisible:true,bothMaps:true,manualPin:true}));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node tools/sleep-place-visibility.test.mjs
```

Expected: FAIL because `sleepUnpositionedRows` does not exist and manually added `new` candidates are excluded from `sleepMapRows`.

- [ ] **Step 3: Add minimal position and row helpers**

In `app.js`, beside `sleepMapStatusGroup`, add:

```js
function sleepCandidatePositioned(raw){
  const c=sleepCandidateView(raw);
  return Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lng));
}
function sleepMapEligible(c){
  return !!(c.mapPinned||sleepMapContacted(c));
}
function sleepUnpositionedRows(status=sleepMapStatus){
  const rank={booked:0,deposit_required:1,available:2,reservable:3,call:4,reserving:5,awaiting:6,followup:7,draft_requested:8,new:9,unavailable:10},seen=new Map();
  (state.sleepSearches||[]).forEach(search=>(search.candidates||[]).forEach(c=>{
    if(sleepCandidatePositioned(c))return;
    if(status!=='all'&&sleepMapStatusGroup(c)!==status)return;
    const key=c.placeId||c.id,prev=seen.get(key);
    if(!prev||(rank[c.status]??9)<(rank[prev.c.status]??9))seen.set(key,{search,c});
  }));
  return [...seen.values()];
}
```

Change `sleepMapBaseRows()` to filter with `sleepMapEligible` instead of `sleepMapContacted`.

- [ ] **Step 4: Mark future manual additions and render the missing-position queue**

In `addSleepCandidate`, initialize the new candidate with `mapPinned:true`. After `applyCandidateValues`, keep saving but call:

```js
if(!sleepCandidatePositioned(c))toast('Gespeichert · Kartenposition fehlt');
```

Add:

```js
function sleepUnpositionedList(status=sleepMapStatus){
  const rows=sleepUnpositionedRows(status);
  if(!rows.length)return '';
  return `<section class="sleep-unpositioned"><div class="sleep-unpositioned-head"><b>Position fehlt</b><span>${rows.length}</span></div>${rows.map(({search,c})=>{const view=sleepCandidateView(c);return `<div class="sleep-unpositioned-row"><div><b>${esc(view.name)}</b><span>${esc([view.region||search.region,search.title,SLEEP_STATUSES[c.status]?.label].filter(Boolean).join(' · '))}</span></div><button class="btn ghost small" onclick="editSleepCandidate('${search.id}','${c.id}')">Position setzen</button></div>`;}).join('')}</section>`;
}
```

Append `sleepUnpositionedList()` directly after `mapHtml` in `buildSleepMap()` and remove the old generic “N Einträge noch ohne Kartenposition” hint.

- [ ] **Step 5: Add compact queue styling**

Add to `styles.css`:

```css
.sleep-unpositioned{margin:10px 0 2px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.025);overflow:hidden}
.sleep-unpositioned-head{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid rgba(255,255,255,.07);font-size:11px;color:var(--muted)}
.sleep-unpositioned-head span{font-variant-numeric:tabular-nums;color:var(--faint)}
.sleep-unpositioned-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px}
.sleep-unpositioned-row+.sleep-unpositioned-row{border-top:1px solid rgba(255,255,255,.06)}
.sleep-unpositioned-row>div{min-width:0}.sleep-unpositioned-row b{display:block;font-size:12.5px}.sleep-unpositioned-row span{display:block;margin-top:2px;color:var(--muted);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sleep-unpositioned-row .btn{flex:0 0 auto}
```

- [ ] **Step 6: Run focused and existing map tests**

Run:

```bash
node tools/sleep-place-visibility.test.mjs
node tools/sleep-recovery-safeguards.test.mjs
```

Expected: both exit 0; the new test prints `"bothMaps":true` and existing map/filter assertions remain green.

- [ ] **Step 7: Commit the functional place fix**

```bash
git add app.js styles.css tools/sleep-place-visibility.test.mjs
git commit -m "Keep new sleep places visible until positioned"
```

### Task 2: Recognize common forwarded header blocks without auto-applying them

**Files:**
- Modify: `tools/camping-mail-forwarding.test.mjs`
- Modify: `tools/camping-mail-core.mjs:65-80`
- Modify: `cloud-mail/runner.mjs:30-52`

- [ ] **Step 1: Add failing format fixtures**

Extend `tools/camping-mail-forwarding.test.mjs` after the existing marked reply:

```js
const webde=parseForwardedMessage(`Gesendet: Montag, 20. Juli 2026 um 14:16

Von: info@test.example

An: habel-max@web.de

Betreff: Re: Reserva de Camping Test

Hola
No puc acceptar vuestra reserva; el camping es ple fins al 10 d’Agost.`,{allowHeaderBlock:true});
assert.equal(webde?.from,'info@test.example');
assert.equal(webde?.subject,'Re: Reserva de Camping Test');
assert.ok(webde?.body.startsWith('Hola'));
assert.equal(matchForwardedCandidate(webde,candidates)?.candidate.candidateId,'c2');
assert.equal(forwardedReviewResult(webde,'reply').status,'review');
assert.equal(forwardedReviewResult(webde,'reply').suggestedStatus,'unavailable');

const mobile=parseForwardedMessage(`Sent with the mobile mail app

On 20/07/2026 at 14.16, info@test.example wrote:

> From: info@test.example
> Date: 20 July 2026
> To: habel-max@web.de
> Subject: Re: Camping Test
>
> We are fully booked for your dates.`,{allowHeaderBlock:true});
assert.equal(mobile?.from,'info@test.example');
assert.ok(mobile?.body.startsWith('We are fully booked'));

assert.equal(parseForwardedMessage(`From: info@test.example
To: habel-max@web.de
Subject: Re: Camping Test

We are full.`),null,'bare Header bleiben ohne explizites Runner-Gate untrusted');
assert.equal(parseForwardedMessage(`From: unknown@example.org
Subject: Camping Test

We have space.`,{allowHeaderBlock:true}),null,'unvollständiger Headerblock wird verworfen');
assert.equal(matchForwardedCandidate(parseForwardedMessage(`From: impostor@example.org
To: someone@example.net
Subject: Re: Camping Test

We have space.`,{allowHeaderBlock:true}),candidates),null,'Betreff ohne passende eingebettete Adresse reicht nicht');
```

Also update the final JSON to include `headerBlocks:true` and `variedFormats:true`.

- [ ] **Step 2: Run the forwarding test and verify RED**

Run:

```bash
node tools/camping-mail-forwarding.test.mjs
```

Expected: FAIL because `parseForwardedMessage` ignores the options argument and rejects unmarked header blocks.

- [ ] **Step 3: Implement gated header-block parsing**

Change the signature to:

```js
export function parseForwardedMessage(value='',{allowHeaderBlock=false}={})
```

Keep the current marker regex. If no marker and `allowHeaderBlock` is false,
return `null`. If `allowHeaderBlock` is true, locate the first normalized line
matching one of the existing `from`, `to`, or `subject` field expressions and
scan from there. During the scan:

- strip leading `>` markers;
- ignore blank lines and localized date/sent lines until a valid `from`, `to`,
  and `subject` block has been collected;
- require both `from` and `to` to contain an address and require `subject`;
- treat the first non-header line after the completed block as body start;
- strip a common `>` prefix from returned body lines.

The returned shape remains exactly `{from,to,subject,body}` so matching and
review code do not change.

Extend `RX.unavailable` with the bounded Catalan evidence used by the real
reply, without treating the generic word `ple` alone as a rejection:

```js
|\bno puc acceptar\b|\b(?:camping|càmping)\s+(?:està|es)\s+ple\b
```

This only improves the suggested status inside manual review; it does not
permit forwarded mail to update a candidate automatically.

- [ ] **Step 4: Gate the relaxed parser in the runner**

Change `forwardedFromMail` to accept `allowHeaderBlock=false` and call:

```js
const inline=parseForwardedMessage(mail.text||'',{allowHeaderBlock});
```

In `collectInbox`, call:

```js
const forwarded=await forwardedFromMail(mail,couldBeForwarded);
```

The `couldBeForwarded` subject regex remains the outer trust gate. RFC822
attachments continue to use their structured MIME headers.

- [ ] **Step 5: Run focused mail tests**

Run:

```bash
node tools/camping-mail-forwarding.test.mjs
node tools/camping-mail-core.test.mjs
npm test --prefix cloud-mail
```

Expected: all exit 0; forwarding JSON reports `"variedFormats":true`; Gmail provider tests still report `"noSendEndpoint":true`.

- [ ] **Step 6: Commit the parser fix**

```bash
git add tools/camping-mail-forwarding.test.mjs tools/camping-mail-core.mjs cloud-mail/runner.mjs
git commit -m "Recognize varied forwarded campsite mail safely"
```

### Task 3: Restore calm venue-card hierarchy and contact cues

**Files:**
- Create: `tools/sleep-card-structure.test.mjs`
- Modify: `app.js:3339-3364`
- Modify: `styles.css:637-658`

- [ ] **Step 1: Write the failing card-structure test**

Create `tools/sleep-card-structure.test.mjs`:

```js
#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadApp} from './app-testbed.mjs';

const app=loadApp();
await new Promise(resolve=>setImmediate(resolve));
const card=app.run(`(()=>{const s=state.sleepSearches.find(x=>x.candidates.length),c=s.candidates[0],p=sleepPlace(c)||c,old={status:c.status,email:p.email,phone:p.phone,officialUrl:p.officialUrl,link:p.link,reply:c.reply};Object.assign(c,{status:'available',reply:'Ein Stellplatz ist verfügbar.'});Object.assign(p,{email:'camp@example.test',phone:'+33 1 23 45 67 89',officialUrl:'https://example.test',link:'https://maps.example.test'});const html=sleepCandidateCard(s,c);Object.assign(c,{status:old.status,reply:old.reply});Object.assign(p,{email:old.email,phone:old.phone,officialUrl:old.officialUrl,link:old.link});return html;})()`);
assert.ok(card.includes('sleep-card-contact'),'Kontaktwege besitzen eine eigene visuelle Gruppe');
assert.ok(card.includes('aria-hidden="true">✉</span>'));
assert.ok(card.includes('aria-hidden="true">☎</span>'));
assert.ok(card.includes('aria-hidden="true">⌖</span>'));
assert.ok(card.includes('sleep-answer'),'Rückmeldung bleibt innerhalb der Platzkarte');

const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.sleep-card\{[^}]*border:1px solid[^}]*border-radius:(?:9|10|11|12)px[^}]*background:/s);
assert.match(css,/\.sleep-answer\{[^}]*background:/s);
assert.match(css,/\.sleep-icon\{/);
console.log(JSON.stringify({ok:true,groupedCards:true,contactIcons:true,answerPanel:true}));
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node tools/sleep-card-structure.test.mjs
```

Expected: FAIL because current cards are flat and have no contact icon group.

- [ ] **Step 3: Add semantic icon helpers and contact cues**

In `app.js` before `sleepCandidateCard`, add:

```js
function sleepIcon(symbol){return `<span class="sleep-icon" aria-hidden="true">${symbol}</span>`;}
```

Use `sleepIcon('✉')` for draft/contact email actions and `sleepIcon('☎')` for
call actions. Build secondary links as a `.sleep-card-contact` group:

- phone: `tel:` link with `☎ Telefon` when a phone exists and call is not the
  primary action;
- website: `↗ Website`;
- map: `⌖ Karte`;
- details: `⋯ Details`.

Keep every text label and all existing status/action decisions. Do not add a
raw `mailto:` shortcut that bypasses the tailored draft flow.

- [ ] **Step 4: Apply the quiet structured card CSS**

Replace the flat card declarations with:

```css
.sleep-card{position:relative;border:1px solid rgba(255,255,255,.085);border-radius:10px;padding:13px;margin:0 0 10px;background:rgba(255,255,255,.028);overflow:hidden}
.sleep-card::before{content:'';position:absolute;inset:0 auto 0 0;width:2px;background:rgba(182,191,204,.5)}
.sleep-card.available::before,.sleep-card.reservable::before{background:#5fd4a8}.sleep-card.call::before{background:#ffb257}.sleep-card.awaiting::before,.sleep-card.reserving::before,.sleep-card.draft_requested::before{background:#54c8ff}.sleep-card.booked::before{background:#8ea8ff}.sleep-card.followup::before,.sleep-card.deposit_required::before{background:#ffd76b}.sleep-card.unavailable::before{background:#737b8d}
.sleep-card.preferred{box-shadow:0 0 0 1px rgba(255,178,87,.16)}.sleep-card.unavailable{opacity:.68}
.sleep-answer{margin-top:11px;padding:10px 11px;border:1px solid rgba(255,255,255,.065);background:rgba(0,0,0,.12);border-radius:8px}
.sleep-card-contact{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin-top:8px;min-height:24px}
.sleep-icon{display:inline-flex;align-items:center;justify-content:center;width:14px;color:currentColor;font-size:12px;line-height:1}
.sleep-link{display:inline-flex;align-items:center;gap:4px}
```

Remove the route-group bottom-border rule that previously simulated card
separation. Keep status labels as compact text/dot indicators, not pills.

- [ ] **Step 5: Run focused UI tests**

Run:

```bash
node tools/sleep-card-structure.test.mjs
node tools/sleep-recovery-safeguards.test.mjs
node tools/verify-static-app.mjs
```

Expected: all exit 0; structure JSON reports all three `true`; static verifier prints `"ok":true`.

- [ ] **Step 6: Commit the card hierarchy**

```bash
git add app.js styles.css tools/sleep-card-structure.test.mjs
git commit -m "Clarify sleep place cards and contact actions"
```

### Task 4: Full verification, mobile inspection, and live runner acceptance

**Files:**
- Modify only if a focused defect is found in Tasks 1-3.

- [ ] **Step 1: Run the full local suite**

```bash
node --test tools/*.test.mjs
node tools/verify-static-app.mjs
npm test --prefix cloud-mail
```

Expected: zero failures; mail tests retain blank signatures, read-only fetch,
draft-create-only behavior, and no send endpoint.

- [ ] **Step 2: Verify scope and schema safety**

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git diff main...HEAD -- database.rules.json map-data.js zfe-data.js
```

Expected: no whitespace errors; only planned app/CSS/test/mail-parser/docs files;
the final command is empty. Confirm `const SCHEMA_VERSION = 19` remains.

- [ ] **Step 3: Inspect the mobile UI at 375 px**

Serve the worktree with:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`, switch to Schlafplätze → Liste and Karte, and
verify at 375 px:

- venue cards have clear edges without oversized pills;
- reply panels do not visually merge;
- phone/mail/map/details labels remain readable;
- “Position fehlt” rows do not overflow;
- both map layer switches still work.

- [ ] **Step 4: Rebase/merge only after local acceptance**

Fetch `origin/main`, ensure no conflicting production changes, merge the
feature branch to `main`, and rerun Step 1 on merged `main`.

- [ ] **Step 5: Push and verify GitHub checks**

```bash
git push origin main
gh run list --branch main --limit 5
```

Expected: regression and Pages workflows complete successfully for the pushed
commit.

- [ ] **Step 6: Run the Gmail workflow once and verify read-only outcome first**

Trigger **Camping mail safety net** manually only after the parser is deployed.
Wait for success, then run:

```bash
node tools/cloud-session-check.mjs
```

Expected: the mail runner remains Gmail/cloud with no error and a manual review
item for the forwarded Font de Ferrosins response. Do not auto-resolve it or
change the campsite status during this verification step.

- [ ] **Step 7: Final handoff**

Report the exact runner result, the manual review still required for Font de
Ferrosins, and that the existing Firebase place added by Max was preserved.
