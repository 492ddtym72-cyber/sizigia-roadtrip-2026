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
assert.ok(missing.html.includes('sleep-unpositioned-list'),'viele fehlende Positionen liegen in einer kompakten Liste');

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

const activeFilter=app.run(`(()=>{
  const s=state.sleepSearches[0],open=normalizeSleepCandidate({id:'active-open',name:'Offene Anfrage',status:'awaiting',mapPinned:true}),closed=normalizeSleepCandidate({id:'active-closed',name:'Absage',status:'unavailable',mapPinned:true});
  s.candidates.push(open,closed);
  return {rows:sleepMapRows('active').map(row=>row.c.id),missing:sleepUnpositionedRows('active').map(row=>row.c.id)};
})()`);
assert.ok(activeFilter.rows.includes('active-open'),'Aktive Kartenansicht zeigt offene Anfragen');
assert.ok(!activeFilter.rows.includes('active-closed'),'Aktive Kartenansicht blendet Absagen aus');
assert.ok(activeFilter.missing.includes('active-open'),'Aktive Fehlpositionsliste zeigt offene Anfragen');
assert.ok(!activeFilter.missing.includes('active-closed'),'Aktive Fehlpositionsliste blendet Absagen aus');

console.log(JSON.stringify({ok:true,missingVisible:true,bothMaps:true,manualPin:true}));
