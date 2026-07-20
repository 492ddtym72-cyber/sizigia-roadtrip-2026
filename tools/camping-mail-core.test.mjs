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
  ['Thank you for your message. We will see what happens.','review'],
  ['Nous sommes complets pour cette période.','unavailable'],
  ['Vous pouvez nous appeler le jour même sans réservation.','call'],
  ['Tenemos una parcela disponible.','available'],
  ['Estamos completos, pero pueden llamar el mismo día.','call'],
  ['Nous avons encore quelques disponibilités. Merci de réserver sur notre site. N’hésitez pas à nous appeler pour tout renseignement complémentaire.','available']
];
for(const [body,status] of cases)assert.equal(classifyReply(body).status,status,body);
assert.equal(newestReply('New answer here.\n\nOn 1 July Someone wrote:\nOld text'),'New answer here.');
assert.equal(newestReply('Nous sommes complets.\n\nLe 12 juillet Freddi a écrit :\nI would like to ask if you have availability'),'Nous sommes complets.');
assert.equal(classifyReply('Non, désolé.\n\nLe 12 juillet Freddi a écrit :\nI would like to ask if you have availability').status,'review');
assert.ok(safeExcerpt('x '.repeat(500)).length<=601);
const candidates=[{id:'a',name:'Camping Daino',email:'info@daino.it',threadSubject:'Pitch availability – Camping Daino'},{id:'b',name:'Other',email:'info@other.it'}];
assert.equal(matchCandidate({from:'info@daino.it',subject:'Re: Pitch availability – Camping Daino'},candidates)?.id,'a');
assert.equal(matchCandidate({from:'unknown@gmail.com',subject:'Hello'},candidates),null);
assert.equal(matchCandidate({from:'newsletter@example.com',subject:'Deals near Camping Daino'},candidates),null);
console.log(JSON.stringify({ok:true,cases:cases.length,quotedHistory:true,ambiguousFailsClosed:true}));
