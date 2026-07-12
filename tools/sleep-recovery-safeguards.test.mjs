// Regression: Wiederherstellungs- und Anzeige-Schutzmechanismen des
// Schlafplatz-Radars (Audit-Findings 8–13, Fix in 47c0423) — echtes app.js
// im vm-Testbed (kein Netz, kein Browser).
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

// Ein App-Kontext für alle Anzeige-Tests: erster Start, offline, leerer Speicher.
const app = loadApp();
await new Promise(r => setImmediate(r));

// 1) Erster Offline-Start: alle sieben Camping-Korridore sind SOFORT gesät
//    (kein Reload nötig), inklusive aller 28 Kandidaten.
assert.equal(app.run('state.sleepSearches.length'), 7, 'sieben Korridore beim ersten Start');
assert.equal(app.run('state.sleepSearches.reduce((n,s)=>n+s.candidates.length,0)'), 28, '28 Kandidaten beim ersten Start');
assert.equal(app.run('state.sleepSearches.every(s=>s.mode==="network")'), true);
assert.equal(app.run('state.meta.campingNetworkSeeded'), true);
assert.equal(app.run('new Set(state.sleepSearches.map(s=>s.networkKey)).size'), 7, 'Korridore eindeutig');

// 2) „Bestätigt“ (booked) erscheint auf der Karte — in beiden Karten-Modi.
{
  const marked = app.run(`(()=>{
    const s = state.sleepSearches.find(x=>x.candidates.length);
    const c = s.candidates[0];
    const place = sleepPlace(c) || c;
    const prev = {status:c.status, lat:place.lat, lng:place.lng};
    c.status = 'booked'; place.lat = 43.0; place.lng = 5.0;
    const night = (buildSleepMap(s, []).match(/map-pt/g) || []).length;
    sleepMapScope = 'route';
    const route = (buildSleepMap(s, []).match(/map-pt/g) || []).length;
    sleepMapScope = 'night';
    c.status = prev.status; place.lat = prev.lat; place.lng = prev.lng;
    return {night, route};
  })()`);
  assert.ok(marked.night >= 1, 'booked muss auf „Diese Nacht“ erscheinen');
  assert.ok(marked.route >= 1, 'booked muss auf „Gesamte Route“ erscheinen');
}

// 3) „Nicht verfügbar“ (unavailable) bleibt aus operativen Ansichten und der
//    Karte heraus und erscheint NUR unter „Absagen“.
{
  const vis = app.run(`(()=>{
    const probe = {status:'unavailable'};
    const out = {};
    for(const f of ['action','waiting','closed']){ sleepFilter = f; out[f] = sleepVisible(probe); }
    sleepFilter = 'closed';
    const closedShowsAvailable = sleepVisible({status:'available'});
    sleepFilter = 'action';
    return {...out, closedShowsAvailable};
  })()`);
  assert.equal(vis.action, false, 'unavailable darf nicht unter „Echte Optionen“ erscheinen');
  assert.equal(vis.waiting, false, 'unavailable darf nicht unter „Offene Anfragen“ erscheinen');
  assert.equal(vis.closed, true, 'unavailable muss unter „Absagen“ erscheinen');
  assert.equal(vis.closedShowsAvailable, false, '„Absagen“ zeigt nur Absagen');
  const mapCount = app.run(`(()=>{
    const s = state.sleepSearches.find(x=>x.candidates.length);
    const c = s.candidates[0];
    const place = sleepPlace(c) || c;
    const prev = {status:c.status, lat:place.lat, lng:place.lng};
    c.status = 'unavailable'; place.lat = 43.0; place.lng = 5.0;
    const n = (buildSleepMap(s, []).match(/map-pt/g) || []).length;
    c.status = prev.status; place.lat = prev.lat; place.lng = prev.lng;
    return n;
  })()`);
  assert.equal(mapCount, 0, 'unavailable darf nie auf der Karte erscheinen');
  const tabs = app.run(`(()=>{renderSleep(); return document.getElementById('page-sleep').innerHTML;})()`);
  assert.ok(tabs.includes('Absagen'), 'Filter „Absagen“ muss in der Ansicht existieren');
}

// 4) Neue Campingplatz-E-Mails sind standardmäßig UNVERIFIZIERT; der
//    Bearbeiten-Dialog zeigt den Haken nur bei ausdrücklich bestätigten Kontakten.
{
  const field = f => `sleepCandidateFields(${f}).find(x=>x.key==='contactVerified').value`;
  assert.equal(app.run(field('{}')), false, 'neuer Kandidat: Kontaktprüfung standardmäßig aus');
  assert.equal(app.run(field("{id:'x', contactVerified:true}")), true, 'bestätigter Kontakt bleibt an');
  assert.equal(app.run(field("{id:'x', contactVerified:false}")), false, 'gesperrter Kontakt bleibt aus');
  assert.equal(app.run(field("{id:'x'}")), false, 'unbestätigter Bestand bleibt aus');
}

// 5) „Entwurf verwerfen“: Abbrechen einer Entwurfsanfrage lässt den
//    fachlichen Status unverändert und ist über die Karte erreichbar.
{
  const out = app.run(`(()=>{
    const s = state.sleepSearches.find(x=>x.candidates.length > 1);
    const c = s.candidates[1];
    c.status = 'available';
    const before = state.mailAssistant.draftRequests.length;
    openSleepMail(s.id, c.id, 'reserve', true);
    const afterOpen = {status:c.status, drafts:state.mailAssistant.draftRequests.length};
    const card = sleepCandidateCard(s, c);
    cancelSleepDraft(s.id, c.id);
    const req = state.mailAssistant.draftRequests.at(-1);
    return {before, afterOpen, cardHasCancel:card.includes('cancelSleepDraft'), cardLabel:card.includes('Entwurf verwerfen'),
            statusAfterCancel:c.status, draftState:c.draftState, reqStatus:req.status};
  })()`);
  assert.equal(out.afterOpen.status, 'available', 'Entwurfsanfrage darf den Status nicht ändern');
  assert.equal(out.afterOpen.drafts, out.before + 1, 'genau eine Entwurfsanfrage');
  assert.equal(out.cardHasCancel, true, 'Karte muss cancelSleepDraft anbieten');
  assert.equal(out.cardLabel, true, 'Karte muss „Entwurf verwerfen“ beschriften');
  assert.equal(out.statusAfterCancel, 'available', 'Verwerfen darf den fachlichen Status nicht ändern');
  assert.equal(out.draftState, 'none', 'Entwurfszustand muss zurückgesetzt werden');
  assert.equal(out.reqStatus, 'cancelled', 'Anfrage muss als verworfen markiert sein');
}

// 6) Legacy-Status draft_requested ohne Anfrage-Historie fällt auf
//    „awaiting“ zurück — nie auf „available“ (keine erfundene Zusage).
{
  const status = app.run(`(()=>{
    const legacy = {
      schemaVersion:9,
      meta:{lastSaved:'2026-07-01T00:00:00.000Z'},
      crew:[{id:'c-x', name:'X', color:'#fff'}],
      selectedRoute:'r1',
      routes:[{id:'r1', emoji:'🌊', name:'R', desc:'', stages:[]}],
      sleepSearches:[{id:'sx', title:'Testnacht', dateLabel:'', candidates:[{id:'cx', name:'Legacy Platz', status:'draft_requested'}]}],
      mailAssistant:{draftRequests:[]}
    };
    const migrated = migrate(legacy);
    return migrated.sleepSearches.flatMap(s=>s.candidates).find(c=>c.name==='Legacy Platz').status;
  })()`);
  assert.equal(status, 'awaiting', 'draft_requested ohne Historie muss auf awaiting zurückfallen');
  assert.notEqual(status, 'available');
  // Mit erhaltener Historie wird der echte vorherige Status wiederhergestellt.
  const restored = app.run(`(()=>{
    const legacy = {
      schemaVersion:9,
      meta:{lastSaved:'2026-07-01T00:00:00.000Z'},
      crew:[{id:'c-x', name:'X', color:'#fff'}],
      selectedRoute:'r1',
      routes:[{id:'r1', emoji:'🌊', name:'R', desc:'', stages:[]}],
      sleepSearches:[{id:'sx', title:'Testnacht', dateLabel:'', candidates:[{id:'cx', name:'Legacy Platz', status:'draft_requested'}]}],
      mailAssistant:{draftRequests:[{id:'r', candidateId:'cx', template:'call', status:'opened', previousStatus:'call'}]}
    };
    return migrate(legacy).sleepSearches.flatMap(s=>s.candidates).find(c=>c.name==='Legacy Platz').status;
  })()`);
  assert.equal(restored, 'call', 'vorhandene Historie muss den echten Status wiederherstellen');
}

console.log(JSON.stringify({ok:true, seededOnFirstOfflineLaunch:true, bookedOnMap:true, absagenFilter:true, unverifiedDefault:true, cancelKeepsStatus:true, draftRequestedFallback:'awaiting'}));
