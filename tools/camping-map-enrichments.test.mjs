import test from 'node:test';
import assert from 'node:assert/strict';
import {FIRST_NIGHT_REJECTED_ENRICHMENTS,applyPlaceEnrichments} from './camping-map-enrichments.mjs';

test('positioniert alle archivierten Absagen, ohne Antwortstatus oder Nutzerdaten zu verändern',()=>{
  assert.equal(FIRST_NIGHT_REJECTED_ENRICHMENTS.length,12);
  assert.ok(FIRST_NIGHT_REJECTED_ENRICHMENTS.every(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)));
  assert.ok(FIRST_NIGHT_REJECTED_ENRICHMENTS.every(x=>x.region&&x.email&&x.phone&&x.officialUrl&&x.link));

  const state={
    sleepPlaces:FIRST_NIGHT_REJECTED_ENRICHMENTS.map((x,i)=>({id:`p-${i}`,name:x.name,createdAt:'old'})),
    sleepSearches:[{id:'first',candidates:FIRST_NIGHT_REJECTED_ENRICHMENTS.map((x,i)=>({id:`c-${i}`,placeId:`p-${i}`,name:x.name,status:'unavailable',reply:`Absage ${i}`}))}],
    log:[],meta:{lastSaved:'2026-07-20T00:00:00.000Z'}
  };
  const result=applyPlaceEnrichments(state,FIRST_NIGHT_REJECTED_ENRICHMENTS,'2026-07-20T16:30:00.000Z');

  assert.deepEqual(result,{changed:12,skippedVerified:0,missing:[]});
  assert.ok(state.sleepPlaces.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.contactVerified===true));
  assert.ok(state.sleepSearches[0].candidates.every((c,i)=>c.status==='unavailable'&&c.reply===`Absage ${i}`));
  assert.equal(state.log.length,1);
});

test('bewahrt bereits verifizierte Kontaktdaten und ist beim zweiten Lauf idempotent',()=>{
  const seed=FIRST_NIGHT_REJECTED_ENRICHMENTS[0];
  const state={sleepPlaces:[{id:'p',name:seed.name,email:'owner@example.test',lat:1,lng:2,contactVerified:true}],sleepSearches:[],log:[],meta:{}};
  const first=applyPlaceEnrichments(state,[seed],'2026-07-20T16:30:00.000Z');
  assert.deepEqual(first,{changed:0,skippedVerified:1,missing:[]});
  assert.equal(state.sleepPlaces[0].email,'owner@example.test');
  assert.equal(state.sleepPlaces[0].lat,1);

  const fresh={sleepPlaces:[{id:'p',name:seed.name}],sleepSearches:[],log:[],meta:{}};
  assert.equal(applyPlaceEnrichments(fresh,[seed],'2026-07-20T16:30:00.000Z').changed,1);
  assert.equal(applyPlaceEnrichments(fresh,[seed],'2026-07-20T16:31:00.000Z').changed,0);
  assert.equal(fresh.log.length,1);
});
