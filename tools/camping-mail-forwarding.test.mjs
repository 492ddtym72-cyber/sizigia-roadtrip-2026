#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {forwardedReviewResult,matchForwardedCandidate,parseForwardedMessage} from './camping-mail-core.mjs';

const candidates=[
  {searchId:'s1',candidateId:'c1',name:'Camping Les Tamaris',email:'lestamaris@pausado.com'},
  {searchId:'s2',candidateId:'c2',name:'Camping Test',email:'info@test.example'}
];

const reply=parseForwardedMessage(`Fyi from the campsite:\n\n---------- Forwarded message ---------\nFrom: Camping Les Tamaris <lestamaris@pausado.com>\nDate: Fri, 17 Jul 2026 17:00:00 +0200\nSubject: Re: One-night pitch availability – Camping Les Tamaris\nTo: Jakob <jakob@example.net>\n\nWe have a pitch available for one night. The small car must stay outside.\n\nKind regards,\nReception`);
assert.equal(reply.from,'Camping Les Tamaris <lestamaris@pausado.com>');
assert.ok(reply.body.startsWith('We have a pitch available'));
const replyMatch=matchForwardedCandidate(reply,candidates);
assert.equal(replyMatch?.candidate.candidateId,'c1');
assert.equal(replyMatch?.direction,'reply');
const replyResult=forwardedReviewResult(reply,'reply');
assert.equal(replyResult.status,'review','Weiterleitungen dürfen nie automatisch Status ändern');
assert.equal(replyResult.suggestedStatus,'available');

const sent=parseForwardedMessage(`Anfang der weitergeleiteten Nachricht:\n\nVon: Jakob <jakob@example.net>\nBetreff: One-night pitch availability – Camping Les Tamaris\nDatum: 17. Juli 2026\nAn: Camping Les Tamaris <lestamaris@pausado.com>\n\nHello, do you have a pitch for six adults?`);
const sentMatch=matchForwardedCandidate(sent,candidates);
assert.equal(sentMatch?.candidate.candidateId,'c1');
assert.equal(sentMatch?.direction,'sent');
const sentResult=forwardedReviewResult(sent,'sent');
assert.equal(sentResult.status,'review');
assert.equal(sentResult.suggestedStatus,'contacted');

assert.equal(parseForwardedMessage('From: lestamaris@pausado.com\nWe have availability.'),null,'Headertext ohne echte Weiterleitungsmarke darf nicht vertraut werden');
assert.equal(matchForwardedCandidate(parseForwardedMessage(`Begin forwarded message:\nFrom: Jakob <jakob@example.net>\nTo: other@pausado.com\nSubject: Camping Les Tamaris\n\nHello`),candidates),null,'Ähnliche Domain reicht beim weitergeleiteten Versand nicht');

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.ok(app.includes("resolveMailReview('${q.id}','contacted')"),'App braucht eine bewusste Versandbestätigung für Crew-Weiterleitungen');
assert.ok(app.includes('Weitergeleitete Antwort prüfen'),'Weitergeleitete Antworten müssen sichtbar gekennzeichnet sein');

console.log(JSON.stringify({ok:true,forwardedReplyManual:true,forwardedSentManual:true,exactEmbeddedAddress:true,spoofWithoutMarkerRejected:true}));
