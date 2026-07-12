import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const handlers={},added=[],deleted=[];
const indexResponse=new Response('<!doctype html>',{headers:{'content-type':'text/html'}});
const cache={addAll:async assets=>added.push(...assets),put:async()=>{}};
const caches={open:async()=>cache,keys:async()=>['sizigia-app-v2','unrelated-cache'],delete:async key=>{deleted.push(key);return true;},match:async request=>String(request).includes('index.html')?indexResponse.clone():null};
const self={location:{origin:'https://example.test'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
vm.runInNewContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,caches,fetch:async()=>{throw new Error('offline')},URL,Response,Promise});

let installPromise;handlers.install({waitUntil:p=>installPromise=p});await installPromise;
for(const asset of ['./index.html','./styles.css','./map-data.js','./app.js'])assert.ok(added.includes(asset));
let activatePromise;handlers.activate({waitUntil:p=>activatePromise=p});await activatePromise;assert.deepEqual(deleted,['sizigia-app-v2']);
async function offlineResponse(url,mode){let promise;handlers.fetch({request:{method:'GET',url,mode},respondWith:p=>promise=p});return promise;}
const nav=await offlineResponse('https://example.test/route','navigate');assert.equal(await nav.text(),'<!doctype html>');
const js=await offlineResponse('https://example.test/missing.js','same-origin');assert.equal(js.type,'error');
console.log(JSON.stringify({ok:true,atomicAssets:true,navigationFallback:true,noHtmlForMissingAsset:true}));
