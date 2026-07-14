import assert from 'node:assert/strict';
import {draftBody,formatLetter} from './camping-mail-templates.mjs';

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
console.log(JSON.stringify({ok:true,modes:modes.length,letterSpacing:true,blankSignature:true}));
