// Regression: fremdsprachige Zitat-Header und zitierte eigene Anfragen dürfen
// die Klassifikation nie beeinflussen (Audit-Finding 1, Fix in 47c0423).
import assert from 'node:assert/strict';
import {classifyReply, newestReply} from './camping-mail-core.mjs';

const OWN_ENQUIRY = 'I would like to ask if you have availability from 2 to 3 August for 6 adults travelling with one camper and one small car.';

// Jeder bekannte Zitat-Header muss den zitierten Verlauf abschneiden.
const QUOTE_HEADERS = [
  ['französisch (Apple Mail/Gmail)', 'Le 12 juil. 2026 à 10:00, Freddi a écrit :'],
  ['spanisch', 'El 12 de julio de 2026, Freddi escribió:'],
  ['italienisch', 'Il giorno 12 lug 2026, Freddi ha scritto:'],
  ['Outlook französisch De :', 'De : Freddi <freddi@example.com>'],
  ['Outlook Message d’origine', "-----Message d'origine-----"],
  ['Outlook Mensaje original', '-----Mensaje original-----'],
  ['Outlook Messaggio originale', '-----Messaggio originale-----'],
  ['englisch (Bestand)', 'On 12 Jul 2026, Freddi wrote:'],
  ['klassisches >-Zitat (Bestand)', '> ' + OWN_ENQUIRY],
];
for(const [label, header] of QUOTE_HEADERS){
  const kept = newestReply('Bonjour.\n' + header + '\n' + OWN_ENQUIRY);
  assert.equal(kept, 'Bonjour.', 'Zitat-Header nicht abgeschnitten: ' + label);
}

// Zitierte Kopien der eigenen Anfrage dürfen NIE "available" ergeben —
// für jede Header-Variante mit neutraler Ein-Wort-Antwort darüber.
for(const [label, header] of QUOTE_HEADERS){
  const status = classifyReply('Merci.\n\n' + header + '\n' + OWN_ENQUIRY).status;
  assert.notEqual(status, 'available', 'zitierte eigene Anfrage klassifiziert als available: ' + label);
  assert.equal(status, 'review', 'neutrale Antwort + Zitat muss review bleiben: ' + label);
}

// Bekannter gefährlicher Fall aus dem Audit: Absage + französischer
// Zitat-Header + unsere englische Verfügbarkeitsanfrage darunter.
const danger = classifyReply('Non, désolé.\n\nLe 12 juil. 2026 à 10:00, Freddi a écrit :\n' + OWN_ENQUIRY);
assert.notEqual(danger.status, 'available', 'Gefahrfall darf nie available sein');
assert.equal(danger.status, 'review', 'Gefahrfall muss zur manuellen Prüfung (review)');

// Eigene Template-Sätze werden auch OHNE erkannten Zitat-Header ignoriert
// (z. B. wenn ein Mail-Client einen unbekannten Header verwendet).
const unknownHeader = classifyReply('Oui.\nFreddi asked earlier:\n' + OWN_ENQUIRY);
assert.equal(unknownHeader.status, 'review', 'eigener Anfragetext ohne Header muss gefiltert werden');
const onlyOwnText = classifyReply(OWN_ENQUIRY);
assert.equal(onlyOwnText.status, 'review', 'reiner eigener Anfragetext darf nichts klassifizieren');

// Echte Antwort ÜBER dem Zitat wird weiterhin normal klassifiziert.
const genuine = classifyReply('Nous avons encore des disponibilités pour cette nuit.\n\nLe 12 juil. 2026 à 10:00, Freddi a écrit :\n' + OWN_ENQUIRY);
assert.equal(genuine.status, 'available', 'echte Zusage über dem Zitat muss available bleiben');
const genuineFull = classifyReply('Nous sommes complets.\n\n-----Message d\'origine-----\n' + OWN_ENQUIRY);
assert.equal(genuineFull.status, 'unavailable', 'echte Absage über dem Zitat muss unavailable bleiben');

console.log(JSON.stringify({ok:true, headers:QUOTE_HEADERS.length, dangerCaseReview:true, ownTemplateFiltered:true}));
