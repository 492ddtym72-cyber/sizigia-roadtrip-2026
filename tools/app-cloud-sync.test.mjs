// Regression: Konfliktschutz der App-Cloud-Sync-Engine (Audit-Findings 4+5,
// Fix in 47c0423) — echtes app.js im vm-Testbed, fetch vollständig gemockt,
// keine echten Firebase-Zugriffe.
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

// Steuerbares Firebase-Mock: Skript aus GET/PUT-Antworten, zeichnet alle Aufrufe auf.
function makeCloud(){
  const calls = [];
  const script = [];
  const fetchImpl = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({method, headers:opts.headers || {}, body:opts.body});
    const step = script.shift();
    if(!step) throw new Error('unerwarteter ' + method + '-Aufruf');
    assert.equal(method, step.expect, 'Aufruf-Reihenfolge: erwartet ' + step.expect + ', bekam ' + method);
    if(step.status === 412) return {ok:false, status:412, json:async()=>null, headers:{get:()=>step.etag || ''}};
    return {ok:true, status:200, json:async()=>step.remote ?? null, headers:{get:()=>step.etag || ''}};
  };
  return {calls, script, fetchImpl};
}

async function freshApp(cloud){
  const app = loadApp({fetchImpl: async () => { throw new Error('offline'); }});
  // Den Boot-Sync (offline) zu Ende laufen lassen, sonst blockiert _syncing.
  await new Promise(r => setImmediate(r));
  assert.equal(app.run('_syncing'), false, 'Boot-Sync muss abgeschlossen sein');
  // Spione setzen und Firebase-Mock aktivieren.
  app.run('var _statuses=[]; setSyncStatus = s => _statuses.push(s);');
  app.run('var _snaps=[]; takeSnapshot = r => _snaps.push(r);');
  app.run('var _toasts=[]; toast = (m) => _toasts.push(String(m));');
  app.sandbox.fetch = cloud.fetchImpl;
  return app;
}

// 1+2) GET fragt nach ETag, PUT sendet if-match mit genau diesem ETag.
{
  const cloud = makeCloud();
  cloud.script.push({expect:'GET', remote:null, etag:'etag-A'});
  cloud.script.push({expect:'PUT', etag:'etag-A'});
  const app = await freshApp(cloud);
  app.run('_virgin=false;');
  await app.run('syncNow()');
  const get = cloud.calls[0], put = cloud.calls[1];
  assert.equal(get.method, 'GET');
  assert.equal(get.headers['X-Firebase-ETag'], 'true', 'GET muss X-Firebase-ETag anfordern');
  assert.equal(put.method, 'PUT');
  assert.equal(put.headers['if-match'], 'etag-A', 'PUT muss if-match mit dem GET-ETag senden');
  assert.ok(JSON.parse(put.body).meta.lastSaved, 'PUT-Body muss der komplette Zustand sein');
  assert.equal(app.run('_statuses.at(-1)'), 'ok');
}

// 3) 412 ⇒ erneuter GET (frischer ETag) und Retry-PUT mit dem neuen ETag.
{
  const cloud = makeCloud();
  cloud.script.push({expect:'GET', remote:null, etag:'e1'});
  cloud.script.push({expect:'PUT', status:412});
  cloud.script.push({expect:'GET', remote:null, etag:'e2'});
  cloud.script.push({expect:'PUT', etag:'e2'});
  const app = await freshApp(cloud);
  app.run('_virgin=false;');
  await app.run('syncNow()');
  assert.equal(cloud.calls.length, 4, '412 muss GET+PUT-Retry auslösen');
  assert.equal(cloud.calls[3].headers['if-match'], 'e2', 'Retry-PUT muss den NEUEN ETag verwenden');
  assert.equal(app.run('_statuses.at(-1)'), 'ok');
}

// 4) Drei Konflikte in Folge ⇒ Fehler („offline“), niemals Erfolgsmeldung.
{
  const cloud = makeCloud();
  for(let i = 0; i < 3; i++){
    cloud.script.push({expect:'GET', remote:null, etag:'e' + i});
    cloud.script.push({expect:'PUT', status:412});
  }
  const app = await freshApp(cloud);
  app.run('_virgin=false;');
  await app.run('syncNow()');
  assert.equal(cloud.calls.filter(c=>c.method==='PUT').length, 3, 'genau drei Schreibversuche');
  assert.equal(app.run('_statuses.at(-1)'), 'offline', 'nach drei Konflikten darf kein „ok“ gemeldet werden');
  assert.ok(!app.run('_statuses').slice(1).includes('ok'), 'kein Erfolgsstatus nach dem Start des Syncs');
}

// 5) Konkurrierender NEUERER Fremdstand nach 412 wird übernommen statt
//    blind überschrieben (inkl. Sicherung des ungepushten lokalen Stands).
{
  const cloud = makeCloud();
  const app = await freshApp(cloud);
  app.run('_virgin=false; _lastPushed=null;');
  const localTs = app.run('state.meta.lastSaved');
  const newerTs = '2099-01-01T00:00:00.000Z';
  const remote = {meta:{lastSaved:newerTs}, crew:[{id:'c-x', name:'X', color:'#fff'}], selectedRoute:'r1', routes:[{id:'r1', emoji:'🌊', name:'R', desc:'', stages:[]}], regressionMarker:'from-remote'};
  cloud.script.push({expect:'GET', remote:null, etag:'e1'});
  cloud.script.push({expect:'PUT', status:412});
  cloud.script.push({expect:'GET', remote, etag:'e2'});
  await app.run('syncNow()');
  assert.equal(cloud.calls.filter(c=>c.method==='PUT').length, 1, 'nach neuerem Fremdstand darf kein weiterer PUT folgen');
  assert.equal(app.run('state.regressionMarker'), 'from-remote', 'neuerer Fremdstand muss übernommen werden');
  assert.equal(app.run('state.meta.lastSaved') >= newerTs, true, 'Zeitstempel des Fremdstands muss erhalten bleiben');
  assert.ok(app.run('_snaps').includes('Vor Cloud-Übernahme'), 'ungepushter lokaler Stand muss vorher gesichert werden');
  assert.ok(localTs < newerTs, 'Testaufbau: lokaler Stand war älter');
  assert.equal(app.run('_statuses.at(-1)'), 'ok');
}

// 6) Frisches Gerät (_virgin) mit lokalen Vor-Sync-Änderungen: Snapshot VOR
//    der Cloud-Übernahme (Audit-Finding 5).
{
  const cloud = makeCloud();
  const app = await freshApp(cloud);
  app.run('_virgin=true;');
  assert.ok(app.run('state.meta.lastSaved'), 'Testaufbau: lokale Änderungen existieren (lastSaved gesetzt)');
  const remote = {meta:{lastSaved:'2026-07-01T00:00:00.000Z'}, crew:[{id:'c-x', name:'X', color:'#fff'}], selectedRoute:'r1', routes:[{id:'r1', emoji:'🌊', name:'R', desc:'', stages:[]}], regressionMarker:'group-state'};
  cloud.script.push({expect:'GET', remote, etag:'g1'});
  await app.run('syncNow()');
  assert.ok(app.run('_snaps').includes('Vor Cloud-Übernahme'), 'frisches Gerät muss lokale Edits als Snapshot sichern');
  assert.equal(app.run('state.regressionMarker'), 'group-state', 'Cloud-Stand muss trotzdem gewinnen (kein Überschreiben der Gruppe)');
  assert.equal(cloud.calls.filter(c=>c.method==='PUT').length, 0, 'frisches Gerät darf die Gruppe nicht überschreiben');
  assert.equal(app.run('_virgin'), false);
}

console.log(JSON.stringify({ok:true, etagOnGet:true, ifMatchOnPut:true, retryOn412:true, failAfter3:true, remoteNotClobbered:true, virginSnapshot:true}));
