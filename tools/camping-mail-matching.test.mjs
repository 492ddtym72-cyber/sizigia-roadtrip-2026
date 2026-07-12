// Regression: Kandidaten-Matching braucht Absender-Beleg (Audit-Finding 3,
// Fix in 47c0423) — Betreff allein darf nie zuordnen; Gleichstand fällt
// geschlossen auf null zurück.
import assert from 'node:assert/strict';
import {matchCandidate} from './camping-mail-core.mjs';

const candidates = [
  {id:'pena', name:'Camping Peña Montañesa', email:'info@penamontanesa.com', threadSubject:'Pitch availability 09.08. – Camping Peña Montañesa'},
  {id:'mare', name:'Camping Mare Monti', email:'info@campingmaremonti.com', threadSubject:'Pitch availability 03.08. – Camping Mare Monti'},
];

// Exakte verifizierte Absenderadresse matcht.
assert.equal(matchCandidate({from:'info@penamontanesa.com', subject:'Re: irgendwas'}, candidates)?.id, 'pena',
  'exakte E-Mail muss matchen');
// Groß-/Kleinschreibung und Re:-Präfixe sind egal.
assert.equal(matchCandidate({from:'INFO@PenaMontanesa.com', subject:'AW: Re: Pitch availability 09.08. – Camping Peña Montañesa'}, candidates)?.id, 'pena',
  'Case/Präfix-Normalisierung muss greifen');

// Anderes Postfach derselben Nicht-Freemail-Domain matcht (Rezeption antwortet oft von anderer Adresse).
assert.equal(matchCandidate({from:'recepcion@penamontanesa.com', subject:'su consulta'}, candidates)?.id, 'pena',
  'Nicht-Freemail-Domain-Match muss greifen');

// Name im Betreff von fremdem Absender: KEIN Match (Newsletter-Schutz).
assert.equal(matchCandidate({from:'noreply@portal.example', subject:'Deals near Camping Mare Monti this summer'}, candidates), null,
  'Name im Betreff ohne Absender-Beleg darf nicht matchen');

// Exakter Thread-Betreff ohne Absender-Beleg: KEIN Match (gespoofter/weitergeleiteter Betreff).
assert.equal(matchCandidate({from:'random@stranger.example', subject:'Re: Pitch availability 03.08. – Camping Mare Monti'}, candidates), null,
  'exakter Thread-Betreff ohne Absender-Beleg darf nicht matchen');

// Gleichstand (zwei Kandidaten mit derselben Domain, kein weiteres Signal): fällt geschlossen auf null.
const tie = [
  {id:'a', name:'Alpha', email:'a@shared-group.example'},
  {id:'b', name:'Beta', email:'b@shared-group.example'},
];
assert.equal(matchCandidate({from:'info@shared-group.example', subject:'hello'}, tie), null,
  'Punktgleichstand muss null ergeben');
// …aber ein zusätzliches eindeutiges Signal (Name im Betreff) löst den Gleichstand auf.
assert.equal(matchCandidate({from:'info@shared-group.example', subject:'alpha camp question'},
  [{id:'a', name:'Alpha Camp', email:'a@shared-group.example'}, {id:'b', name:'Beta Camp', email:'b@shared-group.example'}])?.id, 'a',
  'Domain + eindeutiger Name muss auflösen');

// Freemail-Domain-Ähnlichkeit allein reicht NICHT (gmail/icloud/outlook/hotmail).
for(const freemail of ['gmail.com', 'icloud.com', 'outlook.com', 'hotmail.com']){
  const c = [{id:'f', name:'Camping Freemail', email:'campsite@' + freemail}];
  assert.equal(matchCandidate({from:'someone-else@' + freemail, subject:'Camping Freemail'}, c), null,
    'Freemail-Domain darf nicht als Beleg zählen: ' + freemail);
  // Die exakte Freemail-Adresse selbst bleibt natürlich gültig.
  assert.equal(matchCandidate({from:'campsite@' + freemail, subject:'Re: Anfrage'}, c)?.id, 'f',
    'exakte Freemail-Adresse muss weiter matchen: ' + freemail);
}

// Gar kein Signal: null.
assert.equal(matchCandidate({from:'unknown@nowhere.example', subject:'Hello'}, candidates), null);

console.log(JSON.stringify({ok:true, senderEvidenceRequired:true, tieFailsClosed:true, freemailRejected:true}));
