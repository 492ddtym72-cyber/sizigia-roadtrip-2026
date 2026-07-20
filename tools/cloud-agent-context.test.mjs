import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root=new URL('../',import.meta.url);
const app=fs.readFileSync(new URL('app.js',root),'utf8');
const agents=fs.readFileSync(new URL('AGENTS.md',root),'utf8');
const readme=fs.readFileSync(new URL('README.md',root),'utf8');
const handoff=fs.readFileSync(new URL('HANDOFF.md',root),'utf8');
const schema=app.match(/const SCHEMA_VERSION = (\d+);/)?.[1];

test('agent guidance names actual schema and live sources',()=>{
  assert.ok(schema);
  assert.match(agents,new RegExp(`Schema(?:-Version)?[^\\r\\n]*${schema}`,'i'));
  assert.match(agents,/Firebase[^\r\n]+aktuell|aktuell[^\r\n]+Firebase/i);
  assert.match(agents,/Mailantworten[^\r\n]+keine Migration|keine Migration[^\r\n]+Mailantworten/i);
});

test('active Gmail runner and runbook are documented',()=>{
  assert.match(agents,/GitHub Actions[^\r\n]+Gmail|Gmail[^\r\n]+GitHub Actions/i);
  assert.match(agents,/docs\/operations\/CLOUD_AGENT_RUNBOOK\.md/);
  assert.doesNotMatch(agents,/cloud-mail\/[^\r\n]*deaktiviert/i);
});

test('verification commands match CI',()=>{
  assert.match(agents,/node --test tools\/\*\.test\.mjs/);
  assert.match(agents,/node tools\/verify-static-app\.mjs/);
  assert.match(agents,/npm test --prefix cloud-mail/);
});

test('public docs describe the hosted current architecture',()=>{
  assert.match(readme,/github\.io\/sizigia-roadtrip-2026/);
  assert.match(readme,/Firebase/);
  assert.match(handoff,/MAIL_PROVIDER=gmail/);
  assert.doesNotMatch(handoff,/lokale Codex-Automation prüft[^\r\n]+iCloud/i);
});
