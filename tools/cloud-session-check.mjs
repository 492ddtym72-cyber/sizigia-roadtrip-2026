#!/usr/bin/env node
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const ROOT=new URL('../',import.meta.url);
const DEFAULT_WORKFLOW_URL='https://api.github.com/repos/492ddtym72-cyber/sizigia-roadtrip-2026/actions/workflows/camping-mail.yml/runs?branch=main&per_page=1';

export function extractCloudUrl(source){
  const url=String(source).match(/CLOUD_URL\s*=\s*'([^']+)'/)?.[1];
  if(!url)throw new Error('Firebase-URL fehlt in app.js');
  return url;
}

export function summarizeState(state={},workflow=null){
  const assistant=state.mailAssistant||{},runner=assistant.runners?.cloud||{};
  const candidates=(state.sleepSearches||[]).flatMap(search=>search.candidates||[]),byStatus={};
  for(const candidate of candidates){
    const status=String(candidate.status||'unknown');
    byStatus[status]=(byStatus[status]||0)+1;
  }
  return {
    schemaVersion:Number(state.schemaVersion)||null,
    lastSaved:state.meta?.lastSaved||null,
    mail:{
      provider:assistant.mailProvider||'unknown',
      mode:assistant.runnerMode||'unknown',
      lastSuccessAt:runner.lastSuccessAt||null,
      nextRunAt:runner.nextRunAt||null,
      lastError:runner.lastError||'',
      pendingReviews:(assistant.reviewQueue||[]).filter(item=>item.status!=='resolved').length,
      pendingDrafts:(assistant.draftRequests||[]).filter(item=>['requested','ready'].includes(item.status)).length
    },
    accommodation:{total:candidates.length,byStatus},
    workflow:workflow?{
      status:workflow.status||'unknown',
      conclusion:workflow.conclusion||'',
      createdAt:workflow.created_at||null
    }:null
  };
}

async function getJson(url,fetchImpl){
  const response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  return {response,data:response.ok?await response.json():null};
}

export async function loadLiveStatus({
  fetchImpl=fetch,
  firebaseUrl=extractCloudUrl(fs.readFileSync(new URL('app.js',ROOT),'utf8')),
  workflowUrl=DEFAULT_WORKFLOW_URL
}={}){
  const firebase=await getJson(firebaseUrl,fetchImpl);
  if(!firebase.response.ok)throw new Error(`Firebase GET ${firebase.response.status}`);
  let workflow=null,warning='';
  if(workflowUrl){
    try{
      const github=await getJson(workflowUrl,fetchImpl);
      if(github.response.ok)workflow=github.data?.workflow_runs?.[0]||null;
      else warning=`GitHub-Workflowstatus nicht verfügbar (${github.response.status})`;
    }catch(error){
      warning=`GitHub-Workflowstatus nicht verfügbar (${error.message})`;
    }
  }
  return {summary:summarizeState(firebase.data,workflow),warning};
}

export function formatSummary(summary,warning=''){
  const statuses=Object.entries(summary.accommodation.byStatus).sort().map(([key,value])=>`${key}: ${value}`).join(', ')||'keine';
  return [
    'Cloud-Status · rein lesend',
    `Schema: ${summary.schemaVersion??'unbekannt'}`,
    `Letzte App-Änderung: ${summary.lastSaved||'unbekannt'}`,
    `Mail: ${summary.mail.provider} · Modus ${summary.mail.mode}`,
    `Letzter erfolgreicher Mailcheck: ${summary.mail.lastSuccessAt||'noch keiner'}`,
    `Nächster Mailcheck: ${summary.mail.nextRunAt||'unbekannt'}`,
    `Offene Mail-Prüfungen: ${summary.mail.pendingReviews}`,
    `Offene Entwürfe: ${summary.mail.pendingDrafts}`,
    `Unterkünfte: ${summary.accommodation.total} (${statuses})`,
    summary.mail.lastError?`Mailfehler: ${summary.mail.lastError}`:'',
    summary.workflow?`Workflow: ${summary.workflow.conclusion||summary.workflow.status} · ${summary.workflow.createdAt||'Zeit unbekannt'}`:'',
    warning?`Hinweis: ${warning}`:''
  ].filter(Boolean).join('\n');
}

async function main(){
  const result=await loadLiveStatus();
  console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):formatSummary(result.summary,result.warning));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    console.error(`Cloud-Status fehlgeschlagen: ${error.message}`);
    process.exitCode=1;
  });
}
