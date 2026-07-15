import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

test('V15 ergänzt neutrales Trip-Profil und Aufgabenfelder ohne alte Erinnerungen zu verlieren', () => {
  const legacy={schemaVersion:13,meta:{lastSaved:'2026-07-14T12:00:00.000Z'},reminders:[{id:'old-task',title:'Tickets prüfen',done:false,priority:true,createdAt:'2026-07-01T10:00:00.000Z'}]};
  const app=loadApp({localStorageData:{'sizigia-roadtrip-2026':JSON.stringify(legacy)}});
  const out=app.run(`(()=>{const r=state.reminders.find(x=>x.id==='old-task');return {version:state.schemaVersion,trip:state.trip,title:r.title,status:r.status,ownerId:r.ownerId,dueDate:r.dueDate,note:r.note,priority:r.priority};})()`);
  assert.equal(out.version,15);
  assert.equal(out.trip.title,'Roadtrip');
  assert.equal(out.trip.startDate,'2026-08-02');
  assert.equal(out.trip.endDate,'2026-08-17');
  assert.equal(out.title,'Tickets prüfen');
  assert.equal(out.status,'open');
  assert.equal(out.ownerId,null);
  assert.equal(out.dueDate,'');
  assert.equal(out.note,'');
  assert.equal(out.priority,true);
});

test('Routenkontext erkennt Vorbereitung, Reisetag und nächste Etappe deterministisch', () => {
  const app=loadApp();
  const before=app.run(`tripDayContext(new Date('2026-07-15T12:00:00'))`);
  assert.equal(before.phase,'before');
  assert.equal(before.timing,'18 Tage bis zur Abfahrt');
  assert.match(before.stage.to,/Gardasee/);

  const underway=app.run(`tripDayContext(new Date('2026-08-04T12:00:00'))`);
  assert.equal(underway.phase,'during');
  assert.equal(underway.timing,'Reisetag 3');
  assert.equal(underway.stageExact,true);
  assert.match(underway.stage.to,/Côte d.Azur/);
});

test('Routenkontext berücksichtigt eine frühere erste Etappe, ohne das Trip-Profil umzuschreiben', () => {
  const app=loadApp();
  const out=app.run(`(()=>{const original=state.trip.startDate;state.routes.find(r=>r.id===state.selectedRoute).stages.unshift({id:'early',date:'Sa 01.08.',from:'Hamburg',to:'Innsbruck',km:'900 km',time:'9 Std'});const ctx=tripDayContext(new Date('2026-07-15T12:00:00'));return {timing:ctx.timing,start:ctx.start,stored:state.trip.startDate,original};})()`);
  assert.equal(out.timing,'17 Tage bis zur Abfahrt');
  assert.equal(out.start,'2026-08-01');
  assert.equal(out.stored,out.original);
});

test('V15 neutralisiert nur den alten Standardtitel und bewahrt eigene Reisetitel', () => {
  const oldStandard={schemaVersion:14,meta:{lastSaved:'2026-07-14T12:00:00.000Z'},trip:{id:'trip-sizigia-2026',title:'Sizigia 2026',subtitle:'Roadtrip · München → Huesca',startDate:'2026-08-02',endDate:'2026-08-17',homeBase:'Innsbruck'}};
  const standard=loadApp({localStorageData:{'sizigia-roadtrip-2026':JSON.stringify(oldStandard)}}).run(`state.trip`);
  assert.equal(standard.title,'Roadtrip');
  assert.equal(standard.subtitle,'Gemeinsam unterwegs');

  const custom={...oldStandard,trip:{...oldStandard.trip,title:'Sommerferien mit Freunden',subtitle:'Alpen und Meer'}};
  const preserved=loadApp({localStorageData:{'sizigia-roadtrip-2026':JSON.stringify(custom)}}).run(`state.trip`);
  assert.equal(preserved.title,'Sommerferien mit Freunden');
  assert.equal(preserved.subtitle,'Alpen und Meer');
});

test('Aufgabe behält Entscheidung-Status nach Erledigen und Wiederöffnen', () => {
  const app=loadApp();
  const out=app.run(`(()=>{const r={id:'decision-task',title:'Route wählen',done:false,status:'decision',priority:false,ownerId:'c-freddi',dueDate:'2026-08-01',note:'',createdAt:new Date().toISOString(),createdBy:null};state.reminders.push(r);toggleReminder(r.id);const closed={done:r.done,status:r.status,previousStatus:r.previousStatus};toggleReminder(r.id);return {closed,reopened:{done:r.done,status:r.status,previousStatus:r.previousStatus||null}};})()`);
  assert.equal(out.closed.done,true);
  assert.equal(out.closed.status,'done');
  assert.equal(out.closed.previousStatus,'decision');
  assert.equal(out.reopened.done,false);
  assert.equal(out.reopened.status,'decision');
  assert.equal(out.reopened.previousStatus,null);
});

test('Startseite bleibt kompakt, neutral und verändert den Reise-State nicht', () => {
  const app=loadApp();
  const out=app.run(`(()=>{const before=JSON.stringify(state);renderOverview();const html=document.getElementById('page-uebersicht').innerHTML;return {same:before===JSON.stringify(state),html};})()`);
  assert.equal(out.same,true);
  assert.match(out.html,/route-hero/);
  assert.doesNotMatch(out.html,/Was jetzt zählt|Camperlänge ergänzen|Noch keine Suche/);
});
