#!/usr/bin/env node
/**
 * Baut die lokal eingebettete Frankreich-ZFE-Ebene aus amtlichen GeoJSON-
 * Quellen. Das Ergebnis ist ein klassisches Script und funktioniert deshalb
 * weiterhin direkt über file:// ohne Build-Schritt.
 *
 * Erwartete Quelldateien (standardmäßig unter /tmp):
 * - nice-zfe.geojson
 * - marseille-zfe.geojson
 * - montpellier-zfe.geojson
 * - montpellier-zfe-roads.geojson
 * - nimes-zfe.geojson
 * - bnzfe-voies.geojson
 *
 * Aufruf:
 *   node tools/build-zfe-data.mjs [/pfad/zu/den/quellen]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceDir=process.argv[2]||'/tmp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(sourceDir,name),'utf8'));
const featureCollection=features=>({type:'FeatureCollection',features});
const checkedAt='2026-07-16';

const nice=read('nice-zfe.geojson').features
  .filter(f=>f.geometry)
  .sort((a,b)=>String(a.properties.DATE_DEBUT||'').localeCompare(String(b.properties.DATE_DEBUT||'')))
  .at(-1);
const marseille=read('marseille-zfe.geojson').features
  .find(f=>f.properties.id==='200054807-ZFE-002');
const montpellier=read('montpellier-zfe.geojson').features[0];
const nimes=read('nimes-zfe.geojson');

if(!nice||!marseille||!montpellier||!nimes?.geometry)throw new Error('Eine ZFE-Fläche fehlt');

const zones=[
  {
    geometry:nice.geometry,
    properties:{
      id:'nice',
      name:'Nice Côte d’Azur',
      shortName:'Nice',
      rule:'Pkw und leichte Fahrzeuge bis 3,5 t sind seit 18.04.2025 nicht mehr vom Fahrverbot betroffen. Die Stadtseite bezeichnet die Crit’Air-Plakette im Gebiet dennoch als verpflichtend; ohne Plakette deshalb vor Einfahrt amtlich klären. Für Busse, Reisebusse und schwere Güterfahrzeuge gelten weiterhin Fahrverbote.',
      threshold:'Leichte Fahrzeuge nicht vom Fahrverbot betroffen · Plakettenpflicht trotzdem prüfen',
      hours:'24/7 für die weiterhin betroffenen schweren Fahrzeuge',
      exceptions:'Die A8 liegt außerhalb der Zone.',
      sourceUrl:'https://www.nice.fr/demarches/circuler-dans-la-zfe-vignette-critair/',
      geometryUrl:'https://cartes.nicecotedazur.org/inscrit2/rest/services/Environnement/ZFE/MapServer/1',
      checkedAt,
      lightVehiclesFree:true
    }
  },
  {
    geometry:marseille.geometry,
    properties:{
      id:'marseille',
      name:'Marseille',
      shortName:'Marseille',
      rule:'Pkw, leichte Nutzfahrzeuge, schwere Fahrzeuge und motorisierte Zweiräder benötigen eine passende Crit’Air-Plakette.',
      threshold:'Crit’Air 4, 5 und Fahrzeuge ohne Einstufung ausgeschlossen',
      hours:'24/7',
      exceptions:'A55-Hochstraße und Tunnel bleiben laut Metropole als Durchgangsachsen zugänglich. Die grün markierten Straßen stammen aus der nationalen ZFE-Datenbasis.',
      sourceUrl:'https://ampmetropole.fr/missions/strategie-environnementale/qualite-de-lair/zone-a-faibles-emissions-mobilite-zfe-m/',
      geometryUrl:'https://data.ampmetropole.fr/explore/dataset/zfe_zone_metropole-aix-marseille-provence/',
      checkedAt,
      lightVehiclesFree:false
    }
  },
  {
    geometry:nimes.geometry,
    properties:{
      id:'nimes',
      name:'Nîmes',
      shortName:'Nîmes',
      rule:'Die dauerhafte ZFE entspricht dem Stadtgebiet von Nîmes. Fahrzeuge ohne Crit’Air-Einstufung sind ausgeschlossen.',
      threshold:'Fahrzeuge ohne Einstufung ausgeschlossen',
      hours:'24/7',
      exceptions:'Amtlich ausgenommen sind A9, A54, N106, N113, D999, D40 und D613 sowie veröffentlichte Anschlussachsen. Dafür liegt keine gleichwertige amtliche ZFE-Liniendatei vor; die App zeichnet deshalb bewusst keine erfundene Trasse.',
      sourceUrl:'https://www.nimes.fr/mon-quotidien/deplacement-stationnement/la-zone-a-faibles-emissions-mobilite-zfe-m',
      geometryUrl:'https://geo.api.gouv.fr/communes/30189?format=geojson&geometry=contour',
      checkedAt,
      lightVehiclesFree:false
    }
  },
  {
    geometry:montpellier.geometry,
    properties:{
      id:'montpellier',
      name:'Montpellier Méditerranée Métropole',
      shortName:'Montpellier',
      rule:'Pkw und leichte Nutzfahrzeuge benötigen eine passende Crit’Air-Plakette. Die amtlich veröffentlichten Transitachsen werden grün dargestellt.',
      threshold:'Crit’Air 3, 4, 5 und Fahrzeuge ohne Einstufung ausgeschlossen',
      hours:'24/7',
      exceptions:'Die grün markierten Straßen sind die offiziellen Transit-Ausnahmen mit Stand 01.07.2026, darunter A9 und A709.',
      sourceUrl:'https://www.montpellier.fr/vie-quotidienne/vivre-ici/se-deplacer/je-me-deplace-en-voiture/circuler-dans-la-zone-a-faibles-emissions',
      geometryUrl:'https://data.montpellier3m.fr/dataset/zfe-zone',
      checkedAt,
      lightVehiclesFree:false
    }
  }
].map(x=>({type:'Feature',geometry:x.geometry,properties:x.properties}));

const montpellierRoads=read('montpellier-zfe-roads.geojson').features
  .filter(f=>f.geometry)
  .map(f=>({
    type:'Feature',
    geometry:f.geometry,
    properties:{
      zoneId:'montpellier',
      name:f.properties.name||'Offizielle Transitachse',
      kind:'transit',
      checkedAt
    }
  }));

const marseilleRoads=read('bnzfe-voies.geojson').features
  .filter(f=>String(f.properties?.url_site_information||'').includes('ampmetropole.fr'))
  .filter(f=>f.geometry)
  .map(f=>({
    type:'Feature',
    geometry:f.geometry,
    properties:{
      zoneId:'marseille',
      name:'Offizielle Ausnahmeachse',
      kind:'transit',
      checkedAt
    }
  }));

const payload={
  checkedAt,
  title:'Französische ZFE am Reisekorridor',
  disclaimer:'Die Flächen zeigen dauerhafte ZFE-Grenzen. Eine Campingplatz-Markierung außerhalb der Fläche beweist nicht, dass jede vorgeschlagene Zufahrt ZFE-frei ist. Temporäre Einschränkungen bei Luftverschmutzung sind nicht enthalten.',
  temporaryRestrictionsUrl:'https://www.lcsqa.org/vigilance-atmospherique',
  nationalSource:{
    label:'Base nationale consolidée des ZFE',
    url:'https://transport.data.gouv.fr/datasets/base-nationale-consolidee-des-zones-a-faibles-emissions?locale=fr',
    licence:'Licence Ouverte / Etalab 2.0'
  },
  areas:featureCollection(zones),
  transitRoads:featureCollection([...montpellierRoads,...marseilleRoads])
};

const banner=`/* Automatisch erzeugt durch tools/build-zfe-data.mjs.\n`+
  `   Amtliche Geometrien, geprüft am ${checkedAt}; nicht manuell bearbeiten. */\n`;
fs.writeFileSync(path.join(root,'zfe-data.js'),banner+'window.ZFE_DATA='+JSON.stringify(payload)+';\n');
console.log(JSON.stringify({ok:true,zones:zones.length,transitRoads:payload.transitRoads.features.length,output:path.join(root,'zfe-data.js')}));
