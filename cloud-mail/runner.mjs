#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {simpleParser} from 'mailparser';
import {classifyReply,forwardedReviewResult,matchCandidate,matchForwardedCandidate,messageFingerprint,normalizeSubject,parseForwardedMessage,safeExcerpt} from '../tools/camping-mail-core.mjs';
import {draftBody,draftSubject} from '../tools/camping-mail-templates.mjs';
import {authFailureLabel,connectMailbox,mailProviderName,passwordCandidates} from './mailbox-providers.mjs';

const ROOT=new URL('../',import.meta.url),OWNER=`github-${process.env.GITHUB_RUN_ID||'manual'}-${process.pid}`,LEASE_MS=12*60*1000;
const mode=String(process.env.MAIL_RUNNER_MODE||'disabled').toLowerCase();
const provider=mailProviderName(process.env);
const nowIso=()=>new Date().toISOString();
const RUN_HOURS_UTC=[6,12,18];
const nextRun=()=>{const now=new Date();for(const hour of RUN_HOURS_UTC){const d=new Date(now);d.setUTCHours(hour,0,0,0);if(d>now)return d.toISOString();}const d=new Date(now);d.setUTCDate(d.getUTCDate()+1);d.setUTCHours(RUN_HOURS_UTC[0],0,0,0);return d.toISOString();};
const cleanHeader=v=>String(v||'').replace(/[\r\n]+/g,' ').trim();

function cloudUrl(){const src=fs.readFileSync(new URL('app.js',ROOT),'utf8'),url=src.match(/CLOUD_URL\s*=\s*'([^']+)'/)?.[1];if(!url)throw new Error('Firebase-Konfiguration fehlt');return url;}
async function readState(){const r=await fetch(cloudUrl(),{headers:{'X-Firebase-ETag':'true'},cache:'no-store'});if(!r.ok)throw new Error(`Firebase GET ${r.status}`);return {state:await r.json(),etag:r.headers.get('etag')};}
function stamp(state){state.meta=state.meta||{};const old=Date.parse(state.meta.lastSaved||'')||0;state.meta.lastSaved=new Date(Math.max(Date.now(),old+1)).toISOString();}
async function updateState(mutator){for(let i=0;i<3;i++){const {state,etag}=await readState();const changed=await mutator(state);if(!changed)return state;stamp(state);const r=await fetch(cloudUrl(),{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(state)});if(r.status===412)continue;if(!r.ok)throw new Error(`Firebase PUT ${r.status}`);return state;}throw new Error('Firebase-Konflikt nach 3 Versuchen');}
function assistant(state){const a=state.mailAssistant||(state.mailAssistant={});a.processedMessageIds=Array.isArray(a.processedMessageIds)?a.processedMessageIds:[];a.draftRequests=Array.isArray(a.draftRequests)?a.draftRequests:[];a.reviewQueue=Array.isArray(a.reviewQueue)?a.reviewQueue:[];a.shadowResults=Array.isArray(a.shadowResults)?a.shadowResults:[];a.runners=a.runners||{};a.runners.cloud=a.runners.cloud||{};return a;}
function candidates(state){const places=new Map((state.sleepPlaces||[]).map(p=>[p.id,p]));return (state.sleepSearches||[]).flatMap(search=>(search.candidates||[]).map(candidate=>{const p=places.get(candidate.placeId)||{};return {searchId:search.id,candidateId:candidate.id,name:p.name||candidate.name,email:p.email||candidate.email,threadSubject:candidate.mailThreadSubject||'',dateLabel:search.dateLabel};}));}
function locate(state,event){const search=(state.sleepSearches||[]).find(x=>x.id===event.searchId),candidate=search?.candidates?.find(x=>x.id===event.candidateId),place=(state.sleepPlaces||[]).find(x=>x.id===candidate?.placeId);return {search,candidate,place};}
function syncDerived(state,search,candidate,place){
  candidate.reminderId=null;
}
function logMailChange(state,name,desc='ausgewertet'){state.log=Array.isArray(state.log)?state.log:[];state.log.push({id:`mail-${crypto.randomUUID()}`,ts:nowIso(),who:'Mail-Assistent',desc:`hat die Antwort von „${name}“ ${desc}`,undo:null});state.log=state.log.slice(-60);}
async function acquireLease(){let acquired=false;await updateState(state=>{const a=assistant(state),until=Date.parse(a.lease?.expiresAt||'');if(until>Date.now()&&a.lease.owner!==OWNER)return false;a.lease={owner:OWNER,expiresAt:new Date(Date.now()+LEASE_MS).toISOString()};acquired=true;return true;});if(!acquired)throw new Error('Ein anderer Mail-Check läuft bereits');}
async function releaseLease(error=''){await updateState(state=>{const a=assistant(state),r=a.runners.cloud;a.runnerMode=mode;a.mailProvider=provider;r.provider=provider;r.lastRunAt=nowIso();r.nextRunAt=nextRun();if(error)r.lastError=error;else{r.lastSuccessAt=r.lastRunAt;r.lastError='';}if(a.lease?.owner===OWNER)a.lease=null;return true;});}
async function forwardedFromMail(mail){
  const inline=parseForwardedMessage(mail.text||'');if(inline)return inline;
  for(const attachment of mail.attachments||[]){
    if(!/^message\/rfc822\b/i.test(attachment.contentType||''))continue;
    const nested=await simpleParser(attachment.content,{skipImageLinks:true,maxHtmlLengthToParse:200000});
    const from=(nested.from?.value||[]).map(x=>x.address).filter(Boolean).join(', '),to=(nested.to?.value||[]).map(x=>x.address).filter(Boolean).join(', ');
    if(from||to)return {from,to,subject:nested.subject||'',body:nested.text||''};
  }
  return null;
}
function draftMessageId(requestId){return `<sizigia-${crypto.createHash('sha256').update(String(requestId||'')).digest('hex').slice(0,32)}@draft.invalid>`;}
function rawDraft({from,to,subject,body,inReplyTo,messageId}){const enc=`=?UTF-8?B?${Buffer.from(cleanHeader(subject)).toString('base64')}?=`,id=cleanHeader(messageId)||`<sizigia-${crypto.randomUUID()}@local.invalid>`,refs=inReplyTo?`In-Reply-To: ${cleanHeader(inReplyTo)}\r\nReferences: ${cleanHeader(inReplyTo)}\r\n`:'';return Buffer.from(`From: ${cleanHeader(from)}\r\nTo: ${cleanHeader(to)}\r\nSubject: ${enc}\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: ${id}\r\n${refs}MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${String(body).replace(/\r?\n/g,'\r\n')}`);}
async function collectInbox(mailbox,state){
  const all=candidates(state),processed=new Set(assistant(state).processedMessageIds),envs=await mailbox.list('inbox'),events=[];
  for(const m of envs){
    const id=m.messageId||`${provider}:${m.id}`;if(processed.has(id))continue;
    const envelopeSubject=m.subject||'',direct=matchCandidate({from:m.from,subject:envelopeSubject},all),couldBeForwarded=/^(?:fwd?|wg|tr|rv|i)\s*:/i.test(envelopeSubject);
    if(!direct&&!couldBeForwarded)continue;
    const raw=await mailbox.source('inbox',m.id),mail=await simpleParser(raw,{skipImageLinks:true,maxHtmlLengthToParse:200000}),receivedAt=(m.internalDate||mail.date||new Date()).toISOString();
    if(direct){events.push({...direct,messageId:id,receivedAt,subject:envelopeSubject,result:classifyReply(mail.text||'')});continue;}
    const forwarded=await forwardedFromMail(mail),forwardMatch=matchForwardedCandidate(forwarded,all);if(!forwardMatch)continue;
    events.push({...forwardMatch.candidate,messageId:id,receivedAt,subject:forwarded.subject||envelopeSubject,source:'forwarded',forwardDirection:forwardMatch.direction,result:forwardedReviewResult(forwarded,forwardMatch.direction)});
  }
  return events;
}
async function createDrafts(mailbox,state){if(mode!=='cloud')return [];const events=[],existingIds=new Set((await mailbox.list('drafts')).map(m=>cleanHeader(m.messageId)));for(const req of assistant(state).draftRequests.filter(x=>x.status==='requested')){const found=locate(state,req);if(!found.candidate||!found.search)continue;const to=found.place?.email||found.candidate.email;if(!to)continue;const body=draftBody(state,found.search,found.candidate,found.place,req.template),subject=draftSubject(found.search,{...found.candidate,name:found.place?.name||found.candidate.name},req.template),messageId=draftMessageId(req.id);if(!existingIds.has(messageId)){await mailbox.appendDraft(rawDraft({from:mailbox.email,to,subject,body,inReplyTo:req.messageId,messageId}));existingIds.add(messageId);}events.push({type:'draft',requestId:req.id,readyAt:nowIso()});}return events;}
async function detectSent(mailbox,state){if(mode!=='cloud')return [];const envs=await mailbox.list('sent',20),events=[];for(const req of assistant(state).draftRequests.filter(x=>x.status==='ready')){const {search,candidate,place}=locate(state,req);if(!candidate||!search)continue;const email=(place?.email||candidate.email||'').toLowerCase(),subject=normalizeSubject(draftSubject(search,{...candidate,name:place?.name||candidate.name},req.template)),created=Date.parse(req.createdAt||0);const hit=envs.find(m=>Date.parse(m.internalDate||0)>=created&&m.to.toLowerCase()===email&&normalizeSubject(m.subject||'')===subject);if(hit)events.push({type:'sent',requestId:req.id,searchId:req.searchId,candidateId:req.candidateId,sentAt:(hit.internalDate||new Date()).toISOString()});}return events;}
async function applyEvents(events){return updateState(state=>{
  const a=assistant(state);
  for(const e of events){
    if(e.type==='draft'){const req=a.draftRequests.find(x=>x.id===e.requestId);if(req&&req.status==='requested'){req.status='ready';req.readyAt=e.readyAt;}continue;}
    if(e.type==='sent'){const req=a.draftRequests.find(x=>x.id===e.requestId),{search,candidate,place}=locate(state,e);if(req&&candidate&&req.status==='ready'){const policy=['network_policy','inquiry','followup'].includes(req.template);req.status='sent_detected';req.sentAt=e.sentAt;candidate.status=policy?'awaiting':'reserving';candidate.draftState='sent';candidate.contactedAt=e.sentAt;candidate.nextAction=policy?'Auf Antwort warten':'Auf definitive Bestätigung warten';syncDerived(state,search,candidate,place);logMailChange(state,place?.name||candidate.name,'als gesendet erkannt');}continue;}
    if(!e.result)continue;
    if(e.messageId&&a.processedMessageIds.includes(e.messageId))continue;
    if(mode==='shadow'){const key=messageFingerprint(e.messageId);if(!a.shadowResults.some(x=>x.messageFingerprint===key))a.shadowResults.push({messageFingerprint:key,candidateId:e.candidateId,predictedStatus:e.result.status,at:nowIso()});continue;}
    const {search,candidate,place}=locate(state,e);if(!candidate)continue;
    if(e.result.status==='review'||e.result.status==='booked'){const id=messageFingerprint(e.messageId);if(!a.reviewQueue.some(x=>x.id===id))a.reviewQueue.push({id,messageIdHash:id,searchId:e.searchId,candidateId:e.candidateId,campsiteName:place?.name||candidate.name,dateLabel:search.dateLabel,receivedAt:e.receivedAt,subject:e.subject,excerpt:safeExcerpt(e.result.excerpt,600),suggestedStatus:e.result.suggestedStatus||(e.result.status==='booked'?'booked':''),source:e.source||'direct',forwardDirection:e.forwardDirection||'',status:'pending'});logMailChange(state,place?.name||candidate.name,e.source==='forwarded'?'als Weiterleitung zur Prüfung vorgemerkt':'zur Prüfung vorgemerkt');}
    else{candidate.status=e.result.status;candidate.reply=e.result.summary;candidate.replyQuote=e.result.replyQuote;candidate.nextAction=e.result.nextAction;candidate.repliedAt=e.receivedAt;candidate.mailMessageId=e.messageId;candidate.mailThreadSubject=e.subject;syncDerived(state,search,candidate,place);logMailChange(state,place?.name||candidate.name);}
    if(!a.processedMessageIds.includes(e.messageId))a.processedMessageIds.push(e.messageId);
  }
  a.processedMessageIds=a.processedMessageIds.slice(-500);a.reviewQueue=a.reviewQueue.slice(-50);a.shadowResults=a.shadowResults.slice(-50);return true;
});}
async function main(){if(!['shadow','cloud'].includes(mode)){console.log(JSON.stringify({ok:true,disabled:true,provider}));return;}await acquireLease();let mailbox,error='';try{const {state}=await readState();mailbox=await connectMailbox(process.env);const inbound=await collectInbox(mailbox,state),draftEvents=await createDrafts(mailbox,state),sentEvents=await detectSent(mailbox,state);await applyEvents([...inbound,...draftEvents,...sentEvents]);console.log(JSON.stringify({ok:true,mode,provider,matched:inbound.length,drafts:draftEvents.length,sent:sentEvents.length}));}catch(e){error=String(e.message||e);throw e;}finally{if(mailbox)await mailbox.close().catch(()=>{});await releaseLease(error).catch(()=>{});}}

if(process.argv.includes('--self-test')){const messageId=draftMessageId('req-self-test'),raw=rawDraft({from:'a@icloud.com',to:'b@example.com',subject:'Test – 02.–03.08.',body:'Kind regards,\n\n',inReplyTo:'<old@example.com>',messageId}).toString(),passwords=passwordCandidates('abcd-efgh-ijkl-mnop'),failure=authFailureLabel({authenticationFailed:true,serverResponseCode:'AUTHENTICATIONFAILED',responseText:'must stay hidden'});if(!raw.includes('In-Reply-To: <old@example.com>')||!raw.includes(`Message-ID: ${messageId}`)||!raw.endsWith('Kind regards,\r\n\r\n')||draftMessageId('req-self-test')!==messageId||passwords.length!==2||passwords[1]!=='abcdefghijklmnop'||failure!=='auth:AUTHENTICATIONFAILED'||failure.includes('hidden'))throw new Error('Draft self-test failed');console.log(JSON.stringify({ok:true,blankSignature:true,threadHeaders:true,idempotentDraftId:true,passwordFormattingFallback:true,sanitizedAuthDiagnostics:true}));}
else main().catch(e=>{console.error(JSON.stringify({ok:false,error:String(e.message||e)}));process.exitCode=1;});
