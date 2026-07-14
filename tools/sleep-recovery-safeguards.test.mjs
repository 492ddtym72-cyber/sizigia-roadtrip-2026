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
assert.equal(app.run('state.sleepSearches.length'), 8, 'acht Korridore beim ersten Start');
assert.equal(app.run('state.sleepSearches.reduce((n,s)=>n+s.candidates.length,0)'), 40, '40 Kandidaten beim ersten Start');
assert.equal(app.run('state.sleepSearches.every(s=>s.mode==="network")'), true);
assert.equal(app.run('state.meta.campingNetworkSeeded'), true);
assert.equal(app.run('new Set(state.sleepSearches.map(s=>s.networkKey)).size'), 8, 'Korridore eindeutig');
assert.equal(app.run('state.sleepSearches.find(s=>s.networkKey==="provence-east").arrivalWindowEnd'),'2026-08-05','Provence braucht zwei mögliche Anreisetage');
assert.equal(app.run('state.schemaVersion'),12,'Frankreich-Netz braucht Schema V12');
assert.equal(app.run('state.sleepSearches.find(s=>s.networkKey==="camargue").candidates.length'),3,'Camargue ist ein eigener Korridor');
assert.equal(app.run('state.sleepSearches.flatMap(s=>s.candidates).filter(c=>c.preferred).length'),6,'sechs recherchierte Favoriten');
assert.equal(app.run('state.sleepSearches.flatMap(s=>s.candidates).filter(c=>c.preferred).every(c=>c.status==="new"&&c.contactVerified===false)'),true,'Favoriten bleiben unkontaktiert und gesperrt');
assert.ok(app.run(`(()=>{const s=state.sleepSearches.find(x=>x.networkKey==='camargue'),c=s.candidates.find(x=>x.preferred);return sleepCandidateCard(s,c);})()`).includes('★ Favorit'),'Favorit muss auf der Karte lesbar sein');

// Gesendete, noch unbeantwortete Anfragen erscheinen blau auf der Karte.
// Ein nur geöffneter Entwurf darf dagegen keinen Kontakt vortäuschen.
{
  const result=app.run(`(()=>{
    const s=state.sleepSearches.find(x=>x.candidates.length>1),a=s.candidates[0],d=s.candidates[1];
    const pa=sleepPlace(a)||a,pd=sleepPlace(d)||d,prev={as:a.status,ds:d.status,alat:pa.lat,alng:pa.lng,dlat:pd.lat,dlng:pd.lng};
    a.status='awaiting';pa.lat=43;pa.lng=5;d.status='draft_requested';pd.lat=43.2;pd.lng=5.2;
    const html=buildSleepMap(s,[]),points=(html.match(/map-pt/g)||[]).length,blue=html.includes('#54c8ff');
    Object.assign(a,{status:prev.as});Object.assign(d,{status:prev.ds});Object.assign(pa,{lat:prev.alat,lng:prev.alng});Object.assign(pd,{lat:prev.dlat,lng:prev.dlng});
    return {points,blue};
  })()`);
  assert.equal(result.points,1,'nur die wirklich gesendete Anfrage gehört auf die Karte');
  assert.equal(result.blue,true,'offene Anfrage muss blau markiert sein');
}

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

// 8) Flexible Korridore fragen nach genau einer Nacht innerhalb des Fensters;
//    eine Reservierungsantwort bleibt blockiert, bis der Platz ein Datum nennt.
{
  const mail=app.run(`(()=>{
    const s=state.sleepSearches.find(x=>x.networkKey==='provence-east'),c=s.candidates[0];
    const inquiry=sleepEmailText(s,sleepCandidateView(c),'inquiry');
    const guarded=sleepEmailText(s,sleepCandidateView(c),'reserve');
    c.offeredArrivalDate='2026-08-05';
    const exact=sleepEmailText(s,sleepCandidateView(c),'reserve');
    c.offeredArrivalDate='';
    return {label:sleepSearchWindowLabel(s),inquiry,guarded,exact};
  })()`);
  assert.ok(mail.label.includes('flexibel'));
  assert.ok(mail.inquiry.includes('arriving on any day from 4 August 2026 to 5 August 2026'));
  assert.ok(mail.inquiry.includes('We only need one night'));
  assert.ok(mail.guarded.includes('confirm the exact arrival date'));
  assert.ok(!mail.guarded.includes('We would like to accept your offer'));
  assert.ok(mail.exact.includes('from 5 August 2026 to 6 August 2026'));
  assert.ok(mail.exact.includes('We would like to accept your offer'));
}

// Apple Mail auf iPhone benötigt im mailto:-Body CRLF-Zeilenumbrüche. Sonst
// können alle Absätze als ein einziger Textblock erscheinen.
{
  const mail=app.run(`(()=>{
    const s=state.sleepSearches.find(x=>x.networkKey==='cassis-marseille'),c=s.candidates[0],text=sleepEmailText(s,sleepCandidateView(c),'inquiry'),url=sleepMailto(s,sleepCandidateView(c),'inquiry');
    return {text,url,decoded:decodeURIComponent(url.split('&body=')[1])};
  })()`);
  assert.ok(mail.text.startsWith('Dear '));
  assert.ok(mail.text.includes('\n\nIf advance reservations'));
  assert.ok(mail.text.endsWith('Kind regards,\n\n'));
  assert.ok(mail.url.includes('%0D%0A%0D%0A'),'mailto muss echte Briefabsätze kodieren');
  assert.ok(mail.decoded.includes('\r\n\r\nIf advance reservations'));
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

// 7) Stark gekürzte Backups mit leerer Routenliste dürfen die Übersicht
//    weder beim Import noch nach einem Reload dauerhaft unbrauchbar machen.
{
  const repaired=app.run(`(()=>{
    const broken={schemaVersion:10,meta:{lastSaved:'2026-07-01T00:00:00.000Z'},crew:[{id:'c-x',name:'X',color:'#fff'}],routes:[],selectedRoute:''};
    const out=migrate(broken);state=out;renderOverview();
    return {count:out.routes.length,selected:out.selectedRoute,selectedExists:out.routes.some(r=>r.id===out.selectedRoute)};
  })()`);
  assert.ok(repaired.count>=1,'leere Routenliste muss repariert werden');
  assert.equal(repaired.selectedExists,true,'reparierte Auswahl muss auf eine vorhandene Route zeigen');
}

console.log(JSON.stringify({ok:true, seededOnFirstOfflineLaunch:true, bookedOnMap:true, absagenFilter:true, unverifiedDefault:true, cancelKeepsStatus:true, draftRequestedFallback:'awaiting',emptyRoutesRepaired:true,flexibleArrivalWindows:true}));
