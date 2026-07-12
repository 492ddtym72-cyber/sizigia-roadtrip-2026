#!/usr/bin/env node
// Deterministische Datenbrücke für den Camping-Mail-Assistenten.
// Apple Mail wird ausschließlich von der kontrollierten Automation gelesen;
// diese Brücke erzeugt Vorlagen und schreibt konfliktgeschützt nach Firebase.
import fs from 'node:fs';

const ROOT=new URL('../',import.meta.url), html=fs.readFileSync(new URL('index.html',ROOT),'utf8');
const CLOUD_URL=html.match(/CLOUD_URL\s*=\s*'([^']+)'/)?.[1];
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
function fmtDate(iso){return iso?new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'';}
function draftBody(state,search,candidate,place,mode){
  const name=place?.name||candidate.name||'Camping',dates=search.startDate&&search.endDate?`from ${fmtDate(search.startDate)} to ${fmtDate(search.endDate)}`:`for the night of ${search.dateLabel||''}`,party=`${(state.crew||[]).length} adults travelling with one camper and one small car`,end='Thank you very much.\n\nKind regards,\n\n';
  if(mode==='reserve')return `Dear ${name} team,\n\nThank you for confirming that you can offer us a place ${dates}.\n\nWe would like to accept your offer and reserve it for ${party}.\n\nCould you please confirm when the reservation is definitive? If not already confirmed, please also let us know the total price and whether the small car can be parked at or near the place.\n\n${end}`;
  if(mode==='dimensions'){const v=(state.vehicles||[]).find(x=>x.id==='v-camper')||{};if(!v.lengthM)throw new Error('Camperlänge fehlt');return `Dear ${name} team,\n\nThank you for your reply. The camper is ${v.lengthM} metres long${v.widthM?`, ${v.widthM} metres wide`:''}${v.heightM?` and ${v.heightM} metres high`:''}${v.model?` (${v.model})`:''}.\n\nCould you please check whether a suitable place is available ${dates}?\n\n${end}`;}
  if(mode==='missing')return `Dear ${name} team,\n\nThank you for your reply regarding our stay ${dates}. Could you please also confirm the total price and whether our small car can be parked at or near the place?\n\n${end}`;
  if(mode==='deposit')return `Dear ${name} team,\n\nThank you for the booking information for our stay ${dates}. Before we arrange the deposit, could you please confirm the required amount, payment deadline and reference we should include with the payment?\n\n${end}`;
  if(mode==='followup')return `Dear ${name} team,\n\nI am following up regarding availability ${dates} for ${party}. Has a pitch become available in the meantime?\n\nIf you are still full, would it be possible to call you spontaneously on the day in case of a cancellation?\n\n${end}`;
  if(mode==='clarify')return `Dear ${name} team,\n\nThank you for your reply. Before we proceed, could you please confirm that the offer applies ${dates} to ${party}, including parking for the small car?\n\n${end}`;
  return `Dear ${name} team,\n\nI would like to ask if you have availability ${dates} for ${party}.\n\nIf advance reservations are not available or you are currently full, would it still be possible to call you spontaneously on the day in case a pitch becomes available?\n\nCould you please also let me know the total price and whether the small car can be parked at or near the pitch?\n\n${end}`;
}
async function scan(){
  const {state}=await getState();
  const candidates=[];(state.sleepSearches||[]).forEach(search=>(search.candidates||[]).forEach(c=>{const p=(state.sleepPlaces||[]).find(x=>x.id===c.placeId)||{};candidates.push({searchId:search.id,candidateId:c.id,name:p.name||c.name,region:p.region||c.region,email:p.email||c.email,phone:p.phone||c.phone,link:p.link||c.link,lat:p.lat??c.lat,lng:p.lng??c.lng,status:c.status,dateLabel:search.dateLabel});}));
  return {processedMessageIds:state.mailAssistant?.processedMessageIds||[],candidates,draftRequests:(state.mailAssistant?.draftRequests||[]).filter(x=>['requested','ready','fallback'].includes(x.status))};
}
async function draftPayload(requestId){const {state}=await getState(),req=(state.mailAssistant?.draftRequests||[]).find(x=>x.id===requestId);if(!req)throw new Error('Entwurfsanfrage nicht gefunden');const {search,candidate,place}=locate(state,req.searchId,req.candidateId);return {requestId:req.id,messageId:req.messageId,body:draftBody(state,search,candidate,place,req.template),template:req.template};}
async function applyEvents(encoded){
  const events=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
  return conditionalUpdate(state=>{const a=state.mailAssistant||(state.mailAssistant={});a.processedMessageIds=Array.isArray(a.processedMessageIds)?a.processedMessageIds:[];a.draftRequests=Array.isArray(a.draftRequests)?a.draftRequests:[];let changed=events.length===0,hadError=false;for(const e of events){if(e.assistantError!==undefined){a.lastError=String(e.assistantError||'');hadError=!!a.lastError;changed=true;continue;}const {candidate,place}=locate(state,e.searchId,e.candidateId);if(!candidate)continue;['status','reply','nextAction','nextActionDate','price','tax','finalPrice','deposit','bookingRef','cancellationDeadline','arrivalWindow','parking','pitchNote','callWindow','mailMessageId','mailThreadSubject','repliedAt','draftState','confirmedAt'].forEach(k=>{if(e[k]!==undefined)candidate[k]=e[k];});['region','email','phone','link','lat','lng'].forEach(k=>{if(e[k]!==undefined)(place||candidate)[k]=e[k];});if(e.requestId){const req=a.draftRequests.find(x=>x.id===e.requestId);if(req){if(e.requestStatus)req.status=e.requestStatus;if(e.readyAt)req.readyAt=e.readyAt;if(e.sentAt)req.sentAt=e.sentAt;if(e.error)req.error=e.error;}}if(e.messageId&&!a.processedMessageIds.includes(e.messageId))a.processedMessageIds.push(e.messageId);changed=true;}a.processedMessageIds=a.processedMessageIds.slice(-200);a.lastRunAt=new Date().toISOString();a.nextRunAt=nextRunStamp();if(!hadError){a.lastSuccessAt=a.lastRunAt;a.lastError='';}return changed;});
}

try{
  if(command==='self-test'){const sample={crew:Array(6),vehicles:[{id:'v-camper',lengthM:'6.4'}]},search={startDate:'2026-08-02',endDate:'2026-08-03'},candidate={name:'Test Camping'},place={name:'Test Camping'},modes=['inquiry','followup','reserve','dimensions','missing','deposit','clarify'],bodies=modes.map(mode=>draftBody(sample,search,candidate,place,mode));if(bodies.some(body=>body.includes('Frederic')||body.includes('roadtrip group')||!body.endsWith('Kind regards,\n\n')))throw new Error('Signatur-Test fehlgeschlagen');if(bodies[2].includes('I would like to ask if you have availability'))throw new Error('Reservierungsantwort wiederholt Verfügbarkeitsanfrage');if(bodies.some(body=>!body.includes('2 August 2026')||!body.includes('3 August 2026')))throw new Error('Datumstest fehlgeschlagen');console.log(JSON.stringify({ok:true,templates:modes.length,blankSignature:true,reservationDoesNotRepeatInquiry:true,exactDates:true}));}
  else if(command==='draft-payload'){console.log(JSON.stringify(await draftPayload(process.argv[3]||'')));}
  else if(command==='apply'){await applyEvents(process.argv[3]||'');console.log(JSON.stringify({ok:true}));}
  else {console.log(JSON.stringify(await scan(),null,2));}
}catch(e){console.error(JSON.stringify({ok:false,error:String(e.message||e)}));process.exitCode=1;}
