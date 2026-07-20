# Cloud Agent Context and Mail Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give fresh Codex Cloud sessions reliable, privacy-safe access to the current mailbox-derived trip status and enough durable context to avoid corrupting migrations or live data.

**Architecture:** Gmail credentials and mailbox processing remain exclusively in the existing GitHub Actions runner. A dependency-free, read-only Node command summarizes Firebase plus the latest public workflow result; durable documentation explains the two separate mail paths. Tests mock every network call and mechanically prevent schema/documentation drift.

**Tech Stack:** Static HTML/CSS/vanilla JavaScript, Node.js ESM and `node:test`, Firebase REST GET, public GitHub Actions REST GET, GitHub Actions CI.

---

## File map and scope

- Create `tools/cloud-session-check.mjs`: read-only live-status reader and formatter.
- Create `tools/cloud-session-check.test.mjs`: mocked unit tests for status, failures, and privacy.
- Create `tools/cloud-agent-context.test.mjs`: documentation/schema consistency checks.
- Create `docs/operations/CLOUD_AGENT_RUNBOOK.md`: fresh-session procedure and action boundaries.
- Modify `AGENTS.md`, `HANDOFF.md`, `README.md`, and `docs/GMAIL_CLOUD_MAIL_SETUP.md` so they describe the current system consistently.

No task changes `app.js`, `SCHEMA_VERSION`, Firebase data, Gmail contents, GitHub Secrets, or the production mail workflow.

### Task 1: Build the privacy-safe cloud status summary

**Files:**
- Create: `tools/cloud-session-check.test.mjs`
- Create: `tools/cloud-session-check.mjs`

- [ ] **Step 1: Write the failing unit tests**

Create `tools/cloud-session-check.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {extractCloudUrl,formatSummary,loadLiveStatus,summarizeState} from './cloud-session-check.mjs';

const firebaseState={
  schemaVersion:19,
  meta:{lastSaved:'2026-07-20T14:00:00.000Z'},
  mailAssistant:{runnerMode:'cloud',mailProvider:'gmail',
    reviewQueue:[{id:'r1',status:'pending',excerpt:'private reply text'}],
    draftRequests:[{id:'d1',status:'requested'},{id:'d2',status:'ready'},{id:'d3',status:'sent_detected'}],
    runners:{cloud:{lastSuccessAt:'2026-07-20T13:56:43.122Z',nextRunAt:'2026-07-20T18:00:00.000Z',lastError:''}}},
  sleepSearches:[{candidates:[{status:'awaiting'},{status:'available'}]},{candidates:[{status:'unavailable'},{status:'booked'}]}]
};

test('extractCloudUrl reads the configured Firebase URL',()=>{
  assert.equal(extractCloudUrl("let CLOUD_URL = 'https://example.firebaseio.com/private.json';"),'https://example.firebaseio.com/private.json');
  assert.throws(()=>extractCloudUrl('let CLOUD_URL = null;'),/Firebase-URL/);
});

test('summary contains counts but no message content',()=>{
  const summary=summarizeState(firebaseState,{status:'completed',conclusion:'success',created_at:'2026-07-20T13:56:23Z'});
  assert.equal(summary.schemaVersion,19);
  assert.equal(summary.mail.provider,'gmail');
  assert.equal(summary.mail.pendingReviews,1);
  assert.equal(summary.mail.pendingDrafts,2);
  assert.deepEqual(summary.accommodation.byStatus,{awaiting:1,available:1,unavailable:1,booked:1});
  assert.equal(JSON.stringify(summary).includes('private reply text'),false);
});

test('loader uses GET only and tolerates unavailable GitHub status',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push(options.method||'GET');
    if(String(url).includes('firebaseio.com'))return {ok:true,status:200,json:async()=>firebaseState};
    return {ok:false,status:403,json:async()=>({})};
  };
  const result=await loadLiveStatus({fetchImpl,firebaseUrl:'https://example.firebaseio.com/private.json',workflowUrl:'https://api.github.test/runs'});
  assert.deepEqual(calls,['GET','GET']);
  assert.match(result.warning,/GitHub-Workflowstatus/);
  assert.equal(result.summary.mail.lastSuccessAt,'2026-07-20T13:56:43.122Z');
});

test('loader fails closed when Firebase cannot be read',async()=>{
  const fetchImpl=async()=>({ok:false,status:503,json:async()=>({})});
  await assert.rejects(loadLiveStatus({fetchImpl,firebaseUrl:'https://example.firebaseio.com/private.json',workflowUrl:''}),/Firebase GET 503/);
});

test('human output omits URLs, excerpts, and credentials',()=>{
  const text=formatSummary(summarizeState(firebaseState,null),'Workflowstatus nicht verfügbar');
  assert.match(text,/Schema: 19/);
  assert.match(text,/Offene Mail-Prüfungen: 1/);
  assert.equal(text.includes('private reply text'),false);
  assert.equal(text.includes('firebaseio.com'),false);
  assert.equal(text.includes('refresh_token'),false);
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `node --test tools/cloud-session-check.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tools/cloud-session-check.mjs`.

- [ ] **Step 3: Implement the minimal read-only module**

Create `tools/cloud-session-check.mjs`:

```js
#!/usr/bin/env node
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const ROOT=new URL('../',import.meta.url);
const DEFAULT_WORKFLOW_URL='https://api.github.com/repos/492ddtym72-cyber/sizigia-roadtrip-2026/actions/workflows/camping-mail.yml/runs?branch=main&per_page=1';

export function extractCloudUrl(source){
  const url=String(source).match(/CLOUD_URL\s*=\s*'([^']+)'/)?.[1];
  if(!url)throw new Error('Firebase-URL fehlt in app.js');
  return url;
}

export function summarizeState(state={},workflow=null){
  const assistant=state.mailAssistant||{},runner=assistant.runners?.cloud||{};
  const candidates=(state.sleepSearches||[]).flatMap(search=>search.candidates||[]),byStatus={};
  for(const candidate of candidates){const status=String(candidate.status||'unknown');byStatus[status]=(byStatus[status]||0)+1;}
  return {
    schemaVersion:Number(state.schemaVersion)||null,
    lastSaved:state.meta?.lastSaved||null,
    mail:{provider:assistant.mailProvider||'unknown',mode:assistant.runnerMode||'unknown',lastSuccessAt:runner.lastSuccessAt||null,nextRunAt:runner.nextRunAt||null,lastError:runner.lastError||'',pendingReviews:(assistant.reviewQueue||[]).filter(item=>item.status!=='resolved').length,pendingDrafts:(assistant.draftRequests||[]).filter(item=>['requested','ready'].includes(item.status)).length},
    accommodation:{total:candidates.length,byStatus},
    workflow:workflow?{status:workflow.status||'unknown',conclusion:workflow.conclusion||'',createdAt:workflow.created_at||null}:null
  };
}

async function getJson(url,fetchImpl){
  const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  return {response,data:response.ok?await response.json():null};
}

export async function loadLiveStatus({fetchImpl=fetch,firebaseUrl=extractCloudUrl(fs.readFileSync(new URL('app.js',ROOT),'utf8')),workflowUrl=DEFAULT_WORKFLOW_URL}={}){
  const firebase=await getJson(firebaseUrl,fetchImpl);
  if(!firebase.response.ok)throw new Error(`Firebase GET ${firebase.response.status}`);
  let workflow=null,warning='';
  if(workflowUrl){try{const github=await getJson(workflowUrl,fetchImpl);if(github.response.ok)workflow=github.data?.workflow_runs?.[0]||null;else warning=`GitHub-Workflowstatus nicht verfügbar (${github.response.status})`;}catch(error){warning=`GitHub-Workflowstatus nicht verfügbar (${error.message})`;}}
  return {summary:summarizeState(firebase.data,workflow),warning};
}

export function formatSummary(summary,warning=''){
  const statuses=Object.entries(summary.accommodation.byStatus).sort().map(([key,value])=>`${key}: ${value}`).join(', ')||'keine';
  return ['Cloud-Status · rein lesend',`Schema: ${summary.schemaVersion??'unbekannt'}`,`Letzte App-Änderung: ${summary.lastSaved||'unbekannt'}`,`Mail: ${summary.mail.provider} · Modus ${summary.mail.mode}`,`Letzter erfolgreicher Mailcheck: ${summary.mail.lastSuccessAt||'noch keiner'}`,`Nächster Mailcheck: ${summary.mail.nextRunAt||'unbekannt'}`,`Offene Mail-Prüfungen: ${summary.mail.pendingReviews}`,`Offene Entwürfe: ${summary.mail.pendingDrafts}`,`Unterkünfte: ${summary.accommodation.total} (${statuses})`,summary.mail.lastError?`Mailfehler: ${summary.mail.lastError}`:'',summary.workflow?`Workflow: ${summary.workflow.conclusion||summary.workflow.status} · ${summary.workflow.createdAt||'Zeit unbekannt'}`:'',warning?`Hinweis: ${warning}`:''].filter(Boolean).join('\n');
}

async function main(){const result=await loadLiveStatus();console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):formatSummary(result.summary,result.warning));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(`Cloud-Status fehlgeschlagen: ${error.message}`);process.exitCode=1;});
```

- [ ] **Step 4: Run the focused tests**

Run: `node --test tools/cloud-session-check.test.mjs`

Expected: 5 tests pass; mocked calls show GET only.

- [ ] **Step 5: Commit**

```bash
git add tools/cloud-session-check.mjs tools/cloud-session-check.test.mjs
git commit -m "Add privacy-safe cloud session status check"
```

### Task 2: Pin the durable agent contract with a drift test

**Files:**
- Create: `tools/cloud-agent-context.test.mjs`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write the failing consistency test**

Create `tools/cloud-agent-context.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const app=fs.readFileSync(new URL('app.js',root),'utf8');
const agents=fs.readFileSync(new URL('AGENTS.md',root),'utf8');
const readme=fs.readFileSync(new URL('README.md',root),'utf8');
const handoff=fs.readFileSync(new URL('HANDOFF.md',root),'utf8');
const schema=app.match(/const SCHEMA_VERSION = (\d+);/)?.[1];

test('agent guidance names actual schema and live sources',()=>{
  assert.ok(schema);
  assert.match(agents,new RegExp(`Schema(?:-Version)?[^\\r\\n]*${schema}`,'i'));
  assert.match(agents,/Firebase[^\r\n]+aktuell|aktuell[^\r\n]+Firebase/i);
  assert.match(agents,/Mailantworten[^\r\n]+keine Migration|keine Migration[^\r\n]+Mailantworten/i);
});
test('active Gmail runner and runbook are documented',()=>{
  assert.match(agents,/GitHub Actions[^\r\n]+Gmail|Gmail[^\r\n]+GitHub Actions/i);
  assert.match(agents,/docs\/operations\/CLOUD_AGENT_RUNBOOK\.md/);
  assert.doesNotMatch(agents,/cloud-mail\/[^\r\n]*deaktiviert/i);
});
test('verification commands match CI',()=>{
  assert.match(agents,/node --test tools\/\*\.test\.mjs/);
  assert.match(agents,/node tools\/verify-static-app\.mjs/);
  assert.match(agents,/npm test --prefix cloud-mail/);
});
test('public docs describe the hosted current architecture',()=>{
  assert.match(readme,/github\.io\/sizigia-roadtrip-2026/);
  assert.match(readme,/Firebase/);
  assert.match(handoff,/MAIL_PROVIDER=gmail/);
  assert.doesNotMatch(handoff,/lokale Codex-Automation prüft[^\r\n]+iCloud/i);
});
```

- [ ] **Step 2: Run it and confirm the stale docs fail**

Run: `node --test tools/cloud-agent-context.test.mjs`

Expected: FAIL because `AGENTS.md` says schema 17, describes `cloud-mail/` as disabled, and omits the runbook.

- [ ] **Step 3: Rewrite `AGENTS.md` as the concise current contract**

Retain the existing static/file protocol, German UI, mobile-first, escaping,
persistence, migration, map, changelog, and service-worker rules. Set schema 19,
describe `cloud-mail/` as the active GitHub/Gmail runner, link the runbook, and
add exactly these source rules:

```markdown
## Quellen der Wahrheit

- GitHub `main`: Code, Schema, Tests und dauerhafte Betriebsregeln.
- Firebase: aktueller geteilter Reise-, Unterkunfts- und Antwortstand.
- Gmail: vollständige Nachrichten und Threads.
- GitHub Actions: laptopunabhängiger Gmail-Runner und ungesendete Entwürfe.
- `localStorage`: gerätespezifische Offlinewerte und UI-Präferenzen.

Mailantworten, Preise, Versand- und Buchungsstatus sind Live-Daten in Firebase
und keine Migration. `SCHEMA_VERSION` nur bei einer dauerhaften
Strukturänderung erhöhen. Live-Antworten nie als Seed nach `app.js` kopieren.
```

Document the blank name line, six adults, one camper, one small car, flexible
one-night windows, explicit-confirmation booking rule, and the two mail paths.
Replace the obsolete manual-only verification section with:

```bash
node --test tools/*.test.mjs
node tools/verify-static-app.mjs
npm test --prefix cloud-mail
```

Also instruct cloud sessions to run `node tools/cloud-session-check.mjs` first.

- [ ] **Step 4: Run the focused consistency test**

Run: `node --test tools/cloud-agent-context.test.mjs`

Expected: AGENTS assertions pass; README/HANDOFF assertions remain red until Task 4.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md tools/cloud-agent-context.test.mjs
git commit -m "Pin cloud agent source-of-truth rules"
```

### Task 3: Add the fresh-session operations runbook

**Files:**
- Create: `docs/operations/CLOUD_AGENT_RUNBOOK.md`
- Modify: `docs/GMAIL_CLOUD_MAIL_SETUP.md`

- [ ] **Step 1: Create the runbook with executable procedures**

The runbook must include these exact operational sequences:

```markdown
# Codex-Cloud-Runbook

## Start jeder neuen Sitzung
1. `AGENTS.md` und den aktuellen Teil von `HANDOFF.md` lesen.
2. `git status --short --branch` und `git log -5 --oneline` prüfen.
3. `node tools/cloud-session-check.mjs` ausführen.
4. Ohne lesbaren Firebase-Stand keine aktuellen Unterkunfts- oder Mailstatus
   behaupten und keine Live-Daten in Seeds oder Migrationen kopieren.
5. Vor Änderungen betroffene Tests lesen; danach die vollständige Verifikation
   aus `AGENTS.md` ausführen.

## Wenn sofort neue Mail geprüft werden muss
1. Auf dem Telefon ChatGPT mit dem Gmail-Plugin verwenden; oder
2. auf GitHub `Actions → Camping mail safety net → Run workflow` auslösen;
3. nach erfolgreichem Lauf den Cloud-Statuscheck erneut ausführen.
```

Add sections explaining the two mail paths, the authorization matrix, missing
`gh`/remote fallback, missing connector behavior, delayed workflows, Firebase
failure, ambiguous replies, forbidden mail-derived schema bumps, and the fact
that a repository cannot force the Codex Cloud model.

- [ ] **Step 2: Mark Gmail cloud mode as the active setup**

Add this block to `docs/GMAIL_CLOUD_MAIL_SETUP.md`:

```markdown
> **Aktiver Stand (20.07.2026):** `MAIL_PROVIDER=gmail` und
> `MAIL_RUNNER_MODE=cloud` sind aktiv. Der zeitgesteuerte GitHub-Runner ist der
> laptopunabhängige Hintergrundweg. Der separat verbundene ChatGPT-Gmail-
> Connector dient vollständigen, interaktiven Mailanalysen und teilt seine
> Autorisierung nicht mit Codex-Cloud-Containern.
```

Keep the OAuth setup as recovery documentation. Do not expose token values.

- [ ] **Step 3: Verify links and absence of credentials**

```bash
rg -n "CLOUD_AGENT_RUNBOOK|MAIL_PROVIDER=gmail|MAIL_RUNNER_MODE=cloud" AGENTS.md docs/operations/CLOUD_AGENT_RUNBOOK.md docs/GMAIL_CLOUD_MAIL_SETUP.md
rg -n "GMAIL_REFRESH_TOKEN=|client_secret.*:" docs/operations AGENTS.md
```

Expected: current-state references are found; the credential-value search has no output.

- [ ] **Step 4: Commit**

```bash
git add docs/operations/CLOUD_AGENT_RUNBOOK.md docs/GMAIL_CLOUD_MAIL_SETUP.md
git commit -m "Add cloud agent operations runbook"
```

### Task 4: Align README and HANDOFF

**Files:**
- Modify: `README.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Make README a neutral hosted-app entry**

Start with:

```markdown
# Roadtrip · gemeinsamer Reiseplaner

Mobile-first Reiseplaner für eine sechsköpfige Gruppe auf dem Weg zum Sizigia
Eclipse Gathering 2026. Die App bleibt grundsätzlich für andere Gruppenreisen
weiterentwickelbar.

**Live-App:** https://492ddtym72-cyber.github.io/sizigia-roadtrip-2026/

Die gehostete App synchronisiert den geteilten Stand über Firebase und bleibt
dank Service Worker und lokaler Speicherung auch bei Funklöchern nutzbar. Der
statische `file://`-Start bleibt ein technischer Offline-Rückfall.
```

Describe cloud sync, local snapshots/export, the active Gmail runner, and links
to `AGENTS.md` and the runbook. Remove the old backup-file sharing as the primary
workflow.

- [ ] **Step 2: Correct the current HANDOFF section**

State schema V19, `MAIL_PROVIDER=gmail`, `MAIL_RUNNER_MODE=cloud`, GitHub-hosted
laptop-independent processing, and iCloud as recovery only. Remove claims that
the local Mac is primary or that OAuth/shadow activation is pending. Move long
migration narratives below an explicit history heading. Do not copy current
campsite replies or availability into this operations document.

- [ ] **Step 3: Run the consistency test**

Run: `node --test tools/cloud-agent-context.test.mjs`

Expected: all four tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md HANDOFF.md
git commit -m "Align roadtrip cloud operations documentation"
```

### Task 5: Complete live read-only acceptance and regression verification

**Files:**
- Modify only if a focused defect is found in files introduced by Tasks 1–4.

- [ ] **Step 1: Run all automated tests**

```bash
node --test tools/*.test.mjs
node tools/verify-static-app.mjs
npm test --prefix cloud-mail
```

Expected: all tests pass; static verification prints `"ok":true`; mail tests
confirm read-only fetch, draft-create-only behavior, blank signature, and no send endpoint.

- [ ] **Step 2: Run the live read-only status command**

Run: `node tools/cloud-session-check.mjs`

Expected: exit 0 with schema 19, provider Gmail, cloud mode, last successful mail
check, review/draft counts, and accommodation counts. No URL, credential, body,
or reply excerpt appears.

- [ ] **Step 3: Check machine-readable output**

Run: `node tools/cloud-session-check.mjs --json`

Expected: valid JSON containing only `summary` and an optional `warning`.

- [ ] **Step 4: Prove production scope stayed untouched**

```bash
git diff --stat HEAD~4..HEAD
git diff HEAD~4..HEAD -- app.js .github/workflows/camping-mail.yml cloud-mail/
```

Expected: planned tools/docs only; the second command is empty.

- [ ] **Step 5: Commit a focused correction only if verification found one**

```bash
git add tools/cloud-session-check.mjs tools/cloud-session-check.test.mjs tools/cloud-agent-context.test.mjs AGENTS.md README.md HANDOFF.md docs/operations/CLOUD_AGENT_RUNBOOK.md docs/GMAIL_CLOUD_MAIL_SETUP.md
git commit -m "Fix cloud session context verification"
```

Do not create an empty commit when no correction was needed.

- [ ] **Step 6: Push only after all verification is green**

Run: `git push origin HEAD:main`

Expected: push succeeds, regression CI passes, and the app runtime remains unchanged.
