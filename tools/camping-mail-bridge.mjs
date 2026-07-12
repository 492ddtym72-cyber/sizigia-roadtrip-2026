#!/usr/bin/env node
// Deterministische Datenbrücke für den Camping-Mail-Assistenten.
// Apple Mail wird ausschließlich von der kontrollierten Automation gelesen;
// diese Brücke erzeugt Vorlagen und schreibt konfliktgeschützt nach Firebase.
import fs from 'node:fs';
import {draftBody as sharedDraftBody} from './camping-mail-templates.mjs';

const ROOT=new URL('../',import.meta.url);
const appSource=fs.readFileSync(new URL('app.js',ROOT),'utf8');
const CLOUD_URL=appSource.match(/CLOUD_URL\s*=\s*'([^']+)'/)?.[1]
  || fs.readFileSync(new URL('index.html',ROOT),'utf8').match(/CLOUD_URL\s*=\s*'([^']+)'/)?.[1];
if(!CLOUD_URL)throw new Error('CLOUD_URL nicht gefunden');
const command=process.argv[2]||'scan';
async function getState(){const r=await fetch(CLOUD_URL,{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});if(!r.ok)throw new Error('Firebase GET '+r.status);return {state:await r.json(),etag:r.headers.get('etag')};}
function nextStamp(prev){const now=Date.now(),old=Date.parse(prev||'')||0;return new Date(Math.max(now,old+1)).toISOString();}
function nextRunStamp(){const now=new Date();for(const h of [8,14,20]){const d=new Date(now);d.setHours(h,0,0,0);if(d>now)return d.toISOString();}const d=new Date(now);d.setDate(d.getDate()+1);d.setHours(8,0,0,0);return d.toISOString();}
async function conditionalUpdate(mutator){
  for(let attempt=0;attempt<3;attempt++){
    const {state,etag}=await getState();const changed=await mutator(state);if(!changed)return state;
    state.meta=state.meta||{};state.meta.lastSaved=nextStamp(state.meta.lastSaved);
    const r=await fetch(CLOUD_URL,{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(state)});
    if(r.status===412)continue;if(!r.ok)throw new Error('Firebase PUT '+r.status);return state;
  }
  throw new Error('Firebase-Konflikt nach 3 Versuchen');
}
function locate(state,searchId,candidateId){const search=(state.sleepSearches||[]).find(x=>x.id===searchId),candidate=search?.candidates?.find(x=>x.id===candidateId),place=(state.sleepPlaces||[]).find(x=>x.id===candidate?.placeId);return {search,candidate,place};}
async function scan(){
  const {state}=await getState();
  const candidates=[];(state.sleepSearches||[]).forEach(search=>(search.candidates||[]).forEach(c=>{const p=(state.sleepPlaces||[]).find(x=>x.id===c.placeId)||{};candidates.push({searchId:search.id,candidateId:c.id,name:p.name||c.name,region:p.region||c.region,email:p.email||c.email,phone:p.phone||c.phone,link:p.link||c.link,lat:p.lat??c.lat,lng:p.lng??c.lng,status:c.status,dateLabel:search.dateLabel});}));
  return {runnerMode:state.mailAssistant?.runnerMode||'local',processedMessageIds:state.mailAssistant?.processedMessageIds||[],candidates,draftRequests:(state.mailAssistant?.draftRequests||[]).filter(x=>['opened','requested','ready','fallback'].includes(x.status)),reviewQueue:(state.mailAssistant?.reviewQueue||[]).filter(x=>x.status==='pending')};
}
async function draftPayload(requestId){const {state}=await getState(),req=(state.mailAssistant?.draftRequests||[]).find(x=>x.id===requestId);if(!req)throw new Error('Entwurfsanfrage nicht gefunden');const {search,candidate,place}=locate(state,req.searchId,req.candidateId);return {requestId:req.id,messageId:req.messageId,body:sharedDraftBody(state,search,candidate,place,req.template),template:req.template};}
async function setMode(value){if(!['local','shadow','cloud'].includes(value))throw new Error('Modus muss local, shadow oder cloud sein');return conditionalUpdate(state=>{state.mailAssistant=state.mailAssistant||{};state.mailAssistant.runnerMode=value;return true;});}
async function applyEvents(encoded){
  const events=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
  return conditionalUpdate(state=>{
    const a=state.mailAssistant||(state.mailAssistant={}),now=new Date().toISOString();
    a.processedMessageIds=Array.isArray(a.processedMessageIds)?a.processedMessageIds:[];a.draftRequests=Array.isArray(a.draftRequests)?a.draftRequests:[];a.reviewQueue=Array.isArray(a.reviewQueue)?a.reviewQueue:[];a.runners=a.runners||{};const local=a.runners.local||(a.runners.local={});let changed=events.length===0,hadError=false;
    for(const e of events){
      if(e.assistantError!==undefined){a.lastError=local.lastError=String(e.assistantError||'');hadError=!!local.lastError;changed=true;continue;}
      if(e.draftRequest){if(!a.draftRequests.some(x=>x.id===e.draftRequest.id))a.draftRequests.push(e.draftRequest);changed=true;continue;}
      if(e.reviewItem){if(!a.reviewQueue.some(x=>x.id===e.reviewItem.id))a.reviewQueue.push({...e.reviewItem,excerpt:String(e.reviewItem.excerpt||'').slice(0,600)});changed=true;continue;}
      const {candidate,place}=locate(state,e.searchId,e.candidateId);if(!candidate)continue;
      ['status','reply','replyQuote','nextAction','nextActionDate','price','tax','finalPrice','deposit','bookingRef','cancellationDeadline','arrivalWindow','parking','pitchNote','callWindow','mailMessageId','mailThreadSubject','repliedAt','draftState','confirmedAt'].forEach(k=>{if(e[k]!==undefined)candidate[k]=e[k];});
      ['region','email','phone','link','lat','lng'].forEach(k=>{if(e[k]!==undefined)(place||candidate)[k]=e[k];});
      if(e.requestId){const req=a.draftRequests.find(x=>x.id===e.requestId);if(req){if(e.requestStatus)req.status=e.requestStatus;if(e.readyAt)req.readyAt=e.readyAt;if(e.sentAt)req.sentAt=e.sentAt;if(e.error)req.error=e.error;}}
      if(e.messageId&&!a.processedMessageIds.includes(e.messageId))a.processedMessageIds.push(e.messageId);changed=true;
      if(e.status||e.reply){state.log=Array.isArray(state.log)?state.log:[];state.log.push({id:`mail-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,ts:now,who:'Mail-Assistent',desc:`hat die Antwort von „${place?.name||candidate.name}“ ausgewertet`,undo:null});state.log=state.log.slice(-60);}
    }
    a.processedMessageIds=a.processedMessageIds.slice(-500);a.reviewQueue=a.reviewQueue.slice(-50);a.lastRunAt=local.lastRunAt=now;a.nextRunAt=local.nextRunAt=nextRunStamp();if(!hadError){a.lastSuccessAt=local.lastSuccessAt=now;a.lastError=local.lastError='';}return changed;
  });
}

try{
  if(command==='self-test'){const sample={crew:Array(6),vehicles:[{id:'v-camper',lengthM:'6.4'}]},search={startDate:'2026-08-02',endDate:'2026-08-03'},candidate={name:'Test Camping'},place={name:'Test Camping'},modes=['inquiry','followup','reserve','call','dimensions','missing','deposit','clarify'],bodies=modes.map(mode=>sharedDraftBody(sample,search,candidate,place,mode));if(bodies.some(body=>body.includes('Frederic')||body.includes('roadtrip group')||!body.endsWith('Kind regards,\n\n')))throw new Error('Signatur-Test fehlgeschlagen');if(bodies[2].includes('I would like to ask if you have availability'))throw new Error('Reservierungsantwort wiederholt Verfügbarkeitsanfrage');if(bodies.some(body=>!body.includes('2 August 2026')||!body.includes('3 August 2026')))throw new Error('Datumstest fehlgeschlagen');console.log(JSON.stringify({ok:true,templates:modes.length,blankSignature:true,reservationDoesNotRepeatInquiry:true,exactDates:true}));}
  else if(command==='draft-payload'){console.log(JSON.stringify(await draftPayload(process.argv[3]||'')));}
  else if(command==='set-mode'){await setMode(process.argv[3]||'');console.log(JSON.stringify({ok:true,runnerMode:process.argv[3]}));}
  else if(command==='apply'){await applyEvents(process.argv[3]||'');console.log(JSON.stringify({ok:true}));}
  else {console.log(JSON.stringify(await scan(),null,2));}
}catch(e){console.error(JSON.stringify({ok:false,error:String(e.message||e)}));process.exitCode=1;}
