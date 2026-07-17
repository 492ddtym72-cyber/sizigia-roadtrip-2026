// Regression: Wiederherstellungs- und Anzeige-Schutzmechanismen des
// Schlafplatz-Radars (Audit-Findings 8–13, Fix in 47c0423) — echtes app.js
// im vm-Testbed (kein Netz, kein Browser).
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

// Ein App-Kontext für alle Anzeige-Tests: erster Start, offline, leerer Speicher.
const app = loadApp();
await new Promise(r => setImmediate(r));

// 1) Erster Offline-Start: alle acht Camping-Korridore sind SOFORT gesät
//    (kein Reload nötig), inklusive aller geprüften Routenkandidaten.
assert.equal(app.run('state.sleepSearches.length'), 8, 'acht Korridore beim ersten Start');
assert.equal(app.run('state.sleepSearches.reduce((n,s)=>n+s.candidates.length,0)'), 54, '54 Optionen beim ersten Start');
assert.equal(app.run('state.sleepSearches.every(s=>s.mode==="network")'), true);
assert.equal(app.run('state.meta.campingNetworkSeeded'), true);
assert.equal(app.run('new Set(state.sleepSearches.map(s=>s.networkKey)).size'), 8, 'Korridore eindeutig');
assert.equal(app.run('state.sleepSearches.find(s=>s.networkKey==="provence-east").arrivalWindowEnd'),'2026-08-05','Provence braucht zwei mögliche Anreisetage');
assert.equal(app.run('state.schemaVersion'),19,'Erweiterte Küstenoptionen brauchen Schema V19');
assert.equal(app.run('state.sleepSearches.find(s=>s.networkKey==="camargue").candidates.length'),3,'Camargue ist ein eigener Korridor');
assert.equal(app.run('state.sleepSearches.flatMap(s=>s.candidates).filter(c=>c.preferred).length'),18,'siebzehn recherchierte Camping-Favoriten plus private Option');
assert.equal(app.run('state.sleepSearches.flatMap(s=>s.candidates).filter(c=>c.preferred&&c.kind!=="private").every(c=>c.status!=="booked"&&c.contactVerified===true)'),true,'Camping-Favoriten bleiben ungeplant, sind nach offizieller Prüfung aber freigeschaltet');
assert.ok(app.run(`(()=>{const s=state.sleepSearches.find(x=>x.networkKey==='camargue'),c=s.candidates.find(x=>x.preferred);return sleepCandidateCard(s,c);})()`).includes('★ Favorit'),'Favorit muss auf der Karte lesbar sein');

// V18 ergänzt drei aufeinanderfolgende Küstenoptionen. Die E-Mail-Plätze
// verwenden ihre exakte Wunschnacht; Santa Gusta bleibt ein zustandsloser
// Formularentwurf, bis jemand den tatsächlichen Versand bestätigt.
{
  const seaside=app.run(`(()=>{const rows=state.sleepSearches.flatMap(s=>(s.candidates||[]).map(c=>({s,c}))),get=name=>rows.find(x=>x.c.name===name),roma=get('Camping Roma'),agay=get('Camping Agay Soleil'),santa=get('Camping Santa Gusta'),santaView=sleepCandidateView(santa.c);return {roma:sleepEmailText(roma.s,sleepCandidateView(roma.c),'inquiry'),agay:sleepEmailText(agay.s,sleepCandidateView(agay.c),'inquiry'),santa:{status:santa.c.status,email:santaView.email||'',form:santaView.contactFormUrl,card:sleepCandidateCard(santa.s,santa.c),date:santa.c.requestedArrivalDate}};})()`);
  assert.ok(seaside.roma.includes('from 3 August 2026 to 4 August 2026'));
  assert.equal(seaside.roma.includes('choose any available arrival date'),false);
  assert.ok(seaside.agay.includes('from 4 August 2026 to 5 August 2026'));
  assert.ok(seaside.agay.includes('under 7 metres'));
  assert.equal(seaside.santa.status,'new');
  assert.equal(seaside.santa.email,'');
  assert.equal(seaside.santa.date,'2026-08-05');
  assert.ok(seaside.santa.form.includes('santagusta.com/contactez-nous'));
  assert.ok(seaside.santa.card.includes('Anfrage vorbereiten'));
}

// Die gewählte Nacht ist eine reine Geräteeinstellung: sie bleibt nach jedem
// Re-Render aktiv, ohne das synchronisierte Reise-State-Objekt zu verändern.
{
  const selected=app.run(`(()=>{const s=state.sleepSearches.at(-1);selectSleepSearch(s.id);return {id:s.id,active:activeSleepSearchId,stored:localStorage.getItem(SLEEP_SEARCH_KEY),inState:Object.prototype.hasOwnProperty.call(state,'activeSleepSearchId')};})()`);
  assert.equal(selected.active,selected.id,'gewählte Nacht bleibt aktiv');
  assert.equal(selected.stored,selected.id,'gewählte Nacht wird auf dem Gerät gespeichert');
  assert.equal(selected.inState,false,'Geräteauswahl darf nicht in die Gruppe synchronisiert werden');
  assert.ok(app.run(`document.getElementById('page-sleep').innerHTML`).includes('id="sleepSearchStrip"'),'Nachtwähler braucht eine gezielt scrollbar gehaltene Leiste');
}

// Routensuche arbeitet über alle Nächte, ignoriert Akzente und führt beim
// Öffnen eines Treffers in den richtigen Abschnitt und Status-Tab zurück.
{
  const search=app.run(`(()=>{sleepQuery='laspaules';const rows=sleepSearchRows(),html=renderSleepSearchResults(),row=rows.find(x=>x.view.name==='Camping Laspaúles');return {count:rows.length,html,searchId:row?.search.id,candidateId:row?.candidate.id};})()`);
  assert.ok(search.count>=1,'akzentunabhängige Suche muss Laspaúles finden');
  assert.ok(search.html.includes('Camping Laspaúles'),'Treffer zeigt den Campingplatz');
  assert.ok(search.html.includes('Huesca-Anfahrt'),'Treffer zeigt den Reiseabschnitt');
  const opened=app.run(`(()=>{openSleepSearchResult('${search.searchId}','${search.candidateId}');return {active:activeSleepSearchId,filter:sleepFilter,query:sleepQuery};})()`);
  assert.equal(opened.active,search.searchId,'Treffer öffnet den richtigen Reiseabschnitt');
  assert.equal(opened.filter,'action','verfügbares Angebot öffnet im Nutzbar-Tab');
  assert.equal(opened.query,'','Treffer schließt die Routensuche');
  const short=app.run(`(()=>{sleepQuery='a';const html=renderSleepSearchResults();sleepQuery='';return html;})()`);
  assert.ok(short.includes('Mindestens zwei Zeichen'),'Einzelzeichen dürfen keine riesige Trefferliste öffnen');
}

// V13 ergänzt Verona idempotent in eine vorhandene Erste-Nacht-Suche, ohne
// bestehende Kandidaten oder Orte zu ersetzen.
{
  const legacy={schemaVersion:12,meta:{lastSaved:'2026-07-13T12:00:00.000Z'},sleepPlaces:[{id:'old-place',name:'Bestehender Platz'}],sleepSearches:[{id:'first',title:'Erste Nacht',startDate:'2026-08-02',endDate:'2026-08-03',arrivalWindowStart:'2026-08-02',arrivalWindowEnd:'2026-08-02',dateLabel:'02.08.2026–03.08.2026',region:'Ab Innsbruck',mode:'planned',candidates:[{id:'old-candidate',placeId:'old-place',name:'Bestehender Platz',status:'new'}]}]};
  const migrated=loadApp({localStorageData:{'sizigia-roadtrip-2026':JSON.stringify(legacy)}});
  const out=migrated.run(`(()=>{const s=state.sleepSearches.find(x=>x.id==='first'),rows=s.candidates.filter(x=>x.name==='Camping Verona Village'),c=rows[0],p=state.sleepPlaces.find(x=>x.id===c.placeId);return {count:rows.length,old:s.candidates.some(x=>x.id==='old-candidate'),verified:p.contactVerified,lat:p.lat,version:state.schemaVersion};})()`);
  assert.equal(JSON.stringify(out),JSON.stringify({count:1,old:true,verified:true,lat:45.39306,version:19}));
}

// V16 ergänzt die private Familien-Option einmalig als nutzbar, aber nicht
// fälschlich als gebucht. Der Ort bleibt auf der Karte und braucht keine Mail.
{
  const privateStay=app.run(`(()=>{const s=state.sleepSearches.find(x=>x.networkKey==='languedoc'),rows=s.candidates.filter(x=>x.name==='Privater Stellplatz · Les Salces'),c=rows[0],p=state.sleepPlaces.find(x=>x.id===c.placeId);return {count:rows.length,status:c.status,kind:p.kind,preferred:c.preferred,email:c.email||'',lat:p.lat,lng:p.lng,action:sleepCandidateCard(s,c).includes('Verfügbarkeit anfragen'),onMap:sleepMapRows(s).some(x=>x.c.id===c.id)};})()`);
  assert.equal(JSON.stringify(privateStay),JSON.stringify({count:1,status:'available',kind:'private',preferred:true,email:'',lat:43.7549461,lng:3.4355718,action:false,onMap:true}));
}

// V17 übernimmt die am 15.07. eingegangenen Antworten genau einmal. Ein
// Zwei-Nächte-Angebot bleibt dabei ein Zwei-Nächte-Angebot und wird in der
// Reservierungsantwort nicht wieder auf eine Nacht verkürzt.
{
  const replies=app.run(`(()=>{const rows=state.sleepSearches.flatMap(s=>(s.candidates||[]).map(c=>({s,c}))),get=name=>rows.find(x=>x.c.name===name),mas=get('Flower Camping Le Mas de Mourgues'),tama=get('Camping La Tamarissière'),val=get('Camping Le Val de Cesse'),las=get('Camping Laspaúles'),rest=get('Camping Les Restanques'),cada=get('Wecamp Cadaqués');return {marker:state.meta.campingReplyBatch20260715,mas:{status:mas.c.status,price:mas.c.finalPrice,website:sleepCandidateCard(mas.s,mas.c).includes('Auf Website reservieren')},tama:{status:tama.c.status},val:{status:val.c.status,price:val.c.finalPrice,parking:val.c.parking},las:{status:las.c.status,start:las.c.offeredArrivalDate,end:las.c.offeredDepartureDate,mail:sleepEmailText(las.s,sleepCandidateView(las.c),'reserve'),card:sleepCandidateCard(las.s,las.c)},rest:{status:rest.c.status,price:rest.c.finalPrice,website:sleepCandidateCard(rest.s,rest.c).includes('Auf Website reservieren')},cada:{status:cada.c.status,website:sleepCandidateCard(cada.s,cada.c).includes('Auf Website reservieren')}};})()`);
  assert.equal(replies.marker,3);
  assert.equal(JSON.stringify(replies.mas),JSON.stringify({status:'available',price:'76 €',website:true}));
  assert.equal(JSON.stringify(replies.tama),JSON.stringify({status:'unavailable'}));
  assert.equal(replies.val.status,'available');
  assert.equal(replies.val.price,'ca. 90 €');
  assert.ok(replies.val.parking.includes('außerhalb'));
  assert.equal(replies.las.start,'2026-08-09');
  assert.equal(replies.las.end,'2026-08-11');
  assert.ok(replies.las.mail.includes('from 9 August 2026 to 11 August 2026'));
  assert.ok(!replies.las.mail.includes('from 9 August 2026 to 10 August 2026'));
  assert.ok(replies.las.card.includes('9.–11.08.2026'));
  assert.equal(JSON.stringify(replies.rest),JSON.stringify({status:'available',price:'66,16 €',website:true}));
  assert.equal(JSON.stringify(replies.cada),JSON.stringify({status:'reservable',website:true}));
  const queue=app.run(`(()=>{const names=['Camping Alquézar','Camping Mare Monti','Wecamp Cadaqués','Youcamp Village Marseille Provence','Camping Les Restanques'],rows=state.sleepSearches.flatMap(s=>s.candidates||[]);state.mailAssistant.reviewQueue=names.map((name,i)=>({id:'review-'+i,candidateId:rows.find(c=>c.name===name).id,status:'pending'}));state.meta.campingReplyBatch20260715=2;state=migrate(state);return state.mailAssistant.reviewQueue.map(x=>x.status);})()`);
  assert.equal(JSON.stringify(queue),JSON.stringify(['resolved','resolved','resolved','resolved','resolved']));
}

// Gesendete, noch unbeantwortete Anfragen erscheinen blau auf der Karte.
// Ein nur geöffneter Entwurf darf dagegen keinen Kontakt vortäuschen.
{
  const result=app.run(`(()=>{
    const s=state.sleepSearches.find(x=>x.candidates.length>1),a=s.candidates[0],d=s.candidates[1];
    const pa=sleepPlace(a)||a,pd=sleepPlace(d)||d,prev={statuses:s.candidates.map(c=>c.status),alat:pa.lat,alng:pa.lng,dlat:pd.lat,dlng:pd.lng};
    s.candidates.forEach(c=>c.status='new');
    a.status='awaiting';pa.lat=43;pa.lng=5;d.status='draft_requested';pd.lat=43.2;pd.lng=5.2;
    const html=buildSleepMap(s,[]),points=(html.match(/map-pt/g)||[]).length,blue=html.includes('#54c8ff');
    s.candidates.forEach((c,i)=>c.status=prev.statuses[i]);Object.assign(pa,{lat:prev.alat,lng:prev.alng});Object.assign(pd,{lat:prev.dlat,lng:prev.dlng});
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
    const prev = {statuses:s.candidates.map(x=>x.status), lat:place.lat, lng:place.lng};
    s.candidates.forEach(x=>x.status='new');
    c.status = 'unavailable'; place.lat = 43.0; place.lng = 5.0;
    const n = (buildSleepMap(s, []).match(/map-pt/g) || []).length;
    s.candidates.forEach((x,i)=>x.status=prev.statuses[i]);place.lat = prev.lat; place.lng = prev.lng;
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

// 6) Die mobile Karte zeigt nur eine primäre Aktion. Gesendete Anfragen
//    erzeugen keine zweite Erstanfrage und echte Antwortboxen brauchen Inhalt.
{
  const ui=app.run(`(()=>{
    const s=state.sleepSearches.find(x=>x.candidates.length),c=s.candidates[0],before={status:c.status,reply:c.reply,replyQuote:c.replyQuote,pitchNote:c.pitchNote,parking:c.parking,notes:c.notes},draftCount=state.mailAssistant.draftRequests.length;
    Object.assign(c,{status:'awaiting',reply:'',replyQuote:'',pitchNote:'',parking:'',notes:''});
    const awaiting=sleepCandidateCard(s,c);
    c.status='new';
    const fresh=sleepCandidateCard(s,c);
    state.mailAssistant.draftRequests.push({id:'ui-ready',searchId:s.id,candidateId:c.id,template:'inquiry',status:'ready',previousStatus:'new'});
    const draft=sleepCandidateCard(s,c),counts=sleepFilterCounts({candidates:[{status:'available'},{status:'call'},{status:'new'},{status:'awaiting'},{status:'unavailable'}]});
    state.mailAssistant.draftRequests.splice(draftCount);Object.assign(c,before);
    return {awaitingHasMail:awaiting.includes('prepareSleepReply'),awaitingHasAnswerBox:awaiting.includes('sleep-answer'),awaitingState:awaiting.includes('Anfrage gesendet, noch keine Antwort erhalten.'),freshAction:fresh.includes('Verfügbarkeit anfragen'),freshHasAnswerBox:fresh.includes('sleep-answer'),draftMark:draft.includes('Als gesendet markieren'),draftReask:draft.includes('Verfügbarkeit anfragen'),counts};
  })()`);
  assert.equal(ui.awaitingHasMail,false,'Gesendete Anfrage darf keine zweite Erstanfrage anbieten');
  assert.equal(ui.awaitingHasAnswerBox,false,'Ohne echte Antwort erscheint kein Antwortkasten');
  assert.equal(ui.awaitingState,true,'Status bleibt auf einen Blick lesbar');
  assert.equal(ui.freshAction,true,'Neuer Platz hat genau die Kontaktaktion');
  assert.equal(ui.freshHasAnswerBox,false,'Recherchehinweis ist keine Campingplatz-Antwort');
  assert.equal(ui.draftMark,true,'Bereiter Entwurf bietet die manuelle Versandbestätigung');
  assert.equal(ui.draftReask,false,'Bereiter Entwurf erzeugt keine zweite Anfrage');
  assert.equal(JSON.stringify(ui.counts),JSON.stringify({action:2,waiting:2,closed:1}));
}

// 7) Legacy-Status draft_requested ohne Anfrage-Historie fällt auf
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

// 8) Stark gekürzte Backups mit leerer Routenliste dürfen die Übersicht
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
