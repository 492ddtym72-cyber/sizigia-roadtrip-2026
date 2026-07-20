// Regression: Message-ID-Idempotenz der Mail-Automation (Audit-Finding 6,
// Fix in 47c0423) — Bridge und Cloud-Runner werden aus dem echten Quelltext
// extrahiert und gegen einen Firebase-Mock (kein Netz) getestet.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {messageFingerprint, safeExcerpt} from './camping-mail-core.mjs';

function extract(source, name){
  let start = source.indexOf(`async function ${name}(`);
  if(start === -1) start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name}() fehlt im Quelltext`);
  let depth = 0, end = -1;
  for(let i = source.indexOf('{', start); i < source.length; i++){
    if(source[i] === '{') depth++;
    if(source[i] === '}' && --depth === 0){ end = i + 1; break; }
  }
  assert.ok(end > start, `${name}() konnte nicht gelesen werden`);
  return source.slice(start, end);
}

function baseState(){
  return {
    meta:{lastSaved:'2026-07-12T10:00:00.000Z'},
    sleepPlaces:[{id:'p1', name:'Camping Test', email:'info@test.example', contactVerified:false}],
    sleepSearches:[{id:'s1', dateLabel:'02.–03.08.2026', candidates:[
      {id:'c1', placeId:'p1', name:'Camping Test', status:'awaiting', reply:''}
    ]}],
    mailAssistant:{processedMessageIds:['<already@done>'], draftRequests:[], reviewQueue:[], runners:{}},
    log:[]
  };
}

/* ---------- Bridge (tools/camping-mail-bridge.mjs) ---------- */
const bridgeSrc = fs.readFileSync(new URL('camping-mail-bridge.mjs', import.meta.url), 'utf8');

// Firebase-Mock: GET liefert den Serverstand + ETag; PUT kann pro Test
// gezielt mit 412 (Konflikt) antworten und zählt alle Schreibversuche.
function makeBridge(server){
  const calls = {get:0, put:0, putBodies:[]};
  const sandbox = {
    Buffer, Date, JSON, console, Math,
    CLOUD_URL:'mock://planner.json',
    fetch: async (url, opts = {}) => {
      if((opts.method || 'GET') === 'GET' || !opts.method){
        calls.get++;
        return {ok:true, status:200, json:async()=>JSON.parse(JSON.stringify(server.state)), headers:{get:()=>String(server.etag)}};
      }
      calls.put++;
      if(server.rejectPuts > 0){
        server.rejectPuts--;
        if(server.onConflict) server.onConflict();
        return {ok:false, status:412, headers:{get:()=>String(server.etag)}};
      }
      assert.equal(opts.headers['if-match'], String(server.etag), 'PUT muss if-match mit aktuellem ETag senden');
      server.state = JSON.parse(opts.body);
      calls.putBodies.push(server.state);
      server.etag++;
      return {ok:true, status:200, headers:{get:()=>String(server.etag)}};
    }
  };
  vm.createContext(sandbox);
  for(const name of ['getState', 'nextStamp', 'nextRunStamp', 'conditionalUpdate', 'locate', 'applyEvents'])
    vm.runInContext(extract(bridgeSrc, name), sandbox);
  const encode = events => Buffer.from(JSON.stringify(events)).toString('base64url');
  return {calls, apply: events => vm.runInContext('applyEvents', sandbox)(encode(events))};
}

// 1) Bereits verarbeitete Message-ID: Kandidat wird nicht erneut geändert,
//    kein Log-Eintrag, kein Schreibversuch.
{
  const server = {state:baseState(), etag:7, rejectPuts:0};
  const bridge = makeBridge(server);
  await bridge.apply([{searchId:'s1', candidateId:'c1', messageId:'<already@done>', status:'available', reply:'Doppelt.'}]);
  assert.equal(server.state.sleepSearches[0].candidates[0].status, 'awaiting', 'verarbeitete Message-ID darf Status nicht ändern');
  assert.equal(server.state.log.length, 0, 'verarbeitete Message-ID darf keinen Log-Eintrag erzeugen');
  assert.equal(bridge.calls.put, 0, 'ohne Änderung darf nicht geschrieben werden');
}

// 2) Neue Message-ID wird genau einmal angewandt (Status, Log, Dedup-Liste).
{
  const server = {state:baseState(), etag:1, rejectPuts:0};
  const bridge = makeBridge(server);
  await bridge.apply([{searchId:'s1', candidateId:'c1', messageId:'<fresh@mail>', status:'available', reply:'Platz frei.'}]);
  const c = server.state.sleepSearches[0].candidates[0];
  assert.equal(c.status, 'available');
  assert.equal(server.state.log.length, 1, 'genau ein Log-Eintrag');
  assert.equal(server.state.mailAssistant.processedMessageIds.filter(x=>x==='<fresh@mail>').length, 1);
  assert.equal(bridge.calls.put, 1);
}

// 3) 412-Konflikt: ein konkurrierender Schreiber hat dieselbe Message-ID
//    inzwischen verarbeitet — der Retry darf sie NICHT erneut anwenden
//    und keinen doppelten Log-Eintrag erzeugen.
{
  const server = {state:baseState(), etag:1, rejectPuts:1};
  server.onConflict = () => {
    // Simulierter fremder Schreiber: wendet <fresh@mail> an und ändert danach den Status manuell.
    server.state.mailAssistant.processedMessageIds.push('<fresh@mail>');
    server.state.sleepSearches[0].candidates[0].status = 'reserving';
    server.state.log.push({id:'other-writer', who:'Mail-Assistent', desc:'hat die Antwort von „Camping Test“ ausgewertet', undo:null});
    server.etag++;
  };
  const bridge = makeBridge(server);
  await bridge.apply([{searchId:'s1', candidateId:'c1', messageId:'<fresh@mail>', status:'available', reply:'Platz frei.'}]);
  assert.equal(server.state.sleepSearches[0].candidates[0].status, 'reserving',
    '412-Retry darf den zwischenzeitlichen (manuellen) Status nicht überschreiben');
  assert.equal(server.state.log.filter(x=>x.who==='Mail-Assistent').length, 1,
    '412-Retry darf keinen doppelten Log-Eintrag erzeugen');
  assert.equal(bridge.calls.put, 1, 'nach dem Skip darf kein zweiter PUT folgen');
}

// 4) Doppelte Review-Einträge (gleiche ID) werden nicht angelegt — weder in
//    einem Aufruf noch über zwei Aufrufe hinweg.
{
  const server = {state:baseState(), etag:1, rejectPuts:0};
  const bridge = makeBridge(server);
  const item = {id:messageFingerprint('<review@mail>'), searchId:'s1', candidateId:'c1', excerpt:'Unklar.', status:'pending'};
  await bridge.apply([{reviewItem:item}, {reviewItem:item}]);
  await bridge.apply([{reviewItem:item}]);
  assert.equal(server.state.mailAssistant.reviewQueue.length, 1, 'Review-Duplikate müssen dedupliziert werden');
}

// 5) Doppelte Entwurfsanfragen (gleiche ID) werden nicht angelegt.
{
  const server = {state:baseState(), etag:1, rejectPuts:0};
  const bridge = makeBridge(server);
  const req = {id:'req-1', searchId:'s1', candidateId:'c1', template:'inquiry', status:'requested'};
  await bridge.apply([{draftRequest:req}, {draftRequest:req}]);
  await bridge.apply([{draftRequest:req}]);
  assert.equal(server.state.mailAssistant.draftRequests.length, 1, 'Entwurfs-Duplikate müssen dedupliziert werden');
}

// 6) Aktiver Cloud-Lease: lokales Anwenden bricht sicher ab (keine Doppelverarbeitung).
{
  const server = {state:baseState(), etag:1, rejectPuts:0};
  server.state.mailAssistant.lease = {owner:'github-123', expiresAt:new Date(Date.now()+600000).toISOString()};
  const bridge = makeBridge(server);
  await assert.rejects(
    () => bridge.apply([{searchId:'s1', candidateId:'c1', messageId:'<during-lease>', status:'available'}]),
    /Cloud-Mail-Check läuft/,
    'unter fremdem Lease muss apply abbrechen');
  assert.equal(server.state.sleepSearches[0].candidates[0].status, 'awaiting');
  assert.equal(bridge.calls.put, 0);
}

/* ---------- Cloud-Runner (cloud-mail/runner.mjs) ---------- */
// Der Runner importiert imapflow/mailparser; für den Test wird nur
// applyEvents + Umfeld aus dem Quelltext extrahiert (kein IMAP, kein Netz).
const runnerSrc = fs.readFileSync(new URL('../cloud-mail/runner.mjs', import.meta.url), 'utf8');

function makeRunner(state, mode = 'cloud'){
  const sandbox = {
    Date, JSON, console, Math, crypto,
    mode,
    messageFingerprint, safeExcerpt,
    nowIso: () => '2026-07-12T12:00:00.000Z',
    cleanHeader: value => String(value||'').replace(/[\r\n]+/g,' ').trim(),
    syncDerived: () => {},
    updateState: async mutator => { mutator(state); return state; },
  };
  vm.createContext(sandbox);
  for(const name of ['assistant', 'locate', 'logMailChange', 'applyEvents'])
    vm.runInContext(extract(runnerSrc, name), sandbox);
  return events => vm.runInContext('applyEvents', sandbox)(events);
}

// 7) Runner: bereits verarbeitete Message-ID wird im Mutator übersprungen
//    (auch beim Retry nach Konflikt läuft der Mutator erneut — er darf nichts doppeln).
{
  const state = baseState();
  const apply = makeRunner(state);
  const event = {searchId:'s1', candidateId:'c1', messageId:'<runner@mail>', receivedAt:'2026-07-12T11:00:00.000Z', subject:'Re: Anfrage', result:{status:'available', summary:'Frei.', replyQuote:'', nextAction:'', excerpt:''}};
  await apply([event]);
  state.sleepSearches[0].candidates[0].status = 'reserving'; // manuelle Änderung dazwischen
  await apply([event]); // zweiter Lauf mit identischem Event (z. B. Retry)
  assert.equal(state.sleepSearches[0].candidates[0].status, 'reserving', 'Runner darf verarbeitete Message-ID nicht erneut anwenden');
  assert.equal(state.log.length, 1, 'Runner darf keinen doppelten Log-Eintrag erzeugen');
  assert.equal(state.mailAssistant.processedMessageIds.filter(x=>x==='<runner@mail>').length, 1);
}

// 8) Runner: dieselbe Review-Nachricht zweimal ⇒ genau ein Review-Eintrag, ein Log-Eintrag.
{
  const state = baseState();
  const apply = makeRunner(state);
  const event = {searchId:'s1', candidateId:'c1', messageId:'<odd@mail>', receivedAt:'2026-07-12T11:00:00.000Z', subject:'??', result:{status:'review', summary:'', replyQuote:'', nextAction:'', excerpt:'Unklarer Text.'}};
  await apply([event]);
  await apply([event]);
  assert.equal(state.mailAssistant.reviewQueue.length, 1, 'Review-Queue darf nicht doppeln');
  assert.equal(state.log.length, 1, 'Review-Log darf nicht doppeln');
}

// 9) Runner: Shadow-Diagnose bleibt kurz, idempotent und verändert keinen Status.
{
  const state = baseState();
  const apply = makeRunner(state, 'shadow');
  const processedBefore = [...state.mailAssistant.processedMessageIds];
  const event = {searchId:'s1', candidateId:'c1', messageId:'<shadow@mail>', receivedAt:'2026-07-12T11:00:00.000Z', subject:'Re: Anfrage', result:{status:'available', summary:'Ein Stellplatz ist frei.', replyQuote:'We have a pitch available.', nextAction:'Angebot prüfen', excerpt:'We have a pitch available. '+'.'.repeat(800)}};
  await apply([event]);
  await apply([{...event,result:{...event.result,status:'review',summary:'Bitte manuell prüfen.'}}]);
  assert.equal(state.sleepSearches[0].candidates[0].status, 'awaiting', 'Shadow-Modus darf den fachlichen Status nicht ändern');
  assert.deepEqual(state.mailAssistant.processedMessageIds, processedBefore, 'Shadow-Modus darf Nachrichten nicht als verarbeitet markieren');
  assert.equal(state.mailAssistant.shadowResults.length, 1, 'Shadow-Diagnose muss per Message-ID idempotent bleiben');
  assert.equal(state.mailAssistant.shadowResults[0].predictedStatus, 'review', 'erneute Shadow-Auswertung muss die bestehende Diagnose aktualisieren');
  assert.equal(state.mailAssistant.shadowResults[0].summary, 'Bitte manuell prüfen.');
  assert.ok(state.mailAssistant.shadowResults[0].excerpt.length<=501, 'Shadow-Auszug muss kurz und datensparsam bleiben');
  assert.ok(state.mailAssistant.shadowResults[0].replyQuote.length<=361, 'Shadow-Zitat muss kurz und datensparsam bleiben');
}

// 10) Runner: Sent-Erkennung befördert eine Anfrage genau einmal.
{
  const state = baseState();
  state.sleepSearches[0].candidates[0].status = 'new'; // echter Übergang new → awaiting
  state.mailAssistant.draftRequests = [{id:'req-9', searchId:'s1', candidateId:'c1', template:'inquiry', status:'ready', createdAt:'2026-07-12T09:00:00.000Z'}];
  const apply = makeRunner(state);
  const sent = {type:'sent', requestId:'req-9', searchId:'s1', candidateId:'c1', sentAt:'2026-07-12T11:30:00.000Z'};
  await apply([sent]);
  const first = JSON.stringify(state.sleepSearches[0].candidates[0]) + state.mailAssistant.draftRequests[0].status;
  assert.equal(state.mailAssistant.draftRequests[0].status, 'sent_detected');
  assert.equal(state.sleepSearches[0].candidates[0].status, 'awaiting');
  await apply([sent]); // zweite Zustellung desselben Sent-Events
  const second = JSON.stringify(state.sleepSearches[0].candidates[0]) + state.mailAssistant.draftRequests[0].status;
  assert.equal(second, first, 'Sent-Erkennung darf nur einmal befördern');
  assert.equal(state.log.length, 1, 'Sent-Erkennung darf nur einmal loggen');
}

// 11) Runner: ein bereits beim aktiven Mail-Provider angelegter Entwurf wird
//     nach einem unterbrochenen Lauf erkannt und nicht ein zweites Mal angelegt.
{
  const state = baseState();
  state.mailAssistant.draftRequests = [{id:'req-draft-retry', searchId:'s1', candidateId:'c1', template:'inquiry', status:'requested'}];
  state.sleepSearches[0].candidates[0].email = 'camp@example.com';
  const sandbox = {
    crypto,
    mode:'cloud',
    nowIso:()=> '2026-07-12T12:00:00.000Z',
    cleanHeader:value=>String(value||'').replace(/[\r\n]+/g,' ').trim(),
    draftBody:()=> 'Kind regards,\n\n',
    draftSubject:()=> 'Test subject',
    rawDraft:()=> Buffer.from('draft')
  };
  vm.createContext(sandbox);
  for(const name of ['assistant','locate','draftMessageId','createDrafts'])
    vm.runInContext(extract(runnerSrc,name),sandbox);
  const id = vm.runInContext("draftMessageId('req-draft-retry')",sandbox);
  let appends = 0;
  const mailbox={email:'a@example.com',list:async kind=>kind==='drafts'?[{messageId:id}]:[],appendDraft:async()=>{appends++;}};
  const events = await vm.runInContext('createDrafts',sandbox)(mailbox,state);
  assert.equal(appends,0,'vorhandener deterministischer Entwurf darf nicht erneut angehängt werden');
  assert.equal(events.length,1,'vorhandener Entwurf muss den Status trotzdem auf bereit bringen');
  assert.equal(events[0].requestId,'req-draft-retry');
}

console.log(JSON.stringify({ok:true, bridgeCases:6, runnerCases:5, firebaseMocked:true}));
