import assert from 'node:assert/strict';
import fs from 'node:fs';
import {draftBody,draftSubject,formatLetter} from './camping-mail-templates.mjs';

const state={crew:[1,2,3,4,5,6],vehicles:[{id:'v-camper',lengthM:'5.2'}]},search={startDate:'2026-08-05',endDate:'2026-08-06',arrivalWindowStart:'2026-08-05',arrivalWindowEnd:'2026-08-06',region:'Cassis'},candidate={name:'Camping Test',offeredArrivalDate:'2026-08-05',reply:'',nextAction:''},place={name:'Camping Test'};
const modes=['inquiry','network_policy','reserve','call','dimensions','missing','deposit','followup','clarify'];

for(const mode of modes){
  const body=draftBody(state,search,candidate,place,mode);
  assert.ok(body.startsWith('Dear Camping Test team,\n\n'),`${mode}: Grußzeile braucht Abstand`);
  assert.ok(body.includes('\n\nKind regards,\n\n'),`${mode}: Schlussformel braucht Abstand`);
  assert.equal(body.includes('\n\n\n'),false,`${mode}: keine zufälligen Leerzeilen`);
  assert.equal(body.endsWith('Kind regards,\n\n'),true,`${mode}: Name bleibt leer`);
}

assert.equal(formatLetter('Dear team,\r\n\r\nFirst.\r\n\r\n\r\nKind regards,   '),'Dear team,\n\nFirst.\n\nKind regards,\n\n');
const exactSearch={startDate:'2026-08-09',endDate:'2026-08-10',arrivalWindowStart:'2026-08-09',arrivalWindowEnd:'2026-08-09',region:'Huesca'};
const exactBody=draftBody(state,exactSearch,candidate,place,'inquiry');
assert.equal(exactBody.includes('choose any available arrival date'),false,'Exakte Nacht darf kein flexibles Fenster behaupten');
assert.ok(exactBody.includes('from 9 August 2026 to 10 August 2026'));
assert.equal(draftSubject(exactSearch,candidate,'inquiry'),'One-night pitch availability – 9–10 August 2026 – Camping Test');
const requested={name:'Camping Test',requestedArrivalDate:'2026-08-03',requestedDepartureDate:'2026-08-04',inquiryQuestion:'Please confirm the vehicle limit.'};
const requestedBody=draftBody(state,search,requested,place,'inquiry');
assert.ok(requestedBody.includes('from 3 August 2026 to 4 August 2026'));
assert.ok(requestedBody.includes('Please confirm the vehicle limit.'));
assert.equal(requestedBody.includes('choose any available arrival date'),false);
assert.equal(draftSubject(search,requested,'inquiry'),'One-night pitch availability – 3–4 August 2026 – Camping Test');
const twoPitchBody=draftBody(state,search,{...candidate,pitchNote:'Für sechs Erwachsene sind zwei Stellplätze nötig.'},place,'dimensions');
assert.ok(twoPitchBody.includes('would therefore need two pitches'));
assert.ok(twoPitchBody.includes('preferably next to each other'));
assert.ok(twoPitchBody.includes('total price for all six adults'));
assert.equal(twoPitchBody.endsWith('Kind regards,\n\n'),true);
assert.throws(()=>draftBody({...state,vehicles:[{id:'v-camper'}]},search,{...candidate,pitchNote:'Two pitches are required.'},place,'dimensions'),/Camperlänge fehlt/);
const twoNightOffer=draftBody(state,exactSearch,{...candidate,offeredArrivalDate:'2026-08-09',offeredDepartureDate:'2026-08-11'},place,'reserve');
assert.ok(twoNightOffer.includes('from 9 August 2026 to 11 August 2026'),'Mehrnächte-Angebot darf nicht auf eine Nacht verkürzt werden');
assert.equal(twoNightOffer.includes('from 9 August 2026 to 10 August 2026'),false);
const appleMailCreator=fs.readFileSync(new URL('./create-apple-mail-draft.mjs',import.meta.url),'utf8');
assert.ok(appleMailCreator.includes('set default message format to plain format'),'Apple Mail muss normalen Text statt Zitatebene erzeugen');
assert.ok(appleMailCreator.includes('make new outgoing message with properties {visible:false, subject:messageSubject}'),'Entwurf muss ohne geerbten Rich-Text-Inhalt neu angelegt werden');
assert.ok(appleMailCreator.includes('set content to messageBody & linefeed'),'Text muss erst im leeren Plain-Text-Entwurf gesetzt werden');
assert.equal(appleMailCreator.includes('subject:messageSubject, content:messageBody'),false,'Inhalt darf nicht beim Erzeugen eine Zitatebene erben');
assert.ok(appleMailCreator.match(/set default message format to previousMessageFormat/g)?.length>=2,'Mail-Format muss nach Erfolg und Fehler wiederhergestellt werden');
console.log(JSON.stringify({ok:true,modes:modes.length,letterSpacing:true,blankSignature:true,twoPitchReply:true,plainTextDrafts:true}));
