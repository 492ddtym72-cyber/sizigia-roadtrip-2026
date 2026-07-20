#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadApp} from './app-testbed.mjs';

const app=loadApp();
await new Promise(resolve=>setImmediate(resolve));
const card=app.run(`(()=>{
  const s=state.sleepSearches[0],p={id:'card-place',name:'Camping Card Test',region:'Testküste',email:'camp@example.test',phone:'+33 1 23 45 67 89',officialUrl:'https://example.test',link:'https://maps.example.test',contactVerified:true},c=normalizeSleepCandidate({id:'card-candidate',placeId:p.id,status:'available',reply:'Ein Stellplatz ist verfügbar.'});
  state.sleepPlaces.push(p);s.candidates.push(c);
  return sleepCandidateCard(s,c);
})()`);
assert.ok(card.includes('sleep-card-contact'),'Kontaktwege besitzen eine eigene visuelle Gruppe');
assert.ok(card.includes('aria-hidden="true">✉</span>'));
assert.ok(card.includes('aria-hidden="true">☎</span>'));
assert.ok(card.includes('aria-hidden="true">⌖</span>'));
assert.ok(card.includes('sleep-answer'),'Rückmeldung bleibt innerhalb der Platzkarte');

const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
assert.match(css,/\.sleep-card\{[^}]*border:1px solid[^}]*border-radius:(?:9|10|11|12)px[^}]*background:/s);
assert.doesNotMatch(css,/\.sleep-card::before\{/,'Kein zusätzlicher Statusstreifen an der Kartenkante');
assert.doesNotMatch(css,/\.sleep-card[^,{]*\{[^}]*border-left:/s,'Statusklassen verwenden keinen Seitenstreifen');
assert.match(css,/\.sleep-card\{[^}]*--sleep-card-tint:rgba\(255,255,255,\.045\)[^}]*background:linear-gradient\(135deg,var\(--sleep-card-tint\),rgba\(255,255,255,\.028\) 72%\)/s);
assert.match(css,/\.sleep-card\.available,\.sleep-card\.reservable\{--sleep-card-tint:rgba\(95,212,168,\.13\)\}/);
assert.match(css,/\.sleep-card\.call\{--sleep-card-tint:rgba\(255,178,87,\.13\)\}/);
assert.match(css,/\.sleep-card\.awaiting,\.sleep-card\.reserving,\.sleep-card\.draft_requested\{--sleep-card-tint:rgba\(84,200,255,\.12\)\}/);
assert.match(css,/\.sleep-answer\{[^}]*background:/s);
assert.match(css,/\.sleep-icon\{/);
assert.match(css,/\.sleep-actions \.btn\{[^}]*display:inline-flex[^}]*gap:8px/s);
assert.match(css,/\.sleep-link\{[^}]*gap:7px/s);
console.log(JSON.stringify({ok:true,groupedCards:true,contactIcons:true,answerPanel:true,statusTints:true,iconSpacing:true}));
