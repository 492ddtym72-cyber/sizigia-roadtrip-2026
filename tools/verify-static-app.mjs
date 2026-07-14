#!/usr/bin/env node
import fs from 'node:fs';

const required=['index.html','styles.css','map-data.js','app.js','sw.js'],missing=required.filter(x=>!fs.existsSync(new URL('../'+x,import.meta.url)));
if(missing.length)throw new Error('Fehlende App-Dateien: '+missing.join(', '));
const root=new URL('../',import.meta.url),html=fs.readFileSync(new URL('index.html',root),'utf8'),sw=fs.readFileSync(new URL('sw.js',root),'utf8'),map=fs.readFileSync(new URL('map-data.js',root),'utf8'),app=fs.readFileSync(new URL('app.js',root),'utf8');
const order=['./styles.css','./map-data.js','./app.js'].map(x=>html.indexOf(x));
if(order.some(x=>x<0)||!(order[0]<order[1]&&order[1]<order[2]))throw new Error('Asset-Reihenfolge in index.html ist falsch');
if(/<script[^>]+type=["']module/i.test(html))throw new Error('Module brechen file://');
if(!/^var MAP_IMG = 'data:image\/webp;base64,/m.test(map))throw new Error('Offline-Karte fehlt');
for(const asset of ['./index.html','./styles.css','./map-data.js','./app.js'])if(!sw.includes(`'${asset}'`))throw new Error('Service Worker cached nicht '+asset);
if(/m \|\| caches\.match\('\.\/index\.html'\)/.test(sw))throw new Error('Service Worker darf HTML nicht als Asset-Fallback liefern');
if(!app.includes("'X-Firebase-ETag':'true'")||!app.includes("'if-match':etag"))throw new Error('App-Cloud-Sync muss ETag-konfliktgeschützt bleiben');
if(!app.includes("['action','Optionen'],['waiting','Anfragen'],['closed','Absagen']"))throw new Error('Korrigierbare Absagen-Ansicht fehlt');
if(!app.includes("const operational=['booked','available'"))throw new Error('Bestätigter Schlafplatz fehlt auf der Karte');
if(!app.includes("'call','awaiting','reserving'"))throw new Error('Offene, gesendete Anfragen fehlen auf der Karte');
if(app.includes("s.mode==='network'&&c.status==='new'?'network_policy'"))throw new Error('Neue Routenkandidaten müssen die konkrete Nacht anfragen');
if(!app.includes("c.status==='new'?'Verfügbarkeit anfragen'"))throw new Error('Konkrete Verfügbarkeitsaktion fehlt');
console.log(JSON.stringify({ok:true,classicScripts:true,assetOrder:true,offlineAssets:true,mapEmbedded:true,etagSync:true,recoverableRejections:true}));
