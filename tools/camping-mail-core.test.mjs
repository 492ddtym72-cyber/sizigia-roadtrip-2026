import assert from 'node:assert/strict';
import {classifyReply,matchCandidate,newestReply,safeExcerpt} from './camping-mail-core.mjs';

const cases=[
  ['We still have a few pitches available for the requested night.','available'],
  ['We are fully booked. You are welcome to call us in case somebody cancels.','call'],
  ['At the moment there is no availability. Please email us again a few days before arrival.','followup'],
  ['Für den Zeitraum sind wir leider ausgebucht.','unavailable'],
  ['Potete arrivare senza prenotazione, ma non possiamo garantire la disponibilità.','call'],
  ['Per confermare la prenotazione è richiesta una caparra.','deposit_required'],
  ['Your reservation is confirmed.','booked'],
  ['We accept reservations for one-night touring pitches. Please contact us when your exact date is known.','reservable'],
  ['Thank you for your message. We will see what happens.','review']
];
for(const [body,status] of cases)assert.equal(classifyReply(body).status,status,body);
assert.equal(newestReply('New answer here.\n\nOn 1 July Someone wrote:\nOld text'),'New answer here.');
assert.ok(safeExcerpt('x '.repeat(500)).length<=601);
const candidates=[{id:'a',name:'Camping Daino',email:'info@daino.it',threadSubject:'Pitch availability – Camping Daino'},{id:'b',name:'Other',email:'info@other.it'}];
assert.equal(matchCandidate({from:'info@daino.it',subject:'Re: Pitch availability – Camping Daino'},candidates)?.id,'a');
assert.equal(matchCandidate({from:'unknown@gmail.com',subject:'Hello'},candidates),null);
console.log(JSON.stringify({ok:true,cases:cases.length,quotedHistory:true,ambiguousFailsClosed:true}));
