#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function mergeLegacyCampContacts(');
assert.notEqual(start,-1,'mergeLegacyCampContacts() fehlt');
let depth=0,end=-1;
for(let i=source.indexOf('{',start);i<source.length;i++){
  if(source[i]==='{')depth++;
  if(source[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>start,'mergeLegacyCampContacts() konnte nicht gelesen werden');
const sandbox={};
vm.runInNewContext(source.slice(start,end)+';this.mergeLegacyCampContacts=mergeLegacyCampContacts;',sandbox);

const state={
  campContacts:[
    {id:'legacy-1',name:'Camping Lago di Tenno',region:'Tenno',phone:'+39 111',link:'https://maps.example/tenno',note:'WhatsApp +39 222'},
    {id:'legacy-2',name:'Camping Punta Indiani',region:'Legacy region',phone:'+39 333',link:'https://maps.example/punta',note:'1 Nacht spontan'}
  ],
  sleepPlaces:[
    {id:'place-1',name:'Camping Lago di Tenno',region:'Lago di Tenno',phone:'',link:'',notes:''},
    {id:'place-2',name:'Camping Punta Indiani',region:'Valcanover',phone:'+39 current',link:'https://current.example',notes:'Bestehende Notiz'}
  ],
  sleepSearches:[{candidates:[
    {id:'candidate-1',name:'Camping Lago di Tenno',placeId:'place-1',contactId:'legacy-1',notes:''},
    {id:'candidate-2',name:'Camping Punta Indiani',placeId:'place-2',contactId:'legacy-2',notes:'Kandidaten-Notiz'}
  ]}]
};
const archived=JSON.stringify(state.campContacts);
sandbox.mergeLegacyCampContacts(state);
assert.equal(JSON.stringify(state.campContacts),archived,'Legacy-Kontakte müssen unverändert archiviert bleiben');
assert.equal(state.sleepPlaces[0].phone,'+39 111');
assert.equal(state.sleepPlaces[0].link,'https://maps.example/tenno');
assert.equal(state.sleepPlaces[0].region,'Lago di Tenno','reichhaltigere Region darf nicht überschrieben werden');
assert.equal(state.sleepPlaces[0].notes,'WhatsApp +39 222');
assert.equal(state.sleepSearches[0].candidates[0].notes,'WhatsApp +39 222');
assert.equal(state.sleepPlaces[1].phone,'+39 current','bestehendes Telefon darf nicht überschrieben werden');
assert.equal(state.sleepPlaces[1].link,'https://current.example','bestehender Link darf nicht überschrieben werden');
assert.equal(state.sleepPlaces[1].notes,'Bestehende Notiz','bestehende Notiz darf nicht überschrieben werden');
assert.equal(state.sleepSearches[0].candidates[1].notes,'Kandidaten-Notiz','bestehende Kandidaten-Notiz darf nicht überschrieben werden');
sandbox.mergeLegacyCampContacts(state);
assert.equal(JSON.stringify(state.campContacts),archived,'Migration muss idempotent bleiben');

const backupUrl=new URL('../backups/firebase-pre-v8-2026-07-12T16-22-01-559Z.json',import.meta.url);
let productionSnapshot=null;
if(fs.existsSync(backupUrl)){
  productionSnapshot=JSON.parse(fs.readFileSync(backupUrl,'utf8'));
  const before={
    contacts:productionSnapshot.campContacts.length,
    places:productionSnapshot.sleepPlaces.length,
    searches:productionSnapshot.sleepSearches.length,
    candidates:productionSnapshot.sleepSearches.reduce((n,s)=>n+(s.candidates||[]).length,0),
    reminders:productionSnapshot.reminders.length,
    log:productionSnapshot.log.length
  };
  const contactsBefore=JSON.stringify(productionSnapshot.campContacts);
  sandbox.mergeLegacyCampContacts(productionSnapshot);
  const after={
    contacts:productionSnapshot.campContacts.length,
    places:productionSnapshot.sleepPlaces.length,
    searches:productionSnapshot.sleepSearches.length,
    candidates:productionSnapshot.sleepSearches.reduce((n,s)=>n+(s.candidates||[]).length,0),
    reminders:productionSnapshot.reminders.length,
    log:productionSnapshot.log.length
  };
  assert.deepEqual(after,before,'Produktions-Snapshot darf keine Einträge verlieren oder gewinnen');
  assert.equal(JSON.stringify(productionSnapshot.campContacts),contactsBefore,'Produktionskontakte müssen unverändert archiviert bleiben');
  const tenno=productionSnapshot.sleepPlaces.find(p=>p.name==='Camping Lago di Tenno');
  assert.equal(tenno.notes,'WhatsApp +39 351 8733774','Legacy-WhatsApp-Hinweis muss im Radar ankommen');
}
console.log(JSON.stringify({ok:true,legacyContactsPreserved:state.campContacts.length,mergedPlaces:state.sleepPlaces.length,productionSnapshot:!!productionSnapshot}));
