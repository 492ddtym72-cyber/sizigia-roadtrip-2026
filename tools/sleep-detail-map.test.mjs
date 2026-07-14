import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApp} from './app-testbed.mjs';

test('Detailkarte fällt ohne Netz oder Kartenbibliothek auf die eingebettete Karte zurück', () => {
  const app = loadApp();

  const offline = app.run(`(()=>{
    activeTab='sleep'; sleepView='map'; sleepMapLayer='detail';
    initSleepDetailMap();
    return {layer:sleepMapLayer, detailMap:!!sleepDetailMap};
  })()`);
  assert.equal(offline.layer,'offline');
  assert.equal(offline.detailMap,false);

  const missingLibrary = app.run(`(()=>{
    navigator.onLine=true; sleepMapLayer='detail';
    initSleepDetailMap();
    return {layer:sleepMapLayer, detailMap:!!sleepDetailMap};
  })()`);
  assert.equal(missingLibrary.layer,'offline');
  assert.equal(missingLibrary.detailMap,false);
});

test('Kartenwechsel verändert keine synchronisierten Reisedaten', () => {
  const app = loadApp();
  const result = app.run(`(()=>{
    const before=JSON.stringify(state),saved=state.meta.lastSaved;
    setSleepMapLayer('offline');
    return {same:before===JSON.stringify(state),saved,after:state.meta.lastSaved,preference:localStorage.getItem(SLEEP_MAP_LAYER_KEY)};
  })()`);
  assert.equal(result.same,true);
  assert.equal(result.saved,result.after);
  assert.equal(result.preference,'offline');
});
