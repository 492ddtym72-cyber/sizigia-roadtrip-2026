// Regression: französische und spanische Campingplatz-Antworten müssen
// deterministisch klassifiziert werden (Audit-Finding 2, Fix in 47c0423);
// Mehrdeutiges fällt geschlossen auf "review" zurück.
import assert from 'node:assert/strict';
import {classifyReply} from './camping-mail-core.mjs';

const cases = [
  // Französisch
  ['Nous avons encore des disponibilités pour cette nuit.', 'available'],
  ['Un emplacement disponible pour la nuit du 2 août.', 'available'],
  ['Nous sommes complets pour cette période.', 'unavailable'],
  ['Nous sommes complets, mais vous pouvez nous appeler le jour même.', 'call'],
  ['Vous pouvez venir sans réservation si une place se libère.', 'call'],
  ['Recontactez-nous quelques jours avant votre arrivée.', 'followup'],
  ['Pour confirmer la réservation, un acompte de 50 € est demandé.', 'deposit_required'],
  ['Des arrhes de 30 % sont demandées pour bloquer la place.', 'deposit_required'],
  ['Réservation confirmée pour la nuit du 2 août.', 'booked'],
  // Spanisch
  ['Tenemos disponibilidad para esa noche.', 'available'],
  ['Hay parcelas disponibles para esa fecha.', 'available'],
  ['Lo sentimos, estamos completos en esas fechas.', 'unavailable'],
  ['Pueden llamar el mismo día para preguntar.', 'call'],
  ['Pueden venir sin reserva.', 'call'],
  ['Vuelvan a consultar unos días antes de la llegada.', 'followup'],
  ['Para confirmar se requiere una señal del 30 por ciento.', 'deposit_required'],
  ['Reserva confirmada para la noche del 2 de agosto.', 'booked'],
  // Mehrdeutig ⇒ geschlossen auf review
  ['Merci pour votre message, nous verrons ce que nous pouvons faire.', 'review'],
  ['Gracias por su mensaje, ya veremos.', 'review'],
  ['Peut-être, cela dépend de la météo et des annulations.', 'review'],
];
for(const [body, expected] of cases){
  const result = classifyReply(body);
  assert.equal(result.status, expected, body);
  if(expected === 'review') assert.equal(result.confidence, 'low', 'review muss low confidence tragen: ' + body);
  else assert.equal(result.confidence, 'high', body);
}

// Widersprüchliche Aussagen (verfügbar UND voll, ohne Anruf/Nachfassen-Signal)
// müssen zur manuellen Prüfung.
assert.equal(classifyReply('Tenemos disponibilidad, pero también estamos completos según la web.').status, 'review',
  'widersprüchliche Antwort muss review sein');

assert.equal(classifyReply('Aucune disponibilité pour ces dates.').status,'unavailable');
assert.equal(classifyReply('Pas de disponibilité pour cette nuit.').status,'unavailable');

console.log(JSON.stringify({ok:true, cases:cases.length + 3, ambiguousFailsClosed:true, accentedFrenchRejections:true}));
