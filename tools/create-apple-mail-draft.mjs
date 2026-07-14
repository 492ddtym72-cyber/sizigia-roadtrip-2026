#!/usr/bin/env node
// Erstellt genau einen ungesendeten, normal formatierten Apple-Mail-Entwurf
// für eine bereits in Firebase registrierte Entwurfsanfrage. Erst nachdem Mail
// den Entwurf gespeichert hat, wird er in der App als „bereit“ markiert.
import {execFileSync} from 'node:child_process';

const requestId=process.argv[2]||'';
const dryRun=process.argv.includes('--dry-run');
if(!requestId)throw new Error('Entwurfs-ID fehlt');

const bridge=new URL('./camping-mail-bridge.mjs',import.meta.url).pathname;
const runBridge=(...args)=>execFileSync(process.execPath,[bridge,...args],{encoding:'utf8'}).trim();
const payload=JSON.parse(runBridge('draft-payload',requestId));
if(!payload.to||!payload.subject||!payload.body)throw new Error('Empfänger, Betreff oder Text fehlt');
if(!payload.body.endsWith('Kind regards,\n\n'))throw new Error('Entwurf hat keine leere Signaturzeile');

if(dryRun){
  console.log(JSON.stringify({ok:true,dryRun:true,requestId,to:payload.to,subject:payload.subject,paragraphs:payload.body.split(/\n\n/).filter(Boolean).length,blankSignature:true}));
  process.exit(0);
}

const appleScript=`
on run argv
  set recipientAddress to item 1 of argv
  set messageSubject to item 2 of argv
  set messageBody to item 3 of argv
  tell application "Mail"
    set previousMessageFormat to default message format
    try
      -- Rich-Text-Entwürfe können per AppleScript versehentlich eine
      -- Zitat-Ebene erben (violette Schrift + Seitenlinie). Ein neuer
      -- Plain-Text-Entwurf enthält nur normalen Nachrichtentext.
      set default message format to plain format
      set draftMessage to make new outgoing message with properties {visible:false, subject:messageSubject, content:messageBody}
      tell draftMessage
        make new to recipient at end of to recipients with properties {address:recipientAddress}
        save
      end tell
      set default message format to previousMessageFormat
    on error errorMessage number errorNumber
      set default message format to previousMessageFormat
      error errorMessage number errorNumber
    end try
  end tell
  return "saved"
end run`;

const result=execFileSync('/usr/bin/osascript',['-e',appleScript,payload.to,payload.subject,payload.body],{encoding:'utf8'}).trim();
if(result!=='saved')throw new Error('Apple Mail hat den Entwurf nicht bestätigt');

const now=new Date().toISOString();
const event=[{searchId:payload.searchId,candidateId:payload.candidateId,requestId:payload.requestId,requestStatus:'ready',readyAt:now,draftState:'ready',nextAction:'Entwurf in Apple Mail prüfen und selbst senden'}];
runBridge('apply',Buffer.from(JSON.stringify(event)).toString('base64url'));
console.log(JSON.stringify({ok:true,requestId,to:payload.to,subject:payload.subject,readyAt:now}));
