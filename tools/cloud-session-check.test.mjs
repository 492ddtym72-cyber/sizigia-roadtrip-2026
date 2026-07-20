import assert from 'node:assert/strict';
import test from 'node:test';
import {extractCloudUrl,formatSummary,loadLiveStatus,summarizeState} from './cloud-session-check.mjs';

const firebaseState={
  schemaVersion:19,
  meta:{lastSaved:'2026-07-20T14:00:00.000Z'},
  mailAssistant:{runnerMode:'cloud',mailProvider:'gmail',
    reviewQueue:[{id:'r1',status:'pending',excerpt:'private reply text'}],
    draftRequests:[{id:'d1',status:'requested'},{id:'d2',status:'ready'},{id:'d3',status:'sent_detected'}],
    runners:{cloud:{lastSuccessAt:'2026-07-20T13:56:43.122Z',nextRunAt:'2026-07-20T18:00:00.000Z',lastError:''}}},
  sleepSearches:[{candidates:[{status:'awaiting'},{status:'available'}]},{candidates:[{status:'unavailable'},{status:'booked'}]}]
};

test('extractCloudUrl reads the configured Firebase URL',()=>{
  assert.equal(extractCloudUrl("let CLOUD_URL = 'https://example.firebaseio.com/private.json';"),'https://example.firebaseio.com/private.json');
  assert.throws(()=>extractCloudUrl('let CLOUD_URL = null;'),/Firebase-URL/);
});

test('summary contains counts but no message content',()=>{
  const summary=summarizeState(firebaseState,{status:'completed',conclusion:'success',created_at:'2026-07-20T13:56:23Z'});
  assert.equal(summary.schemaVersion,19);
  assert.equal(summary.mail.provider,'gmail');
  assert.equal(summary.mail.pendingReviews,1);
  assert.equal(summary.mail.pendingDrafts,2);
  assert.deepEqual(summary.accommodation.byStatus,{awaiting:1,available:1,unavailable:1,booked:1});
  assert.equal(JSON.stringify(summary).includes('private reply text'),false);
});

test('loader uses GET only and tolerates unavailable GitHub status',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push(options.method||'GET');
    if(String(url).includes('firebaseio.com'))return {ok:true,status:200,json:async()=>firebaseState};
    return {ok:false,status:403,json:async()=>({})};
  };
  const result=await loadLiveStatus({fetchImpl,firebaseUrl:'https://example.firebaseio.com/private.json',workflowUrl:'https://api.github.test/runs'});
  assert.deepEqual(calls,['GET','GET']);
  assert.match(result.warning,/GitHub-Workflowstatus/);
  assert.equal(result.summary.mail.lastSuccessAt,'2026-07-20T13:56:43.122Z');
});

test('loader fails closed when Firebase cannot be read',async()=>{
  const fetchImpl=async()=>({ok:false,status:503,json:async()=>({})});
  await assert.rejects(loadLiveStatus({fetchImpl,firebaseUrl:'https://example.firebaseio.com/private.json',workflowUrl:''}),/Firebase GET 503/);
});

test('human output omits URLs, excerpts, and credentials',()=>{
  const text=formatSummary(summarizeState(firebaseState,null),'Workflowstatus nicht verfügbar');
  assert.match(text,/Schema: 19/);
  assert.match(text,/Offene Mail-Prüfungen: 1/);
  assert.equal(text.includes('private reply text'),false);
  assert.equal(text.includes('firebaseio.com'),false);
  assert.equal(text.includes('refresh_token'),false);
});
