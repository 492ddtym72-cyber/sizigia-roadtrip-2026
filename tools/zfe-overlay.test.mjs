import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

test('amtliche ZFE-Daten enthalten die vier relevanten französischen Zonen und Transitachsen',()=>{
  const app=loadApp();
  const data=app.run(`(()=>({
    checkedAt:window.ZFE_DATA.checkedAt,
    zones:window.ZFE_DATA.areas.features.map(x=>x.properties.id),
    roads:window.ZFE_DATA.transitRoads.features.length
  }))()`);
  assert.equal(data.checkedAt,'2026-07-16');
  assert.deepEqual([...data.zones],['nice','marseille','nimes','montpellier']);
  assert.ok(data.roads>2800,'Amtliche Transitachsen von Marseille und Montpellier fehlen');
});

test('Punktprüfung erkennt Innenbereiche, Nice-Sonderregel und Außenpunkte',()=>{
  const app=loadApp();
  const result=app.run(`(()=>({
    nice:zfeCandidateAssessment({name:'Nice Test',phone:'+33 1',lat:43.703,lng:7.266})?.status,
    marseille:zfeCandidateAssessment({name:'Marseille Test',phone:'+33 1',lat:43.295,lng:5.38})?.status,
    nimes:zfeCandidateAssessment({name:'Nîmes Test',phone:'+33 1',lat:43.836,lng:4.36})?.status,
    montpellier:zfeCandidateAssessment({name:'Montpellier Test',phone:'+33 1',lat:43.61,lng:3.876})?.status,
    outside:zfeCandidateAssessment({name:'Camargue Test',phone:'+33 1',lat:43.654198,lng:4.295583})?.status
  }))()`);
  assert.equal(result.nice,'inside-light-free');
  assert.equal(result.marseille,'inside');
  assert.equal(result.nimes,'inside');
  assert.equal(result.montpellier,'inside');
  assert.notEqual(result.outside,'inside');
});

test('keine vorhandene französische Campingoption liegt unbemerkt in einer beschränkten Dauer-ZFE',()=>{
  const app=loadApp();
  const result=app.run(`(()=>{
    const rows=state.sleepSearches.flatMap(s=>(s.candidates||[]).map(c=>({name:sleepCandidateView(c).name,a:zfeCandidateAssessment(c)})));
    return {inside:rows.filter(x=>x.a&&x.a.status==='inside').map(x=>x.name),privateChecked:!!rows.find(x=>x.name==='Privater Stellplatz · Les Salces')?.a};
  })()`);
  assert.deepEqual([...result.inside],[]);
  assert.equal(result.privateChecked,true);
});

test('ZFE-Schalter bleibt lokal und verändert keine Reisedaten',()=>{
  const app=loadApp();
  const result=app.run(`(()=>{
    const before=JSON.stringify(state),saved=state.meta.lastSaved;
    setSleepZfeVisible(false);
    return {same:before===JSON.stringify(state),saved,after:state.meta.lastSaved,preference:localStorage.getItem(SLEEP_ZFE_LAYER_KEY)};
  })()`);
  assert.equal(result.same,true);
  assert.equal(result.saved,result.after);
  assert.equal(result.preference,'off');
});
