#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function extract(name){
  const start=source.indexOf(`function ${name}(`);assert.notEqual(start,-1,`${name}() fehlt`);
  let depth=0,end=-1;
  for(let i=source.indexOf('{',start);i<source.length;i++){
    if(source[i]==='{')depth++;
    if(source[i]==='}'&&--depth===0){end=i+1;break;}
  }
  assert.ok(end>start,`${name}() konnte nicht gelesen werden`);return source.slice(start,end);
}
const sandbox={};
vm.runInNewContext(extract('archiveCampingReminders')+';this.fn=archiveCampingReminders;',sandbox);
const state={
  reminders:[
    {id:'linked',title:'Camping Test reservieren',done:false},
    {id:'delta',title:'Camping Delta 2.8-3.8 🇨🇭✅',done:true},
    {id:'keep',title:'Festival-Tickets prüfen',done:false}
  ],
  sleepSearches:[{candidates:[{id:'c1',reminderId:'linked'},{id:'c2',reminderId:null}]}],
  archive:{campingReminders:[{id:'old',title:'Schon archiviert'}]}
};
sandbox.fn(state);
assert.deepEqual(state.reminders.map(x=>x.id),['keep']);
assert.equal(state.archive.campingReminders.length,3);
assert.equal(state.sleepSearches[0].candidates[0].reminderId,null);
sandbox.fn(state);
assert.equal(state.archive.campingReminders.length,3,'Archivierung muss idempotent sein');

const seedStart=source.indexOf('const CAMPING_NETWORK_HUBS =');
assert.notEqual(seedStart,-1,'CAMPING_NETWORK_HUBS fehlt');
const seedEnd=source.indexOf('\n];',seedStart)+3;
vm.runInNewContext(source.slice(seedStart,seedEnd).replace('const CAMPING_NETWORK_HUBS','this.hubs'),sandbox);
assert.equal(sandbox.hubs.length,8);
assert.equal(new Set(sandbox.hubs.map(x=>x.id)).size,8);
assert.ok(sandbox.hubs.every(x=>x.target>=3&&x.startDate&&x.endDate));
assert.ok(sandbox.hubs.every(x=>x.arrivalWindowStart&&x.arrivalWindowEnd),'Jeder Korridor braucht ein flexibles Anreisefenster');
assert.equal(sandbox.hubs.find(x=>x.id==='provence-east').arrivalWindowEnd,'2026-08-05');
const candidateStart=source.indexOf('const CAMPING_NETWORK_CANDIDATES =');
assert.notEqual(candidateStart,-1,'CAMPING_NETWORK_CANDIDATES fehlt');
const candidateEnd=source.indexOf('\n];',candidateStart)+3;
vm.runInNewContext(source.slice(candidateStart,candidateEnd).replace('const CAMPING_NETWORK_CANDIDATES','this.candidates'),sandbox);
assert.equal(sandbox.candidates.length,40);
const expectedCounts={liguria:4,'provence-east':7,'cassis-marseille':4,camargue:3,languedoc:7,'cote-vermeille':7,'costa-brava':4,huesca:4};
for(const hub of sandbox.hubs){
  const rows=sandbox.candidates.filter(x=>x.hub===hub.id);
  assert.equal(rows.length,expectedCounts[hub.id],`${hub.id}: unerwartete Kandidatenzahl`);
  assert.ok(rows.every(x=>x.name&&x.phone&&x.officialUrl&&x.link&&Number.isFinite(x.lat)&&Number.isFinite(x.lng)),`${hub.id}: Kontaktdaten unvollständig`);
}
const mailCandidates=sandbox.candidates.filter(x=>x.email);
assert.equal(new Set(mailCandidates.map(x=>x.email.toLowerCase())).size,mailCandidates.length,'Vorhandene E-Mail-Adressen müssen eindeutig sein');
assert.equal(sandbox.candidates.filter(x=>!x.email).map(x=>x.name).sort().join('|'),'Camping La Chapelle|Camping Ribera del Ara');
assert.equal(sandbox.candidates.find(x=>x.name==='Camping Mare Monti').lat,44.2639,'Mare Monti muss am verifizierten Standort liegen');
assert.equal(sandbox.candidates.some(x=>x.name==='Camping Río Ara'),false,'Der nicht verifizierbare Río-Ara-Eintrag darf nicht weiter ausgesät werden');
const verifiedStart=source.indexOf('const CAMPING_NETWORK_VERIFIED =');
const verifiedEnd=source.indexOf(';',verifiedStart)+1;
const verifyBox={CAMPING_NETWORK_CANDIDATES:sandbox.candidates,uid:()=>`new-place`,console};
vm.runInNewContext(source.slice(verifiedStart,verifiedEnd).replace('const CAMPING_NETWORK_VERIFIED','this.CAMPING_NETWORK_VERIFIED'),verifyBox);
vm.runInNewContext(extract('applyCampingContactVerificationV10')+';this.apply=applyCampingContactVerificationV10;',verifyBox);
const migrationState={meta:{},sleepPlaces:[
  {id:'mare',name:'Camping Mare Monti',email:'info@campingmaremonti.com',lat:44.2908,lng:9.4147,contactVerified:false},
  {id:'chapelle',name:'Camping La Chapelle',email:'contact@camping-lachapelle.com',contactVerified:false},
  {id:'rio',name:'Camping Río Ara',email:'info@campingrioara.com',contactVerified:false}
],sleepSearches:[{candidates:[
  {id:'c-mare',placeId:'mare',name:'Camping Mare Monti',status:'new'},
  {id:'c-chapelle',placeId:'chapelle',name:'Camping La Chapelle',status:'new'},
  {id:'c-rio',placeId:'rio',name:'Camping Río Ara',status:'new'}
]}]};
verifyBox.apply(migrationState);
assert.equal(migrationState.sleepPlaces[0].lat,44.2639);
assert.equal(migrationState.sleepPlaces[0].contactVerified,true);
assert.equal(migrationState.sleepPlaces[1].email,'');
assert.equal(migrationState.sleepPlaces[1].contactVerified,false);
assert.equal(migrationState.sleepPlaces[2].name,'Camping Ribera del Ara');
assert.equal(migrationState.sleepPlaces[2].contactVerified,false);
assert.equal(migrationState.sleepSearches[0].candidates[2].placeId,'rio','Migration muss die bestehende Verknüpfung erhalten');
const backupUrl=new URL('../backups/firebase-pre-v9-2026-07-12.json',import.meta.url);
let production=null;
if(fs.existsSync(backupUrl)){
  production=JSON.parse(fs.readFileSync(backupUrl,'utf8'));
  const firstSearch=production.sleepSearches[0],firstCount=firstSearch.candidates.length,placeCount=production.sleepPlaces.length;
  sandbox.fn(production);
  assert.equal(production.reminders.length,0,'Im aktuellen Stand dürfen keine Camping-Erinnerungen aktiv bleiben');
  assert.equal(production.archive.campingReminders.length,46,'Alle 46 Camping-Erinnerungen müssen archiviert werden');
  assert.equal(firstSearch.candidates.length,firstCount,'Erste-Nacht-Kandidaten müssen erhalten bleiben');
  assert.equal(production.sleepPlaces.length,placeCount,'Archivierung darf Schlafplätze nicht verändern');
  const seedFn=extract('seedCampingSafetyNetwork');
  const seedBox={CAMPING_NETWORK_HUBS:sandbox.hubs,CAMPING_NETWORK_CANDIDATES:sandbox.candidates,CAMPING_NETWORK_VERIFIED:new Set(),uid:(()=>{let i=0;return()=>`test-${++i}`;})(),sleepDateLabelFromIso:(a,b)=>`${a}–${b}`,normalizeSleepCandidate:c=>c};
  vm.runInNewContext(seedFn+';this.seed=seedCampingSafetyNetwork;',seedBox);
  seedBox.seed(production);
  assert.equal(production.sleepSearches.length,9);
  assert.equal(production.sleepSearches.filter(x=>x.mode==='network').reduce((n,x)=>n+x.candidates.length,0),40);
  assert.equal(production.sleepPlaces.length,placeCount+40);
  assert.equal(firstSearch.candidates.length,firstCount);
  seedBox.seed(production);
  assert.equal(production.sleepSearches.length,9,'Seed darf keine Korridore duplizieren');
  assert.equal(production.sleepPlaces.length,placeCount+40,'Seed darf keine Plätze duplizieren');
}
console.log(JSON.stringify({ok:true,archived:state.archive.campingReminders.length,hubs:sandbox.hubs.length,candidates:sandbox.candidates.length,production:!!production}));
