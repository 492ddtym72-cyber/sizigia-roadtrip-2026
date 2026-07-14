import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

test('V14 ergänzt Trip-Profil und Aufgabenfelder ohne alte Erinnerungen zu verlieren', () => {
  const legacy={schemaVersion:13,meta:{lastSaved:'2026-07-14T12:00:00.000Z'},reminders:[{id:'old-task',title:'Tickets prüfen',done:false,priority:true,createdAt:'2026-07-01T10:00:00.000Z'}]};
  const app=loadApp({localStorageData:{'sizigia-roadtrip-2026':JSON.stringify(legacy)}});
  const out=app.run(`(()=>{const r=state.reminders.find(x=>x.id==='old-task');return {version:state.schemaVersion,trip:state.trip,title:r.title,status:r.status,ownerId:r.ownerId,dueDate:r.dueDate,note:r.note,priority:r.priority};})()`);
  assert.equal(out.version,14);
  assert.equal(out.trip.startDate,'2026-08-02');
  assert.equal(out.trip.endDate,'2026-08-17');
  assert.equal(out.title,'Tickets prüfen');
  assert.equal(out.status,'open');
  assert.equal(out.ownerId,null);
  assert.equal(out.dueDate,'');
  assert.equal(out.note,'');
  assert.equal(out.priority,true);
});

test('Today erkennt Vorbereitung, Reisetag und nächste Etappe deterministisch', () => {
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

test('Today berücksichtigt eine frühere erste Etappe, ohne das Trip-Profil umzuschreiben', () => {
  const app=loadApp();
  const out=app.run(`(()=>{const original=state.trip.startDate;state.routes.find(r=>r.id===state.selectedRoute).stages.unshift({id:'early',date:'Sa 01.08.',from:'Hamburg',to:'Innsbruck',km:'900 km',time:'9 Std'});const ctx=tripDayContext(new Date('2026-07-15T12:00:00'));return {timing:ctx.timing,start:ctx.start,stored:state.trip.startDate,original};})()`);
  assert.equal(out.timing,'17 Tage bis zur Abfahrt');
  assert.equal(out.start,'2026-08-01');
  assert.equal(out.stored,out.original);
});

test('Today zeigt keinen unpassenden späteren Schlafplatz zur aktuellen Etappe', () => {
  const app=loadApp();
  const out=app.run(`(()=>{const ctx=tripDayContext(new Date('2026-07-15T12:00:00'));return {stageIso:ctx.stageIso,search:todaySleepSearch(ctx)};})()`);
  assert.equal(out.stageIso,'2026-08-02');
  assert.equal(out.search,null);
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

test('Today zeigt nur abgeleitete Hinweise und verändert den Reise-State nicht', () => {
  const app=loadApp();
  const out=app.run(`(()=>{state.sleepSearches[0].candidates[0].nextAction='Camperlänge mitteilen';state.vehicles.find(v=>v.id==='v-camper').lengthM='';const before=JSON.stringify(state),html=renderTodayCockpit();return {same:before===JSON.stringify(state),html};})()`);
  assert.equal(out.same,true);
  assert.match(out.html,/Was jetzt zählt/);
  assert.match(out.html,/Camperlänge ergänzen/);
  assert.match(out.html,/Übernachtung/);
});
