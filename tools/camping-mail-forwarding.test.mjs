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

const webde=parseForwardedMessage(`Gesendet: Montag, 20. Juli 2026 um 14:16

Von: info@test.example

An: habel-max@web.de

Betreff: Re: Reserva de Camping Test

Hola
No puc acceptar vuestra reserva; el camping es ple fins al 10 d’Agost.`,{allowHeaderBlock:true});
assert.equal(webde?.from,'info@test.example');
assert.equal(webde?.subject,'Re: Reserva de Camping Test');
assert.ok(webde?.body.startsWith('Hola'));
assert.equal(matchForwardedCandidate(webde,candidates)?.candidate.candidateId,'c2');
assert.equal(forwardedReviewResult(webde,'reply').status,'review');
assert.equal(forwardedReviewResult(webde,'reply').suggestedStatus,'unavailable');

const mobile=parseForwardedMessage(`Sent with the mobile mail app

On 20/07/2026 at 14.16, info@test.example wrote:

> From: info@test.example
> Date: 20 July 2026
> To: habel-max@web.de
> Subject: Re: Camping Test
>
> We are fully booked for your dates.`,{allowHeaderBlock:true});
assert.equal(mobile?.from,'info@test.example');
assert.ok(mobile?.body.startsWith('We are fully booked'));

assert.equal(parseForwardedMessage('From: lestamaris@pausado.com\nWe have availability.'),null,'Headertext ohne echte Weiterleitungsmarke darf nicht vertraut werden');
assert.equal(parseForwardedMessage(`From: info@test.example
To: habel-max@web.de
Subject: Re: Camping Test

We are full.`),null,'bare Header bleiben ohne explizites Runner-Gate untrusted');
assert.equal(parseForwardedMessage(`From: unknown@example.org
Subject: Camping Test

We have space.`,{allowHeaderBlock:true}),null,'unvollständiger Headerblock wird verworfen');
assert.equal(matchForwardedCandidate(parseForwardedMessage(`From: impostor@example.org
To: someone@example.net
Subject: Re: Camping Test

We have space.`,{allowHeaderBlock:true}),candidates),null,'Betreff ohne passende eingebettete Adresse reicht nicht');
assert.equal(matchForwardedCandidate(parseForwardedMessage(`Begin forwarded message:\nFrom: Jakob <jakob@example.net>\nTo: other@pausado.com\nSubject: Camping Les Tamaris\n\nHello`),candidates),null,'Ähnliche Domain reicht beim weitergeleiteten Versand nicht');

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.ok(app.includes("resolveMailReview('${q.id}','contacted')"),'App braucht eine bewusste Versandbestätigung für Crew-Weiterleitungen');
assert.ok(app.includes('Weitergeleitete Antwort prüfen'),'Weitergeleitete Antworten müssen sichtbar gekennzeichnet sein');
const runner=fs.readFileSync(new URL('../cloud-mail/runner.mjs',import.meta.url),'utf8');
assert.ok(runner.includes('forwardedFromMail(mail,couldBeForwarded)'),'Headerblock-Parsing bleibt an einen erkannten Weiterleitungs-Betreff gebunden');

console.log(JSON.stringify({ok:true,forwardedReplyManual:true,forwardedSentManual:true,exactEmbeddedAddress:true,spoofWithoutMarkerRejected:true,headerBlocks:true,variedFormats:true}));
