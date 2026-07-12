// Regression: verifizierte Kontaktdaten (V10) dürfen von Mail-Events nie
// überschrieben werden; importierte Kontaktdaten bleiben unverifiziert, bis
// ein Mensch sie bestätigt (Audit-Finding 7, Fix in 47c0423).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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

const bridgeSrc = fs.readFileSync(new URL('camping-mail-bridge.mjs', import.meta.url), 'utf8');

function makeBridge(server){
  const sandbox = {
    Buffer, Date, JSON, console, Math,
    CLOUD_URL:'mock://planner.json',
    fetch: async (url, opts = {}) => {
      if(!opts.method || opts.method === 'GET')
        return {ok:true, status:200, json:async()=>JSON.parse(JSON.stringify(server.state)), headers:{get:()=>String(server.etag)}};
      server.state = JSON.parse(opts.body);
      server.etag++;
      return {ok:true, status:200, headers:{get:()=>String(server.etag)}};
    }
  };
  vm.createContext(sandbox);
  for(const name of ['getState', 'nextStamp', 'nextRunStamp', 'conditionalUpdate', 'locate', 'applyEvents'])
    vm.runInContext(extract(bridgeSrc, name), sandbox);
  const encode = events => Buffer.from(JSON.stringify(events)).toString('base64url');
  return events => vm.runInContext('applyEvents', sandbox)(encode(events));
}

const VERIFIED_PLACE = {
  id:'p-verified', name:'Camping Peña Montañesa', region:'Labuerda · Aínsa',
  email:'info@penamontanesa.com', phone:'+34 974 500 032',
  link:'https://maps.example/pena', lat:42.4505, lng:0.1356, contactVerified:true
};

function makeState(place){
  return {
    meta:{lastSaved:'2026-07-12T10:00:00.000Z'},
    sleepPlaces:[JSON.parse(JSON.stringify(place))],
    sleepSearches:[{id:'s1', dateLabel:'09.–10.08.2026', candidates:[
      {id:'c1', placeId:place.id, name:place.name, status:'awaiting'}
    ]}],
    mailAssistant:{processedMessageIds:[], draftRequests:[], reviewQueue:[], runners:{}},
    log:[]
  };
}

// 1) Verifizierter Platz: eingehendes Mail-Event darf E-Mail, Telefon, Link,
//    Koordinaten, Region und den Verifikationsstatus NICHT verändern.
{
  const server = {state:makeState(VERIFIED_PLACE), etag:1};
  const apply = makeBridge(server);
  await apply([{
    searchId:'s1', candidateId:'c1', messageId:'<attack@mail>', status:'available', reply:'Frei.',
    email:'evil@old-address.example', phone:'+00 000 000', link:'https://evil.example',
    lat:0, lng:0, region:'Falsche Region'
  }]);
  const p = server.state.sleepPlaces[0];
  assert.equal(p.email, VERIFIED_PLACE.email, 'verifizierte E-Mail darf nicht überschrieben werden');
  assert.equal(p.phone, VERIFIED_PLACE.phone, 'verifiziertes Telefon darf nicht überschrieben werden');
  assert.equal(p.link, VERIFIED_PLACE.link, 'verifizierter Link darf nicht überschrieben werden');
  assert.equal(p.lat, VERIFIED_PLACE.lat, 'verifizierte Breite darf nicht überschrieben werden');
  assert.equal(p.lng, VERIFIED_PLACE.lng, 'verifizierte Länge darf nicht überschrieben werden');
  assert.equal(p.region, VERIFIED_PLACE.region, 'verifizierte Region darf nicht überschrieben werden');
  assert.equal(p.contactVerified, true, 'Verifikationsstatus muss true bleiben');
  // Der fachliche Teil des Events (Status/Antwort) bleibt dabei wirksam.
  assert.equal(server.state.sleepSearches[0].candidates[0].status, 'available');
}

// 2) Unverifizierter Platz: importierte Kontaktdaten werden übernommen,
//    bleiben aber ausdrücklich UNVERIFIZIERT (contactVerified === false),
//    bis ein Mensch sie über „Bearbeiten“ bestätigt.
{
  const unverified = {...VERIFIED_PLACE, id:'p-open', contactVerified:false, email:'old@camp.example'};
  const server = {state:makeState(unverified), etag:1};
  const apply = makeBridge(server);
  await apply([{searchId:'s1', candidateId:'c1', messageId:'<update@mail>', email:'reception@camp.example', phone:'+34 111 222'}]);
  const p = server.state.sleepPlaces[0];
  assert.equal(p.email, 'reception@camp.example', 'unverifizierter Platz darf aktualisiert werden');
  assert.equal(p.contactVerified, false, 'importierte Kontaktdaten müssen unverifiziert bleiben');
}

// 3) Auch ein Platz OHNE gesetzten Verifikationsstatus wird durch einen
//    Kontakt-Import ausdrücklich auf unverifiziert gesetzt.
{
  const fresh = {id:'p-fresh', name:'Camping Neu', email:'', contactVerified:undefined};
  const server = {state:makeState(fresh), etag:1};
  const apply = makeBridge(server);
  await apply([{searchId:'s1', candidateId:'c1', messageId:'<new@mail>', email:'found@camp.example'}]);
  const p = server.state.sleepPlaces[0];
  assert.equal(p.email, 'found@camp.example');
  assert.equal(p.contactVerified, false, 'Kontakt-Import muss contactVerified=false setzen');
}

// 4) Reine Positions-Events (lat/lng, ohne Kontaktkanäle) ändern den
//    Verifikationsstatus nicht.
{
  const unverified = {id:'p-pos', name:'Camping Pos', email:'x@camp.example', contactVerified:false, lat:1, lng:1};
  const server = {state:makeState(unverified), etag:1};
  const apply = makeBridge(server);
  await apply([{searchId:'s1', candidateId:'c1', messageId:'<pos@mail>', lat:42.5, lng:0.5}]);
  const p = server.state.sleepPlaces[0];
  assert.equal(p.lat, 42.5);
  assert.equal(p.contactVerified, false, 'Positions-Update darf Verifikationsstatus nicht anfassen');
  assert.equal(p.email, 'x@camp.example');
}

console.log(JSON.stringify({ok:true, verifiedProtected:true, importsStayUnverified:true}));
