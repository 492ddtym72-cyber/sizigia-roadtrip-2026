/* ============================================================
   DATENHALTUNG
   - Ein versioniertes State-Objekt, Autosave via StorageAdapter.
   - StorageAdapter kapselt die Persistenz: aktuell localStorage,
     später austauschbar gegen Cloud-Sync (gleiche Schnittstelle).
   ============================================================ */
const STORAGE_KEY = 'sizigia-roadtrip-2026';
const SCHEMA_VERSION = 19;
const LOG_MAX = 60;
const UNDO_MAX = 20;

/* CLOUD-SYNC (optional):
   REST-URL einer Firebase Realtime Database inkl. geheimem Pfad + ".json",
   z. B. 'https://xyz-default-rtdb.europe-west1.firebasedatabase.app/planner/a1b2c3.json'
   null = reiner Lokal-Modus (localStorage), Datei funktioniert unverändert offline. */
let CLOUD_URL = 'https://roadtrip-to-sizigia-eclipse-default-rtdb.firebaseio.com/planner/3f58a0fd9c8ef88dc5a5aa36.json';

const StorageAdapter = {
  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ console.warn('Laden fehlgeschlagen', e); return null; }
  },
  save(state){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    }catch(e){ console.warn('Speichern fehlgeschlagen', e); return false; }
  }
};

let _uid = 0;
function uid(){ return 'x' + Date.now().toString(36) + (_uid++).toString(36) + Math.random().toString(36).slice(2,6); }

/* ---------- Standard-Daten (Vorbefüllung) ---------- */
function defaultState(){
  const crew = [
    {id:'c-jakob',     name:'Jakob',     color:'#ffb257'},
    {id:'c-christoph', name:'Christoph', color:'#ff6b4a'},
    {id:'c-bernhard',  name:'Bernhard',  color:'#8ea8ff'},
    {id:'c-max',       name:'Max',       color:'#5fd4a8'},
    {id:'c-lukas',     name:'Lukas',     color:'#e08cff'},
    {id:'c-freddi',    name:'Freddi',    color:'#ffd76b'},
  ];
  const st = (date, from, to, km, time, stay, note) => ({id:uid(), date, from, to, km, time, stay, note, link:''});
  const li = (text, who='') => ({id:uid(), text, done:false, who, assignees:who?[who]:[], doneBy:[]});

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { lastSaved: null, created: new Date().toISOString(), campingNetworkSeeded:false },
    trip:{
      id:'trip-sizigia-2026', title:'Roadtrip', subtitle:'Gemeinsam unterwegs',
      startDate:'2026-08-02', endDate:'2026-08-17', homeBase:'München / Innsbruck'
    },
    crew,
    selectedRoute: 'r-kueste',
    routes: [
      {
        id:'r-kueste', emoji:'🌊', name:'Mittelmeerküste',
        desc:'Gardasee → Ligurien → Côte d’Azur → Costa Brava. Strände, Buchten, warme Abende.',
        stages:[
          st('So 02.08.','Innsbruck (Camper-Übernahme)','Gardasee (Riva/Torbole)','280 km','~4 Std','Camping am See','München-Crew stößt in Innsbruck dazu · Brenner-Maut'),
          st('Mo 03.08.','Gardasee','Ligurien (Sestri Levante)','330 km','~4,5 Std','Camping am Meer','Abstecher Cinque Terre möglich (Zug ab Levanto)'),
          st('Di 04.08.','Ligurien','Côte d’Azur (Estérel/Fréjus)','330 km','~4 Std','Camping Küste','Küstenstraße Corniche de l’Estérel'),
          st('Mi 05.08.','Côte d’Azur','Cassis / Calanques','200 km','~2,5 Std','Camping bei Cassis','Baden in den Calanques, früh da sein'),
          st('Do 06.08.','Cassis','Sète / Cap d’Agde','220 km','~2,5 Std','Camping am Strand','Camargue-Flamingos am Weg'),
          st('Fr 07.08.','Sète','Cadaqués / Cap de Creus','200 km','~2,5 Std','Camping Costa Brava','Erste Bucht in Spanien 🇪🇸'),
          st('Sa 08.08.','Costa Brava','Chill-Tag (Cadaqués/Begur)','~60 km','flexibel','wie Vortag','Buchten, Schnorcheln, Sonnenuntergang'),
          st('So 09.08.','Costa Brava','Huesca (Region)','300 km','~3,5 Std','nahe Festivalgelände','Großeinkauf vor dem Festival! Einlass ab 10.08.'),
        ]
      },
      {
        id:'r-alpen', emoji:'🏔️', name:'Alpen & Schluchten',
        desc:'Lago Maggiore → Annecy → Ardèche → Carcassonne → Pyrenäen. Natur, Schluchten, kühler.',
        stages:[
          st('So 02.08.','Innsbruck (Camper-Übernahme)','Lago Maggiore','350 km','~4,5 Std','Camping am See','Via San-Bernardino-Route (CH-Vignette!)'),
          st('Mo 03.08.','Lago Maggiore','Annecy (Franz. Alpen)','350 km','~4,5 Std','Camping am Lac d’Annecy','Türkisblauer See, Bergpanorama'),
          st('Di 04.08.','Annecy','See-Tag Annecy','0 km','–','wie Vortag','Kajak, Radeln, Baden'),
          st('Mi 05.08.','Annecy','Ardèche (Vallon-Pont-d’Arc)','300 km','~3,5 Std','Camping an der Ardèche','Pont d’Arc'),
          st('Do 06.08.','Ardèche','Kanu-Tag Ardèche','0 km','–','wie Vortag','Kanutour unter dem Pont d’Arc (vorher reservieren)'),
          st('Fr 07.08.','Ardèche','Carcassonne','250 km','~2,5 Std','Camping bei Carcassonne','Mittelalterliche Festungsstadt am Abend'),
          st('Sa 08.08.','Carcassonne','Aínsa / Ordesa-NP (Pyrenäen)','250 km','~3,5 Std','Camping Pyrenäen','Grenzpass, spektakuläre Berge'),
          st('So 09.08.','Aínsa','Wanderung Ordesa → Huesca','120 km','~1,5 Std','nahe Festivalgelände','Morgens wandern, abends einkaufen'),
        ]
      },
      {
        id:'r-mix', emoji:'🌄', name:'Mix: Berge & Meer',
        desc:'Gardasee → Ligurien → Verdon → Calanques → Costa Brava. Das Beste aus beiden Welten.',
        stages:[
          st('So 02.08.','Innsbruck (Camper-Übernahme)','Gardasee (Riva/Torbole)','280 km','~4 Std','Camping am See','München-Crew stößt in Innsbruck dazu'),
          st('Mo 03.08.','Gardasee','Ligurien (Finale Ligure)','350 km','~4,5 Std','Camping am Meer','Erster Meer-Abend 🌅'),
          st('Di 04.08.','Ligurien','Gorges du Verdon','250 km','~3,5 Std','Camping Lac de Sainte-Croix','Europas größter Canyon'),
          st('Mi 05.08.','Verdon','Verdon-Tag','0 km','–','wie Vortag','Kajak/Tretboot auf dem Lac de Sainte-Croix'),
          st('Do 06.08.','Verdon','Cassis / Calanques','150 km','~2 Std','Camping bei Cassis','Baden in den Calanques'),
          st('Fr 07.08.','Cassis','Collioure / Côte Vermeille','300 km','~3 Std','Camping Côte Vermeille','Malerisches Künstlerdorf'),
          st('Sa 08.08.','Collioure','Cadaqués / Costa Brava','60 km','~1,5 Std','Camping Costa Brava','Cap de Creus, Chill-Nachmittag'),
          st('So 09.08.','Costa Brava','Huesca (Region)','300 km','~3,5 Std','nahe Festivalgelände','Großeinkauf vor dem Festival! Einlass ab 10.08.'),
        ]
      }
    ],
    returnStages:[
      st('Fr 14.08.','Huesca','Costa Brava (L’Escala)','300 km','~3 Std','Camping am Meer','Abschluss-Abend am Meer 🌊'),
      st('Sa 15.08.','Costa Brava','Côte d’Azur (Fréjus)','450 km','~4,5 Std','Camping Küste','Längere Fahr-Etappe'),
      st('So 16.08.','Côte d’Azur','Gardasee','400 km','~4,5 Std','Camping am See','Letzter gemeinsamer Abend'),
      st('Mo 17.08.','Gardasee','Innsbruck (Camper-Rückgabe) → München','280 km','~4 Std','–','Camper putzen & zurückgeben, Auto weiter nach München'),
    ],
    spots:[
      {id:uid(), name:'Cinque Terre', region:'Ligurien', type:'day', detour:'+1 Tag (Zug ab Levanto)', desc:'Fünf bunte Dörfer an der Steilküste. Auto/Camper in Levanto parken, mit dem Zug rein.', link:'https://www.google.com/maps/search/Cinque+Terre', votes:[]},
      {id:uid(), name:'Calanques de Cassis', region:'Provence', type:'day', detour:'auf Route Küste/Mix', desc:'Türkise Fjord-Buchten zwischen Marseille und Cassis. Wandern + Baden, früh da sein.', link:'https://www.google.com/maps/search/Calanque+d%27En-Vau', votes:[]},
      {id:uid(), name:'Pont du Gard', region:'Südfrankreich', type:'day', detour:'+45 Min', desc:'Römisches Aquädukt, drunter kann man im Fluss baden.', link:'https://www.google.com/maps/search/Pont+du+Gard', votes:[]},
      {id:uid(), name:'Gorges du Verdon', region:'Provence', type:'both', detour:'auf Route Mix/Alpen', desc:'Riesiger Canyon mit türkisem Wasser, Kajak auf dem Lac de Sainte-Croix. Rund um den See gibt’s Campingplätze für eine Übernachtung.', link:'https://www.google.com/maps/search/Gorges+du+Verdon', votes:[]},
      {id:uid(), name:'Carcassonne', region:'Okzitanien', type:'day', detour:'auf Route Alpen, sonst +1 Std', desc:'Komplett erhaltene mittelalterliche Festungsstadt.', link:'https://www.google.com/maps/search/Cit%C3%A9+de+Carcassonne', votes:[]},
      {id:uid(), name:'Cadaqués & Cap de Creus', region:'Costa Brava', type:'both', detour:'auf Route Küste/Mix', desc:'Weißes Fischerdorf (Dalís Heimat) + wilde Felsküste am östlichsten Punkt Spaniens. Beliebter Übernachtungsstopp mit dem Camper.', link:'https://www.google.com/maps/search/Cap+de+Creus', votes:[]},
      {id:uid(), name:'Dalí-Museum Figueres', region:'Katalonien', type:'day', detour:'+30 Min', desc:'Surrealistisches Museum, liegt fast am Weg zwischen Costa Brava und Huesca.', link:'https://www.google.com/maps/search/Dal%C3%AD+Theatre-Museum+Figueres', votes:[]},
      {id:uid(), name:'Ordesa y Monte Perdido NP', region:'Pyrenäen', type:'both', detour:'+1,5 Std von Huesca', desc:'Spektakulärer Nationalpark — perfekt für einen Wandertag vor oder nach dem Festival, mit Campingmöglichkeiten am Parkrand für eine Übernachtung.', link:'https://www.google.com/maps/search/Parque+Nacional+de+Ordesa', votes:[]},
      {id:uid(), name:'Bardenas Reales', region:'Navarra', type:'both', detour:'+1,5 Std von Huesca', desc:'Halbwüste wie im Western — cool für den Rückweg oder einen Tagesausflug, und mit klarem Nachthimmel auch für eine Übernachtung im Freien geeignet.', link:'https://www.google.com/maps/search/Bardenas+Reales', votes:[]},
    ],
    vehicles:[
      {
        id:'v-camper', name:'Camper (Lukas)', pickup:'Übernahme: So 02.08. in Innsbruck', drivers:['c-lukas'], passengers:['c-lukas'],
        model:'', lengthM:'', widthM:'', heightM:'', registration:'',
        notes:'Einweisung durch Lukas: Gas, Wasser, Abwasser, Strom (CEE), Markise.',
        docs:[
          {id:uid(), text:'Fahrzeugschein & Versicherung (Grüne Karte)', done:false},
          {id:uid(), text:'Vignette Österreich', done:false},
          {id:uid(), text:'Maut Italien/Frankreich/Spanien einplanen (Camper-Tarif!)', done:false},
          {id:uid(), text:'Gasflasche voll? Ersatzflasche?', done:false},
          {id:uid(), text:'Frischwasser auffüllen, Abwasser leeren', done:false},
          {id:uid(), text:'Warnwesten für alle Insassen, Verbandskasten, Warndreieck', done:false},
          {id:uid(), text:'Ersatzrad / Pannenset checken', done:false},
          {id:uid(), text:'CEE-Adapter & Verlängerungskabel für Campingstrom', done:false},
        ]
      },
      {
        id:'v-auto', name:'Kleinwagen (Bernhard)', pickup:'Start: So 02.08. in München', drivers:['c-bernhard'], passengers:['c-bernhard'],
        notes:'Treffpunkt mit dem Camper in Innsbruck.',
        docs:[
          {id:uid(), text:'Vignette Österreich', done:false},
          {id:uid(), text:'Crit’Air-Umweltplakette für Frankreich bestellen (dauert ~2 Wochen!)', done:false},
          {id:uid(), text:'Warnwesten, Verbandskasten, Warndreieck', done:false},
          {id:uid(), text:'Versicherung / Schutzbrief fürs Ausland checken', done:false},
          {id:uid(), text:'Reifendruck & Öl checken (lange Strecke)', done:false},
        ]
      }
    ],
    checklist:[
      li('Festival-Tickets für alle 6 gekauft & gespeichert'),
      li('Sonnenfinsternis-Brillen für alle besorgen! (12.08.) 🌒'),
      li('Personalausweis/Reisepass — alle gültig?'),
      li('Europäische Krankenversicherungskarte (EHIC) — alle dabei?'),
      li('EU-Roaming / Datenvolumen checken'),
      li('Kreditkarten + Bargeld (EUR) besorgen'),
      li('Offline-Karten runterladen (Google Maps: IT/FR/ES)'),
      li('Campingplätze für erste Nacht (02.08.) rausgesucht'),
      li('Festival: Camper-/Anreise-Regeln gelesen'),
      li('Playlist für die Fahrt 🎶'),
    ],
    packing:[
      {id:'pk-camp', name:'Camping & Schlafen', items:[
        li('Zelte (wer bringt welches?)'), li('Schlafsäcke'), li('Isomatten / Luftmatratzen'),
        li('Campingstühle (6×)'), li('Campingtisch'), li('Pavillon / Tarp (Schatten!)'),
        li('Hammer + extra Heringe'), li('Lichterkette / Campinglampe'), li('Hängematte'),
      ]},
      {id:'pk-kueche', name:'Küche', items:[
        li('Gaskocher + Kartuschen'), li('Töpfe + Pfanne'), li('Geschirr & Besteck (6×)'),
        li('Scharfes Messer + Schneidebrett'), li('Kühlbox (+ Kühlakkus)'), li('French Press / Kaffeekanne'),
        li('Spülmittel, Schwamm, Geschirrtuch'), li('Müllsäcke'), li('Dosen-/Flaschenöffner, Korkenzieher'),
        li('Feuerzeug / Streichhölzer'), li('Wasserkanister (großer Vorrat!)'),
      ]},
      {id:'pk-festival', name:'Festival', items:[
        li('SoFi-Brillen (6×) — WICHTIG! 🌒'), li('Ohrstöpsel'), li('Bauchtasche / kleiner Rucksack'),
        li('Verkleidung / Glitzer / Outfits'), li('Fahne / Erkennungszeichen fürs Camp'),
        li('Trinkflaschen (nachfüllbar)'), li('Bandana / Staubschutz'), li('Deko fürs Camp'),
      ]},
      {id:'pk-hygiene', name:'Hygiene & Gesundheit', items:[
        li('Sonnencreme LSF 50 (Aragón = brutal heiß)'), li('Mückenspray'), li('Erste-Hilfe-Set'),
        li('Persönliche Medikamente'), li('Feuchttücher + Klopapier'), li('Handdesinfektion'),
        li('Duschzeug (biologisch abbaubar)'), li('Mikrofaser-Handtücher'), li('After-Sun'),
      ]},
      {id:'pk-docs', name:'Dokumente & Geld', items:[
        li('Festival-Tickets (digital + ausgedruckt)'), li('Ausweis / Reisepass'), li('Führerscheine'),
        li('EHIC-Krankenkassenkarte'), li('Bargeld + Kreditkarte'), li('Fahrzeugpapiere (beide Fahrzeuge)'),
        li('Kopien wichtiger Dokumente (Cloud + Papier)'),
      ]},
      {id:'pk-tech', name:'Technik', items:[
        li('Powerbanks (groß, mehrere)'), li('Ladekabel + KFZ-Ladegeräte'), li('Bluetooth-Box'),
        li('Stirnlampen (6×)'), li('Solarpanel (falls vorhanden)'), li('Kamera'),
        li('Mehrfachstecker + CEE-Camping-Adapter'),
      ]},
    ],
    shopping:[
      {id:'sh-essen', name:'Essen', items:[
        li('Nudeln + Reis'), li('Pesto / Saucen'), li('Konserven (Bohnen, Mais, Tomaten)'),
        li('Müsli / Haferflocken'), li('Brot + Aufstriche'), li('Snacks / Riegel / Nüsse'),
        li('Gewürze, Öl, Salz'), li('Kaffee + Tee'), li('Obst & Gemüse (unterwegs frisch kaufen)'),
      ]},
      {id:'sh-getraenke', name:'Getränke', items:[
        li('Wasser in Kanistern (Festival!)'), li('Bier 🍻'), li('Softdrinks / Saft'),
        li('Elektrolyte / Iso'), li('Wein / Sangria für den Abend'),
      ]},
      {id:'sh-sonst', name:'Sonstiges', items:[
        li('Eis / Kühlakkus für die Kühlbox'), li('Alufolie + Frischhaltefolie'), li('Küchenrolle'),
        li('Zip-Beutel'), li('Grillkohle (Feuerregeln beachten!)'), li('Sonnencreme-Nachschub'),
      ]},
    ],
    budget:{ expenses:[] },
    reminders:[],
    polls:[],
    campContacts:[],
    archive:{campingReminders:[]},
    sleepPlaces:[],
    sleepSearches:[],
    mailAssistant:{processedMessageIds:[],draftRequests:[],reviewQueue:[],runnerMode:'local',mailProvider:'icloud',runners:{local:{lastSuccessAt:null,lastRunAt:null,lastError:'',nextRunAt:null},cloud:{lastSuccessAt:null,lastRunAt:null,lastError:'',nextRunAt:null}},lease:null,lastSuccessAt:null,lastRunAt:null,lastError:'',nextRunAt:null},
    log:[],
    festival:[
      {id:uid(), title:'Sizigia Eclipse Gathering 2026', text:'10.–14.08.2026 · Provinz Huesca (Aragón, Spanien).\nGenauer Standort & Anfahrt: siehe Ticket-/Info-Mail — hier eintragen, sobald bekannt.'},
      {id:uid(), title:'Totale Sonnenfinsternis · 12.08.2026', text:'Highlight des Festivals: totale Sonnenfinsternis am frühen Abend (in Nordspanien ca. 20:25–20:30 Uhr, Totalität ~1–2 Min — genaue Zeit je nach Standort prüfen!).\nSoFi-Brillen für alle sind Pflicht. 🌒'},
      {id:uid(), title:'Tickets & Einlass', text:'Status: __ von 6 Tickets gekauft.\nEinlass ab: eintragen.\nTicket-Links / QR-Codes: wo gespeichert?'},
      {id:uid(), title:'Anreise, Parken & Camper', text:'Camper-/Caravan-Regeln des Festivals checken (eigener Bereich? Aufpreis?).\nLetzter Supermarkt vor dem Gelände: eintragen.\nWasser-Situation vor Ort: eintragen.'},
      {id:uid(), title:'Hitze & Sicherheit', text:'August in Aragón: oft 35 °C+. Schatten (Tarp!), viel Wasser, Siesta einplanen.\nFeuer-/Grillverbote in Spanien im Sommer beachten.\nNotrufnummer EU-weit: 112.'},
    ],
  };
}

function allListItems(src=state){
  const out = [];
  (src.checklist||[]).forEach(i=>out.push(i));
  (src.vehicles||[]).forEach(v=>(v.docs||[]).forEach(i=>out.push(i)));
  (src.packing||[]).forEach(c=>(c.items||[]).forEach(i=>out.push(i)));
  (src.shopping||[]).forEach(c=>(c.items||[]).forEach(i=>out.push(i)));
  return out;
}
function normalizeListItem(item){
  if(!item || typeof item !== 'object') return item;
  const crewIds = new Set(['c-jakob','c-christoph','c-bernhard','c-max','c-lukas','c-freddi']);
  const legacy = item.who && crewIds.has(item.who) ? [item.who] : [];
  item.assignees = Array.isArray(item.assignees) ? item.assignees.filter(id=>crewIds.has(id)) : legacy;
  item.doneBy = Array.isArray(item.doneBy) ? item.doneBy.filter(id=>item.assignees.includes(id)) : [];
  if(item.done && item.assignees.length > 1 && item.doneBy.length === 0) item.doneBy = [...item.assignees];
  item.who = item.assignees.length === 1 ? item.assignees[0] : (item.assignees.length ? '' : (item.who || ''));
  return item;
}

const SLEEP_STATUSES = {
  new:{label:'Neu'}, awaiting:{label:'Angefragt'}, available:{label:'Verfügbar'},
  reservable:{label:'Reservierung möglich'},
  draft_requested:{label:'Entwurf wird erstellt'}, reserving:{label:'Reservierung angefragt'},
  deposit_required:{label:'Anzahlung nötig'}, booked:{label:'Bestätigt'},
  call:{label:'Spontan anrufen'}, followup:{label:'Erneut fragen'},
  unavailable:{label:'Nicht verfügbar'}
};
const CAMPING_NETWORK_HUBS = [
  {id:'liguria',title:'Ligurien',region:'Finale Ligure–Sestri Levante',startDate:'2026-08-03',endDate:'2026-08-04',arrivalWindowStart:'2026-08-03',arrivalWindowEnd:'2026-08-03',target:4,order:1},
  {id:'provence-east',title:'Provence Ost',region:'Fréjus/Estérel · Verdon',startDate:'2026-08-04',endDate:'2026-08-05',arrivalWindowStart:'2026-08-04',arrivalWindowEnd:'2026-08-05',target:4,order:2},
  {id:'cassis-marseille',title:'Cassis–Marseille',region:'Cassis · La Ciotat · Marseille',startDate:'2026-08-05',endDate:'2026-08-06',arrivalWindowStart:'2026-08-05',arrivalWindowEnd:'2026-08-06',target:4,order:3},
  {id:'camargue',title:'Camargue',region:'Arles · Petite Camargue · Lunel',startDate:'2026-08-05',endDate:'2026-08-06',arrivalWindowStart:'2026-08-05',arrivalWindowEnd:'2026-08-06',target:3,order:4},
  {id:'languedoc',title:'Languedoc',region:'Sète–Narbonne–Fitou',startDate:'2026-08-06',endDate:'2026-08-07',arrivalWindowStart:'2026-08-06',arrivalWindowEnd:'2026-08-07',target:4,order:5},
  {id:'cote-vermeille',title:'Côte Vermeille',region:'Collioure–Argelès-sur-Mer',startDate:'2026-08-07',endDate:'2026-08-08',arrivalWindowStart:'2026-08-07',arrivalWindowEnd:'2026-08-08',target:4,order:6},
  {id:'costa-brava',title:'Costa Brava Nord',region:'Cadaqués–Begur',startDate:'2026-08-08',endDate:'2026-08-09',arrivalWindowStart:'2026-08-08',arrivalWindowEnd:'2026-08-09',target:4,order:7},
  {id:'huesca',title:'Huesca-Anfahrt',region:'Aínsa–Barbastro–Huesca',startDate:'2026-08-09',endDate:'2026-08-10',arrivalWindowStart:'2026-08-09',arrivalWindowEnd:'2026-08-09',target:4,order:8}
];
const CAMPING_NETWORK_CANDIDATES = [
  {hub:'liguria',name:'Camping dei Fiori',region:'Pietra Ligure',email:'info@campingdeifiori.it',phone:'+39 019 615255',lat:44.1475,lng:8.2742,officialUrl:'https://www.campingdeifiori.it/',link:'https://www.google.com/maps/search/?api=1&query=Camping+dei+Fiori+Pietra+Ligure'},
  {hub:'liguria',name:'Campeggio Fossa Lupara',region:'Sestri Levante',email:'campingfossalupara@hotmail.it',phone:'+39 0185 455056',lat:44.2779,lng:9.4117,officialUrl:'https://www.campingfossalupara.com/',link:'https://www.google.com/maps/search/?api=1&query=Campeggio+Fossa+Lupara'},
  {hub:'liguria',name:'Levante Camper',region:'Sestri Levante',email:'levantecamper@gmail.com',phone:'+39 0185 43340',lat:44.2755,lng:9.4073,officialUrl:'https://www.levantecamper.com/',link:'https://www.google.com/maps/search/?api=1&query=Levante+Camper+Sestri+Levante'},
  {hub:'liguria',name:'Camping Mare Monti',region:'Sestri Levante · Riva Trigoso',email:'info@campingmaremonti.com',phone:'+39 0185 44348',lat:44.2639,lng:9.4419,officialUrl:'https://www.campingmaremonti.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Mare+Monti+Sestri+Levante'},
  {hub:'liguria',name:'Camping Roma',region:'Albenga · direkt am Meer',email:'info@campingroma.com',phone:'+39 0182 52317',lat:44.042908,lng:8.223093,officialUrl:'https://www.campingroma.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Roma+Albenga',preferred:true,requestedArrivalDate:'2026-08-03',requestedDepartureDate:'2026-08-04',notes:'Küstenfavorit für 03.–04.08.: wenige Schritte zum Meer und eigener Strandzugang. Offizieller 2026-Tagespreis für Stellplätze; ein zweites Auto kostet laut Tarif 10 €. Verfügbarkeit für 6 Erwachsene noch bestätigen.'},
  {hub:'liguria',name:'Camping Angolo di Sogno',region:'Diano Marina · direkt am Meer',email:'info@angolodisogno.it',phone:'+39 0183 1940131',lat:43.89808,lng:8.07849,officialUrl:'https://www.angolodisogno.it/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Angolo+di+Sogno+Diano+Marina',preferred:true,requestedArrivalDate:'2026-08-03',requestedDepartureDate:'2026-08-04',inquiryQuestion:'Could you please confirm whether the small car can be parked overnight outside or near the campsite?',notes:'Küstenfavorit für 03.–04.08.: Halbinsel direkt am Meer, drei angrenzende Strände und Sonnenuntergang vom Stellplatz. Eine Nacht, 6 Erwachsene und Parkplatz für den Kleinwagen noch bestätigen.'},
  {hub:'liguria',name:'Camping Vallecrosia',region:'Vallecrosia · direkt am Meer',email:'info@campingvallecrosia.com',phone:'+39 0184 295591',lat:43.78421,lng:7.63358,officialUrl:'https://www.campingvallecrosia.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Vallecrosia',preferred:true,requestedArrivalDate:'2026-08-03',requestedDepartureDate:'2026-08-04',inquiryQuestion:'Please also let us know whether short stays are accepted without advance reservation and the latest advisable arrival time.',notes:'Küstenalternative für 03.–04.08.: direkt an Meer und Promenade, schattig und kurz vor der französischen Grenze. Ein-Nacht-, Zusatzauto- und Spontanregeln noch bestätigen.'},
  {hub:'provence-east',name:'Esterel Caravaning',region:'Agay · Saint-Raphaël',email:'contact@esterel-caravaning.fr',phone:'+33 4 94 82 03 28',lat:43.4594,lng:6.8392,officialUrl:'https://www.esterel-caravaning.fr/',link:'https://www.google.com/maps/search/?api=1&query=Esterel+Caravaning'},
  {hub:'provence-east',name:'Camping La Pierre Verte',region:'Fréjus',email:'com@campinglapierreverte.com',phone:'+33 4 94 40 88 30',lat:43.4707,lng:6.7277,officialUrl:'https://www.campinglapierreverte.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Pierre+Verte+Frejus'},
  {hub:'provence-east',name:'Camping Les Restanques',region:'Bauduen · Lac de Sainte-Croix',email:'contact@campinglesrestanques83.com',phone:'+33 4 94 67 06 00',lat:43.7354,lng:6.1769,officialUrl:'https://www.camping-gorge-verdon.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Les+Restanques+Bauduen'},
  {hub:'provence-east',name:'Camping Rives du Lac de Sainte-Croix',region:'Bauduen',email:'contact@camping-lac-sainte-croix.fr',phone:'+33 4 94 70 05 44',lat:43.7379,lng:6.1725,officialUrl:'https://www.tikayan.com/fr/camping-rives-du-lac-de-sainte-croix-accueil',link:'https://www.google.com/maps/search/?api=1&query=Camping+Rives+du+Lac+de+Sainte+Croix'},
  {hub:'provence-east',name:'Camping L’Oasis du Verdon',region:'Aups · Verdon',email:'contact@oasis-verdon.com',phone:'+33 4 94 70 00 93',lat:43.62693,lng:6.22665,officialUrl:'https://www.oasis-verdon.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Oasis+du+Verdon+Aups',notes:'Crit’Air-freie Landroute ab A8. Eine Nacht und max. 6 Personen veröffentlicht; zweites Auto am Eingang. Großer Umweg: etwa 45–55 km einfach.'},
  {hub:'provence-east',name:'Camping Municipal Les Ruisses',region:'Les Salles-sur-Verdon',email:'info@campinglesruisses.fr',phone:'+33 4 98 10 28 15',lat:43.78129,lng:6.21309,officialUrl:'https://www.campinglesruisses.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Municipal+Les+Ruisses',notes:'Eine Nacht ausdrücklich möglich, max. 6 Personen. Lage nahe Lac de Sainte-Croix; zweites Auto und großer Umweg vorab klären.'},
  {hub:'provence-east',name:'Camping Municipal Les Roches',region:'Sainte-Croix-du-Verdon',email:'contact@lesrochesverdon.com',phone:'+33 4 92 77 78 99',lat:43.761496,lng:6.153308,officialUrl:'https://www.lesrochesverdon.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Municipal+Les+Roches+Verdon',notes:'Sehr schöne Seenähe, aber 70–85 km Umweg einfach. 2026-Regeln für 6 Erwachsene und Zusatzauto noch nicht bestätigt.'},
  {hub:'provence-east',name:'Camping Agay Soleil',region:'Agay · direkt am Meer',email:'contact@agaysoleil.com',phone:'+33 4 94 82 00 79',lat:43.432919,lng:6.8685,officialUrl:'https://www.camping-agay-soleil.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Agay+Soleil',preferred:true,requestedArrivalDate:'2026-08-04',requestedDepartureDate:'2026-08-05',inquiryQuestion:'Please also confirm that a standard van-sized camper under 7 metres is accepted in August.',notes:'Küstenfavorit für 04.–05.08.: ruhiger Familienplatz mit direktem Zugang zu einer kleinen Sandbucht. Offizieller 2026-Nachttarif; Wohnmobile und Wohnwagen über 7 m sind im Juli/August ausgeschlossen.'},
  {hub:'provence-east',name:'Camping La Plage du Dramont',region:'Agay · Estérel · direkt am Meer',email:'info@laplagedudramont.com',phone:'+33 4 94 82 07 68',lat:43.41814,lng:6.84862,officialUrl:'https://www.laplagedudramont.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Plage+du+Dramont',preferred:true,requestedArrivalDate:'2026-08-04',requestedDepartureDate:'2026-08-05',inquiryQuestion:'If possible, we would be especially interested in a pitch facing the sea or the Ile d’Or.',notes:'Küstenfavorit für 04.–05.08.: Pinienwald direkt am Meer, rote Estérel-Felsen und Blick auf die Île d’Or. Eine Nacht, 6 Erwachsene und Zusatzauto noch bestätigen.'},
  {hub:'provence-east',name:'Camping Saint-Aygulf Plage',region:'Saint-Aygulf · direkt am Strand',email:'info@campingdesaintaygulf.fr',phone:'+33 4 94 17 62 49',lat:43.391808,lng:6.725955,officialUrl:'https://www.campingdesaintaygulf.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Saint+Aygulf+Plage',preferred:true,requestedArrivalDate:'2026-08-04',requestedDepartureDate:'2026-08-05',inquiryQuestion:'Could you please confirm whether the small car can be parked overnight and how the deposit works for a one-night reservation?',notes:'Sehr praktische Küstenoption für 04.–05.08.: direkter Strandzugang, offizieller Nachttarif und max. 6 Personen pro Stellplatz. Zusatzauto und Anzahlung für eine Nacht noch klären.'},
  {hub:'cassis-marseille',name:'Camping Les Cigales',region:'Cassis',email:'contact@lescigalescamping.fr',phone:'+33 4 42 01 07 34',lat:43.2227,lng:5.5456,officialUrl:'https://www.lescigalescamping.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Les+Cigales+Cassis'},
  {hub:'cassis-marseille',name:'Aux Portes de Cassis',region:'Roquefort-la-Bédoule',email:'auxportesdecassis@gmail.com',phone:'+33 4 42 73 21 17',lat:43.2481,lng:5.5858,officialUrl:'https://auxportesdecassis.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Aux+Portes+de+Cassis'},
  {hub:'cassis-marseille',name:'Youcamp Village Marseille Provence',region:'Aubagne',email:'contact@youcamp-marseille.fr',phone:'+33 4 42 82 19 95',lat:43.3026,lng:5.6025,officialUrl:'https://www.youcamp-marseille.fr/',link:'https://www.google.com/maps/search/?api=1&query=Youcamp+Village+Marseille+Provence'},
  {hub:'cassis-marseille',name:'Camping de la Sauge',region:'La Ciotat',email:'campinglasauge@orange.fr',phone:'+33 4 42 83 47 65',lat:43.1894,lng:5.6318,officialUrl:'https://www.campingdelasauge.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+de+la+Sauge+La+Ciotat'},
  {hub:'cassis-marseille',name:'Camping Santa Gusta',region:'La Ciotat · Fontsainte · direkt am Meer',email:'',phone:'+33 4 42 83 14 17',contactFormUrl:'https://www.santagusta.com/contactez-nous/',lat:43.18935,lng:5.64496,officialUrl:'https://www.santagusta.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Santa+Gusta+La+Ciotat',preferred:true,requestedArrivalDate:'2026-08-05',requestedDepartureDate:'2026-08-06',notes:'Wunschplatz für 05.–06.08.: kleiner Familiencampingplatz direkt am Meer bei La Ciotat. Der aktuelle offizielle Kontakt läuft über Formular oder Telefon; keine verifizierte E-Mail veröffentlicht.'},
  {hub:'cassis-marseille',name:'Camping Les Tamaris',region:'La Couronne · Côte Bleue · Meeresbucht',email:'lestamaris@pausado.com',phone:'+33 4 86 86 10 20',lat:43.3304726,lng:5.0796694,officialUrl:'https://les-tamaris.pausado.com/en',link:'https://www.google.com/maps/search/?api=1&query=Camping+Les+Tamaris+Martigues',preferred:true,requestedArrivalDate:'2026-08-05',requestedDepartureDate:'2026-08-06',inquiryQuestion:'Could you please confirm whether the small car can be parked overnight and whether a sea-facing pitch can be requested for one night?',notes:'Küstenfavorit für 05.–06.08.: ruhige geschützte Bucht der Côte Bleue, Stellplätze zum Mittelmeer und direkter Wasserzugang. Eine Nacht für 6 Erwachsene und Zusatzauto bestätigen.'},
  {hub:'cassis-marseille',name:'Camping Le Mas',region:'La Couronne · Côte Bleue · Strand',email:'',phone:'+33 4 42 80 70 34',contactFormUrl:'https://www.camping-le-mas.com/en/',lat:43.332013,lng:5.073398,officialUrl:'https://www.camping-le-mas.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Le+Mas+Martigues',preferred:true,requestedArrivalDate:'2026-08-05',requestedDepartureDate:'2026-08-06',inquiryQuestion:'If available, we would prefer a sea-view pitch for this one-night stay.',notes:'Praktische Küstenoption für 05.–06.08.: Pinienwald, direkter Strandzugang und teilweise Meerblick. Ein-Nacht-Stellplätze und Zusatzauto für 5 € veröffentlicht; Kontakt über offizielles Buchungsformular oder Telefon.'},
  {hub:'camargue',name:'Flower Camping Le Mas de Mourgues',region:'Gallician · Camargue',email:'info@masdemourgues.com',phone:'+33 4 66 73 30 88',lat:43.654198,lng:4.295583,officialUrl:'https://www.masdemourgues.com/',link:'https://www.google.com/maps/search/?api=1&query=Flower+Camping+Le+Mas+de+Mourgues',preferred:true,notes:'Favorit: ruhige Camargue-Lage, max. 6 Personen und zweites Auto am Eingang veröffentlicht. Zufahrt über A54/A9 ohne ZFE-Abfahrt.'},
  {hub:'camargue',name:'Camping La Brise de Camargue',region:'Saintes-Maries-de-la-Mer',email:'info@camping-labrise.fr',phone:'+33 4 90 97 84 67',lat:43.45583,lng:4.43611,officialUrl:'https://www.camping-labrise.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Brise+de+Camargue',notes:'Direkt bei Strand und Ort, max. 6 Personen. Etwa 45–55 km Umweg; Parkplatz für das Zusatzauto vorab klären.'},
  {hub:'camargue',name:'Camping Bon Port',region:'Lunel · Petite Camargue',email:'contact@campingbonport.com',phone:'+33 4 67 71 15 65',lat:43.65556,lng:4.14194,officialUrl:'https://www.campingbonport.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Bon+Port+Lunel',notes:'Nur 10–15 km von der A9 und außerhalb Montpellier Métropole. Max. 6 und Zusatzauto-Parkplatz veröffentlicht; eine einzelne Augustnacht noch bestätigen.'},
  {hub:'languedoc',name:'Camping Cayola',region:'Vias-Plage',email:'campingcayola@orange.fr',phone:'+33 4 67 90 01 85',lat:43.2877,lng:3.3702,officialUrl:'https://www.campingcayola.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Cayola+Vias'},
  {hub:'languedoc',name:'Camping Club Farret',region:'Vias-Plage',email:'info@farret.com',phone:'+33 4 67 21 64 45',lat:43.2946,lng:3.4176,officialUrl:'https://www.camping-farret.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Club+Farret'},
  {hub:'languedoc',name:'Camping Les Mimosas',region:'Portiragnes',email:'mimosas@mimosas.com',phone:'+33 4 67 90 92 92',lat:43.2818,lng:3.3457,officialUrl:'https://www.mimosas.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Les+Mimosas+Portiragnes'},
  {hub:'languedoc',name:'Camping Beau Rivage',region:'Mèze · Étang de Thau',email:'beau-rivage@koawa.com',phone:'+33 4 66 60 07 00',lat:43.4257,lng:3.6123,officialUrl:'https://www.camping-beaurivage.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Beau+Rivage+Meze'},
  {hub:'languedoc',name:'Camping La Tamarissière',region:'Agde · La Tamarissière',email:'contact@camping-latama.com',phone:'+33 4 67 94 79 46',lat:43.2868153,lng:3.441141,officialUrl:'https://camping-latama.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Tamarissiere+Agde',preferred:true,notes:'Favorit: offizieller 2026-Tarif pro Nacht, max. 6 Personen und zweites Auto gegen Aufpreis. Für 06./07.08. anfragen; Buchung wird erst nach Bestätigung und Zahlung verbindlich.'},
  {hub:'languedoc',name:'Camping Le Val de Cesse',region:'Mirepeïsset · Canal du Midi',email:'contact@campingvaldecesse.com',phone:'+33 4 68 46 14 94',lat:43.286871,lng:2.888095,officialUrl:'https://www.campingvaldecesse.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Le+Val+de+Cesse+Mirepeisset',preferred:true,notes:'Favorit: Fluss und Canal du Midi, ab einer Nacht, max. 6 und Zusatzauto-Tarif. Adresse „La Garenne, 11120 Mirepeïsset“ nutzen; Website-Koordinaten wirken fehlerhaft.'},
  {hub:'languedoc',name:'Camping La Grange Neuve',region:'Sigean',email:'info@campingsigean.com',phone:'+33 4 68 48 58 70',lat:43.066726,lng:2.941438,officialUrl:'https://campingsigean.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Grange+Neuve+Sigean',preferred:true,notes:'Favorit: nur etwa 8–12 km von A9, Natur nahe Réserve Africaine, max. 6. Parkplatz für den Kleinwagen noch klären.'},
  {hub:'languedoc',name:'Camping Le Fun',region:'Fitou · Étang de Leucate',email:'contact@lefun-camping.com',phone:'+33 4 68 45 71 97',lat:42.914282,lng:2.998908,officialUrl:'https://www.lefun-camping.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Le+Fun+Fitou',preferred:true,notes:'Favorit: 5–10 km von A9, 1–2 Nächte ausdrücklich möglich, max. 6. Übernachtungsplatz für das zweite Auto noch klären.'},
  {hub:'cote-vermeille',name:'Camping Le Front de Mer',region:'Argelès-sur-Mer',email:'frontdemer66@gmail.com',phone:'+33 4 68 81 08 70',lat:42.5581,lng:3.0437,officialUrl:'https://camping-front-mer.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Le+Front+de+Mer+Argeles'},
  {hub:'cote-vermeille',name:'Les Criques de Porteils',region:'Collioure',email:'contactcdp@lescriques.com',phone:'+33 4 68 81 12 73',lat:42.5362,lng:3.0729,officialUrl:'https://www.lescriques.com/',link:'https://www.google.com/maps/search/?api=1&query=Les+Criques+de+Porteils'},
  {hub:'cote-vermeille',name:'Camping La Chapelle',region:'Argelès-sur-Mer',email:'',phone:'+33 9 77 55 52 58',lat:42.5518,lng:3.0376,officialUrl:'https://www.camping-la-chapelle.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Chapelle+Argeles'},
  {hub:'cote-vermeille',name:'Camping Les Marsouins',region:'Argelès-sur-Mer',email:'lesmarsouins@cielavillage.com',phone:'+33 4 68 81 14 81',lat:42.5686,lng:3.0298,officialUrl:'https://lesmarsouins.cielavillage.fr/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Les+Marsouins+Argeles'},
  {hub:'cote-vermeille',name:'Camping Le Haras',region:'Palau-del-Vidre',email:'contact@camping-le-haras.com',phone:'+33 4 68 22 14 50',lat:42.575833,lng:2.964722,officialUrl:'https://www.camping-le-haras.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Le+Haras+Palau+del+Vidre',preferred:true,notes:'Favorit: ruhige Lage zwischen Küste und Albères, max. 6; zweites Auto auf separatem Parkplatz möglich. Perpignan-ZFE vor Abfahrt erneut prüfen.'},
  {hub:'cote-vermeille',name:'Camping Les Casteillets',region:'Saint-Jean-Pla-de-Corts',email:'jc@campinglescasteillets.com',phone:'+33 4 68 83 26 83',lat:42.510556,lng:2.791389,officialUrl:'https://www.campinglescasteillets.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Les+Casteillets',preferred:true,notes:'Favorit: 6–10 km ab A9, eine Nacht ausdrücklich möglich, max. 6. Zweites Auto noch klären; Perpignan-ZFE vor Abfahrt erneut prüfen.'},
  {hub:'cote-vermeille',name:'Camping La Coscolleda',region:'Sorède · Albères',email:'campinglacoscolleda@gmail.com',phone:'+33 4 68 89 16 65',lat:42.534722,lng:2.96,officialUrl:'https://www.camping-lacoscolleda.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+La+Coscolleda+Sorede',notes:'Kleiner Platz am Fluss, eine Nacht und bis 8 Personen veröffentlicht. Zweites Auto ungeklärt; Fahrzeuge über 5 m müssen die spezielle Anfahrt beachten.'},
  {hub:'costa-brava',name:'Wecamp Cadaqués',region:'Cadaqués',email:'hola@cadaques.wecamp.net',phone:'+34 900 056 003',lat:42.2876,lng:3.2753,officialUrl:'https://wecamp.net/destinos/cadaques/',link:'https://www.google.com/maps/search/?api=1&query=Wecamp+Cadaques'},
  {hub:'costa-brava',name:'Càmping Begur',region:'Begur',email:'info@campingbegur.com',phone:'+34 972 623 201',lat:41.9404,lng:3.1989,officialUrl:'https://campingbegur.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Begur'},
  {hub:'costa-brava',name:'Camping Aquarius',region:'Sant Pere Pescador',email:'booking@campingaquarius.com',phone:'+34 972 520 101',lat:42.1887,lng:3.1114,officialUrl:'https://www.campingaquarius.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Aquarius+Sant+Pere+Pescador'},
  {hub:'costa-brava',name:'Camping Amfora',region:'Sant Pere Pescador',email:'info@campingamfora.com',phone:'+34 972 520 540',lat:42.1807,lng:3.1068,officialUrl:'https://www.campingamfora.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Amfora+Sant+Pere+Pescador'},
  {hub:'costa-brava',name:'Camping Maçanet de Cabrenys',region:'Maçanet de Cabrenys · Alt Empordà',email:'info@campingmassanet.com',phone:'+34 667 776 648',lat:42.38543,lng:2.75208,officialUrl:'https://www.campingmassanet.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Macanet+de+Cabrenys',notes:'Ruhige bewaldete Alternative zwischen Costa Brava und Pyrenäen. Wohnmobile werden akzeptiert; eine Nacht, 6 Erwachsene und Parkplatz für den Kleinwagen vorab bestätigen.'},
  {hub:'huesca',name:'Camping Aínsa',region:'Aínsa',email:'info@campingainsa.com',phone:'+34 974 500 260',lat:42.4252,lng:0.1511,officialUrl:'https://campingainsa.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Ainsa'},
  {hub:'huesca',name:'Camping Alquézar',region:'Alquézar',email:'camping@alquezar.com',phone:'+34 974 318 300',lat:42.1664,lng:0.0248,officialUrl:'https://www.campingalquezar.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Alquezar'},
  {hub:'huesca',name:'Camping Peña Montañesa',region:'Labuerda · Aínsa',email:'info@penamontanesa.com',phone:'+34 974 500 032',lat:42.4505,lng:0.1356,officialUrl:'https://www.penamontanesa.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Pena+Montanesa'},
  {hub:'huesca',name:'Camping Ribera del Ara',region:'Fiscal',email:'',phone:'+34 974 503 035',lat:42.4914,lng:-0.1203,officialUrl:'https://www.riberadelara.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Ribera+del+Ara+Fiscal'},
  {hub:'huesca',name:'wecamp Pirineos',region:'Boltaña · Río Ara',email:'hola@pirineos.wecamp.net',phone:'+34 93 626 89 00',lat:42.430168,lng:0.078867,officialUrl:'https://wecamp.net/en/locations/pirineos',link:'https://www.google.com/maps/search/?api=1&query=wecamp+Pirineos+Boltana',preferred:true,notes:'Favorit nahe Aínsa: offizielle Stellplätze für Camper mit Wasser, Strom und Abwasser. Für 09.08. eine Nacht, 6 Erwachsene und das zweite Auto bestätigen.'},
  {hub:'huesca',name:'Camping Laspaúles',region:'Laspaúles · N-260',email:'camping@laspaules.com',phone:'+34 974 55 33 20',lat:42.47126,lng:0.59919,officialUrl:'https://www.laspaules.com/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Laspaules',notes:'Östliche Pyrenäen-Alternative direkt an der N-260 mit 70–80 m² großen Stellplätzen. Eine Nacht, 6 Erwachsene und das zweite Auto für 09.08. bestätigen.'}
];
const CAMPING_FIRST_NIGHT_ADDITIONS_V13 = [
  {name:'Camping Verona Village',region:'Verona · nahe A22',email:'info@campingverona.com',phone:'+39 045 2050660',lat:45.39306,lng:10.99298,officialUrl:'https://www.campingverona.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Verona+Village',notes:'Zusätzliche erste Etappe ab Innsbruck: nur etwa 1,5 km von der Autobahnausfahrt, 150 ausgestattete Stellplätze mit ca. 50 m². Für 02.–03.08. Platz für 6 Erwachsene und den Kleinwagen bestätigen.'}
];
const PRIVATE_STAY_ADDITION_V16 = {
  hub:'languedoc',kind:'private',name:'Privater Stellplatz · Les Salces',region:'Les Salces · Saint-Privat · nordwestlich von Montpellier',
  lat:43.7549461,lng:3.4355718,link:'https://maps.app.goo.gl/oQneJWoBTrsSp6RD6?g_st=aw'
};
const CAMPING_NETWORK_VERIFIED = new Set(['Camping dei Fiori','Campeggio Fossa Lupara','Levante Camper','Camping Mare Monti','Camping Roma','Camping Angolo di Sogno','Camping Vallecrosia','Esterel Caravaning','Camping La Pierre Verte','Camping Les Restanques','Camping Rives du Lac de Sainte-Croix','Camping Agay Soleil','Camping La Plage du Dramont','Camping Saint-Aygulf Plage','Camping Les Cigales','Aux Portes de Cassis','Youcamp Village Marseille Provence','Camping de la Sauge','Camping Santa Gusta','Camping Les Tamaris','Camping Le Mas','Flower Camping Le Mas de Mourgues','Camping Cayola','Camping Club Farret','Camping Les Mimosas','Camping Beau Rivage','Camping La Tamarissière','Camping Le Val de Cesse','Camping La Grange Neuve','Camping Le Fun','Camping Le Front de Mer','Les Criques de Porteils','Camping Les Marsouins','Camping Le Haras','Camping Les Casteillets','Wecamp Cadaqués','Càmping Begur','Camping Aquarius','Camping Amfora','Camping Maçanet de Cabrenys','Camping Aínsa','Camping Alquézar','Camping Peña Montañesa','wecamp Pirineos','Camping Laspaúles','Camping Verona Village']);
function cleanCampName(title){
  return String(title||'').replace(/2\.8\s*-\s*3\.8/gi,'').replace(/spontan\s+anrufen/gi,'').replace(/[✅❌🇨🇭]/gu,'').replace(/[·:–—-]+$/,'').replace(/\s+/g,' ').trim();
}
function normalizeSleepCandidate(c){
  return Object.assign({id:uid(),kind:'camping',name:'',region:'',email:'',phone:'',link:'',contactFormUrl:'',status:'new',preferred:false,requestedArrivalDate:'',requestedDepartureDate:'',inquiryQuestion:'',price:'',tax:'',finalPrice:'',deposit:'',bookingRef:'',cancellationDeadline:'',arrivalWindow:'',offeredArrivalDate:'',offeredDepartureDate:'',confirmedAt:null,confirmation:{dates:false,party:false,camper:false,car:false},reply:'',replyQuote:'',pitchNote:'',parking:'',callWindow:'',nextAction:'',nextActionDate:'',notes:'',reminderId:null,contactId:null,contactedAt:null,repliedAt:null,mailMessageId:'',mailThreadSubject:'',draftState:'none'},c||{}, {status:SLEEP_STATUSES[c?.status]?c.status:'new',preferred:!!c?.preferred,confirmation:Object.assign({dates:false,party:false,camper:false,car:false},c?.confirmation||{})});
}
function inferSleepDates(label){
  const m=String(label||'').match(/(\d{1,2})\D+(\d{1,2})\.(\d{1,2})\.(\d{4})/); if(!m)return {startDate:'',endDate:''};
  const pad=n=>String(n).padStart(2,'0'); return {startDate:`${m[4]}-${pad(m[3])}-${pad(m[1])}`,endDate:`${m[4]}-${pad(m[3])}-${pad(m[2])}`};
}
const SLEEP_PLACE_KEYS=['kind','name','region','email','phone','link','officialUrl','contactFormUrl','contactVerified','lat','lng','notes'];
function migrateSleepPlaces(s){
  s.sleepPlaces=Array.isArray(s.sleepPlaces)?s.sleepPlaces:[];
  (s.sleepSearches||[]).forEach(search=>(search.candidates||[]).forEach(c=>{
    let p=c.placeId&&s.sleepPlaces.find(x=>x.id===c.placeId);
    if(!p)p=s.sleepPlaces.find(x=>String(x.name||'').trim().toLowerCase()===String(c.name||'').trim().toLowerCase());
    if(!p){p={id:uid(),createdAt:c.contactedAt||new Date().toISOString()};SLEEP_PLACE_KEYS.forEach(k=>{if(c[k]!==undefined&&c[k]!=='' )p[k]=c[k];});s.sleepPlaces.push(p);}
    else SLEEP_PLACE_KEYS.forEach(k=>{if((p[k]===undefined||p[k]==='')&&c[k]!==undefined&&c[k]!=='')p[k]=c[k];});
    applyLinkCoords(p);
    c.placeId=p.id;
  }));
  const known=[
    {match:'camping belvedere',lat:46.0038,lng:11.2580,region:'Calceranica al Lago',phone:'+39 0461 723239'},
    {match:'camping al sole',lat:45.8781,lng:10.7678,region:'Molina di Ledro',email:'info@campingalsole.it',phone:'+39 0464 508496'},
    {match:'al pescatore',lat:46.0023,lng:11.2552,region:'Calceranica al Lago',email:'trentino@campingpescatore.it',phone:'+39 0461 723062'},
    {match:'pa-lo parking',lat:46.7347,lng:11.6491,region:'Vahrn / Varna',email:'info@loewenhof.it',phone:'+39 0472 836216'},
  ];
  known.forEach(k=>{const p=s.sleepPlaces.find(x=>String(x.name||'').toLowerCase().includes(k.match));if(p){['lat','lng','region','email','phone'].forEach(key=>{if(p[key]===undefined||p[key]==='')p[key]=k[key];});}});
}
// Camping-Kontakte war die erste Plan-B-Liste. Der Schlafplatz-Radar ist nun
// die einzige operative Ansicht; das alte Array bleibt unverändert als Archiv.
// Seine Angaben füllen ausschließlich noch leere Felder im Radar.
function mergeLegacyCampContacts(s){
  const contacts=Array.isArray(s.campContacts)?s.campContacts:[];
  const places=Array.isArray(s.sleepPlaces)?s.sleepPlaces:[];
  const searches=Array.isArray(s.sleepSearches)?s.sleepSearches:[];
  const key=value=>String(value||'').trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
  contacts.forEach(contact=>{
    const candidates=searches.flatMap(search=>Array.isArray(search.candidates)?search.candidates:[]);
    const candidate=candidates.find(c=>c.contactId===contact.id)||candidates.find(c=>key(c.name)===key(contact.name));
    const place=(candidate?.placeId&&places.find(p=>p.id===candidate.placeId))||places.find(p=>key(p.name)===key(contact.name));
    if(place){
      const values={region:contact.region,phone:contact.phone,link:contact.link,notes:contact.note};
      Object.entries(values).forEach(([field,value])=>{if((place[field]===undefined||place[field]==='')&&value)place[field]=value;});
    }
    if(candidate){
      if(!candidate.contactId)candidate.contactId=contact.id;
      if(!candidate.notes&&contact.note)candidate.notes=contact.note;
    }
  });
}
function archiveCampingReminders(s){
  s.archive=s.archive&&typeof s.archive==='object'?s.archive:{};
  s.archive.campingReminders=Array.isArray(s.archive.campingReminders)?s.archive.campingReminders:[];
  const linked=new Set((Array.isArray(s.sleepSearches)?s.sleepSearches:[]).flatMap(search=>(Array.isArray(search.candidates)?search.candidates:[]).map(c=>c.reminderId).filter(Boolean)));
  const legacy=reminder=>/camping|campeggio|stellplatz|la fornace|spiaggia/i.test(String(reminder?.title||''))&&/2\.8\s*[-–]\s*3\.8|02\.–03\.08\.2026/i.test(String(reminder?.title||''));
  const removed=(Array.isArray(s.reminders)?s.reminders:[]).filter(r=>linked.has(r.id)||legacy(r));
  const archivedIds=new Set(s.archive.campingReminders.map(r=>r.id));
  removed.forEach(r=>{if(!archivedIds.has(r.id)){s.archive.campingReminders.push(r);archivedIds.add(r.id);}});
  s.reminders=(Array.isArray(s.reminders)?s.reminders:[]).filter(r=>!linked.has(r.id)&&!legacy(r));
  (Array.isArray(s.sleepSearches)?s.sleepSearches:[]).forEach(search=>(Array.isArray(search.candidates)?search.candidates:[]).forEach(c=>{c.reminderId=null;}));
}
function seedCampingSafetyNetwork(s){
  s.sleepSearches=Array.isArray(s.sleepSearches)?s.sleepSearches:[];
  CAMPING_NETWORK_HUBS.forEach(hub=>{
    if(s.sleepSearches.some(search=>search.networkKey===hub.id))return;
    s.sleepSearches.push({id:uid(),title:hub.title,startDate:hub.startDate,endDate:hub.endDate,arrivalWindowStart:hub.arrivalWindowStart,arrivalWindowEnd:hub.arrivalWindowEnd,dateLabel:sleepDateLabelFromIso(hub.startDate,hub.endDate),region:hub.region,maxDrive:'flexibler Korridor',mode:'network',networkKey:hub.id,corridorOrder:hub.order,coverageTarget:hub.target,createdAt:new Date().toISOString(),candidates:[]});
  });
  CAMPING_NETWORK_CANDIDATES.forEach(seed=>{
    const search=s.sleepSearches.find(x=>x.networkKey===seed.hub);if(!search)return;
    const norm=value=>String(value||'').trim().toLowerCase();
    let place=(s.sleepPlaces||[]).find(p=>norm(p.name)===norm(seed.name)||(norm(seed.email)&&norm(p.email)===norm(seed.email)));
    if(!place){place={id:uid(),createdAt:new Date().toISOString()};s.sleepPlaces.push(place);}
    ['name','region','email','phone','link','officialUrl','contactFormUrl','lat','lng','notes'].forEach(k=>{if((place[k]===undefined||place[k]==='')&&seed[k]!==undefined)place[k]=seed[k];});
    if(place.contactVerified===undefined)place.contactVerified=CAMPING_NETWORK_VERIFIED.has(seed.name);
    if(!search.candidates.some(c=>c.placeId===place.id||norm(c.name)===norm(seed.name)))search.candidates.push(normalizeSleepCandidate({id:uid(),name:seed.name,region:seed.region,email:seed.email,phone:seed.phone,link:seed.link,officialUrl:seed.officialUrl,contactFormUrl:seed.contactFormUrl||'',contactVerified:place.contactVerified,lat:seed.lat,lng:seed.lng,placeId:place.id,status:'new',preferred:!!seed.preferred,requestedArrivalDate:seed.requestedArrivalDate||'',requestedDepartureDate:seed.requestedDepartureDate||'',inquiryQuestion:seed.inquiryQuestion||'',notes:seed.notes||'',nextAction:place.contactVerified?'Ein-Nacht- und Spontanregeln anfragen':'Offizielle Kontaktdaten vor Versand prüfen'}));
  });
}

function applySeasideCampingOptionsV18(s){
  // Ergänzt drei bewusst aufeinanderfolgende Küstenstopps. Der Seed ist
  // idempotent und füllt bei bereits existierenden Einträgen nur leere Felder;
  // Antworten und fachliche Status werden niemals überschrieben.
  seedCampingSafetyNetwork(s);
  const names=new Set(['Camping Roma','Camping Agay Soleil','Camping Santa Gusta']);
  const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
  CAMPING_NETWORK_CANDIDATES.filter(seed=>names.has(seed.name)).forEach(seed=>{
    const search=(s.sleepSearches||[]).find(x=>x.networkKey===seed.hub);
    const candidate=search?.candidates?.find(c=>norm(c.name)===norm(seed.name));if(!candidate)return;
    const place=(s.sleepPlaces||[]).find(p=>p.id===candidate.placeId);
    ['requestedArrivalDate','requestedDepartureDate','inquiryQuestion'].forEach(key=>{if(!candidate[key]&&seed[key])candidate[key]=seed[key];});
    if(candidate.status==='new')candidate.preferred=!!seed.preferred;
    candidate.contactVerified=true;
    if(candidate.status==='new')candidate.nextAction=seed.contactFormUrl?'Kontaktformular für die konkrete Nacht vorbereiten':'Verfügbarkeit für die konkrete Nacht anfragen';
    if(place){
      ['contactFormUrl','officialUrl','phone','lat','lng','notes'].forEach(key=>{if((place[key]===undefined||place[key]==='')&&seed[key]!==undefined)place[key]=seed[key];});
      place.contactVerified=true;
    }
  });
  s.meta=s.meta||{};s.meta.seasideCampingOptions='2026-07-17';
}
function applyScenicCoastalOptionsV19(s){
  // Ergänzt weitere landschaftlich starke Küstenoptionen, ohne Antworten,
  // Versandstatus oder manuelle Änderungen an bestehenden Einträgen anzutasten.
  seedCampingSafetyNetwork(s);
  const names=new Set(['Camping Angolo di Sogno','Camping Vallecrosia','Camping La Plage du Dramont','Camping Saint-Aygulf Plage','Camping Les Tamaris','Camping Le Mas']);
  const supersededEmail={'Camping La Plage du Dramont':'info@yellohvillage-laplagedudramont.com'};
  const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
  CAMPING_NETWORK_CANDIDATES.filter(seed=>names.has(seed.name)).forEach(seed=>{
    const search=(s.sleepSearches||[]).find(x=>x.networkKey===seed.hub);
    const candidate=search?.candidates?.find(c=>norm(c.name)===norm(seed.name));if(!candidate)return;
    const place=(s.sleepPlaces||[]).find(p=>p.id===candidate.placeId);
    if(seed.email&&norm(candidate.email)===norm(supersededEmail[seed.name]))candidate.email=seed.email;
    ['requestedArrivalDate','requestedDepartureDate','inquiryQuestion','notes'].forEach(key=>{if(!candidate[key]&&seed[key])candidate[key]=seed[key];});
    if(candidate.status==='new'){
      candidate.preferred=!!seed.preferred;
      candidate.nextAction=seed.contactFormUrl?'Offizielles Formular für die konkrete Nacht vorbereiten':'Verfügbarkeit für die konkrete Nacht anfragen';
    }
    candidate.contactVerified=true;
    if(place){
      if(seed.email&&norm(place.email)===norm(supersededEmail[seed.name]))place.email=seed.email;
      ['email','phone','contactFormUrl','officialUrl','lat','lng','notes'].forEach(key=>{if((place[key]===undefined||place[key]==='')&&seed[key]!==undefined)place[key]=seed[key];});
      place.contactVerified=true;
    }
  });
  s.meta=s.meta||{};s.meta.scenicCoastalOptions='2026-07-17';s.meta.scenicCoastalContactFix='2026-07-17';
}
function applyCampingContactVerificationV10(s){
  const oldNameByNew={'Camping Ribera del Ara':'Camping Río Ara'};
  const notes={
    'Camping Mare Monti':'Offizieller Kontakt geprüft (12.07.2026). Lage bei Riva Trigoso korrigiert; Ein-Nacht- und Spontanregeln noch erfragen.',
    'Camping La Chapelle':'Offizielle Website und Telefon geprüft (12.07.2026). Keine offizielle E-Mail veröffentlicht; nur telefonisch oder über das Kontaktformular anfragen.',
    'Camping Peña Montañesa':'Offizieller Kontakt geprüft (12.07.2026). Ein-Nacht-Transitplätze für Wohnmobile: Anreise ab 20 Uhr, Abreise bis 10 Uhr; Rezeption 08:00–22:30. Zweites Auto vorher klären.',
    'Camping Ribera del Ara':'Ersetzt den nicht verifizierbaren Eintrag „Camping Río Ara“. Offizielle Website und Telefonnummer geprüft (12.07.2026); keine offizielle E-Mail veröffentlicht.'
  };
  const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
  CAMPING_NETWORK_CANDIDATES.forEach(seed=>{
    const oldName=oldNameByNew[seed.name]||seed.name;
    const candidates=(s.sleepSearches||[]).flatMap(search=>search.candidates||[]);
    const candidate=candidates.find(c=>norm(c.name)===norm(oldName)||norm(c.name)===norm(seed.name));
    let place=(candidate?.placeId&&(s.sleepPlaces||[]).find(p=>p.id===candidate.placeId))||(s.sleepPlaces||[]).find(p=>norm(p.name)===norm(oldName)||norm(p.name)===norm(seed.name));
    if(!candidate&&!place)return;
    const contacted=!!(candidate&&(candidate.contactedAt||candidate.repliedAt||!['new',''].includes(candidate.status||'new')));
    // Der falsche Río-Ara-Datensatz wird nur umbenannt, solange er noch reine
    // Recherche ist. Etwaige spätere Korrespondenz bliebe andernfalls erhalten.
    if(oldName!==seed.name&&contacted){
      if(place)place.contactVerified=false;
      if(candidate){candidate.contactVerified=false;candidate.nextAction='Identität des Platzes manuell prüfen';}
      return;
    }
    if(!place){place={id:uid(),createdAt:new Date().toISOString()};s.sleepPlaces.push(place);if(candidate)candidate.placeId=place.id;}
    ['name','region','email','phone','link','officialUrl','lat','lng'].forEach(key=>{place[key]=seed[key];if(candidate)candidate[key]=seed[key];});
    const verified=!!seed.email&&CAMPING_NETWORK_VERIFIED.has(seed.name);
    place.contactVerified=verified;
    if(candidate){
      candidate.contactVerified=verified;
      if(candidate.status==='new')candidate.nextAction=verified?'Ein-Nacht- und Spontanregeln anfragen':(seed.email?'Offizielle Kontaktdaten vor Versand prüfen':'Telefonisch oder über Kontaktformular anfragen');
    }
    const note=notes[seed.name]||'Offizielle Website, E-Mail und Telefonnummer geprüft (12.07.2026). Ein-Nacht-, Spontan- und Zusatzauto-Regeln noch erfragen.';
    place.notes=note;
  });
  s.meta=s.meta||{};
  s.meta.campingContactVerification='2026-07-12';
}
function applyCampingFlexibleWindowsV11(s){
  CAMPING_NETWORK_HUBS.forEach(hub=>{const search=(s.sleepSearches||[]).find(x=>x.networkKey===hub.id);if(search){search.arrivalWindowStart=hub.arrivalWindowStart;search.arrivalWindowEnd=hub.arrivalWindowEnd;}});
}
function applyFrenchCritAirNetworkV12(s){
  seedCampingSafetyNetwork(s);
  const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
  CAMPING_NETWORK_HUBS.forEach(hub=>{const search=(s.sleepSearches||[]).find(x=>x.networkKey===hub.id);if(search){search.corridorOrder=hub.order;search.coverageTarget=hub.target;}});
  CAMPING_NETWORK_CANDIDATES.filter(seed=>seed.notes).forEach(seed=>{
    const search=(s.sleepSearches||[]).find(x=>x.networkKey===seed.hub),candidate=search?.candidates?.find(c=>norm(c.name)===norm(seed.name));if(!candidate)return;
    if(candidate.status==='new')candidate.preferred=!!seed.preferred;
    if(!candidate.notes)candidate.notes=seed.notes;
    const place=(s.sleepPlaces||[]).find(p=>p.id===candidate.placeId);if(place&&!place.notes)place.notes=seed.notes;
  });
  s.meta=s.meta||{};s.meta.frenchCritAirResearch='2026-07-14';
}
function applyRouteLeadAdditionsV13(s){
  // Vier neue Plätze liegen in bestehenden Routenkorridoren und werden über
  // den idempotenten Seed ergänzt. Verona gehört dagegen bewusst zur bereits
  // bestehenden Suche „Erste Nacht“ und nicht zum Ligurien-Korridor.
  seedCampingSafetyNetwork(s);
  const search=(s.sleepSearches||[]).find(x=>/erste nacht/i.test(x.title||''));
  if(search){
    const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
    CAMPING_FIRST_NIGHT_ADDITIONS_V13.forEach(seed=>{
      let place=(s.sleepPlaces||[]).find(p=>norm(p.name)===norm(seed.name)||(seed.email&&norm(p.email)===norm(seed.email)));
      if(!place){place={id:uid(),createdAt:new Date().toISOString()};s.sleepPlaces.push(place);}
      ['name','region','email','phone','link','officialUrl','lat','lng','notes'].forEach(key=>{if((place[key]===undefined||place[key]==='')&&seed[key]!==undefined)place[key]=seed[key];});
      place.contactVerified=true;
      if(!search.candidates.some(c=>c.placeId===place.id||norm(c.name)===norm(seed.name))){
        search.candidates.push(normalizeSleepCandidate({id:uid(),placeId:place.id,...seed,contactVerified:true,status:'new',nextAction:'Ein-Nacht- und Verfügbarkeitsanfrage vorbereiten'}));
      }
    });
  }
  s.meta=s.meta||{};s.meta.routeLeadResearch='2026-07-14';
}
function applyPrivateStayAdditionV16(s){
  const seed=PRIVATE_STAY_ADDITION_V16,search=(s.sleepSearches||[]).find(x=>x.networkKey===seed.hub);if(!search)return;
  const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
  let place=(s.sleepPlaces||[]).find(p=>norm(p.name)===norm(seed.name)||p.link===seed.link);
  if(!place){place={id:uid(),createdAt:new Date().toISOString()};s.sleepPlaces.push(place);}
  ['kind','name','region','link','lat','lng'].forEach(key=>{if((place[key]===undefined||place[key]==='')&&seed[key]!==undefined)place[key]=seed[key];});
  place.contactVerified=true;
  if(!search.candidates.some(c=>c.placeId===place.id||norm(c.name)===norm(seed.name))){
    search.candidates.push(normalizeSleepCandidate({
      id:uid(),placeId:place.id,...seed,contactVerified:true,status:'available',preferred:true,
      arrivalWindow:'1–2 Nächte · flexibel',
      reply:'Jakobs Schwester hat bestätigt, dass wir den Camper für ein bis zwei Nächte am Haus ihrer Verwandten abstellen können.',
      replyQuote:'Wir könnten uns dort auf jeden Fall für ein/zwei Nächte hinstellen.',
      parking:'Camper am privaten Haus möglich. Platz für den Kleinwagen und genaue Zufahrt noch abstimmen.',
      notes:'Private Option, kein öffentlicher Campingplatz. Der Kartenpunkt zeigt Les Salces; die genaue Hausposition nur intern ergänzen, sobald Jakob sie hat.',
      nextAction:'Mit Jakobs Schwester konkreten Termin, Kleinwagen und genaue Zufahrt abstimmen',repliedAt:'2026-07-15T12:00:00.000Z'
    }));
  }
  s.meta=s.meta||{};s.meta.privateStayLesSalces='2026-07-15';
}
function applyCampingReplyBatchV17(s){
  s.meta=s.meta||{};if(s.meta.campingReplyBatch20260715===3)return;
  const norm=value=>String(value||'').trim().toLocaleLowerCase('de');
  const all=(s.sleepSearches||[]).flatMap(search=>(search.candidates||[]).map(candidate=>({search,candidate})));
  const update=(name,values)=>{
    const row=all.find(({candidate})=>norm(candidate.name)===norm(name));if(!row||row.candidate.status==='booked')return;
    Object.assign(row.candidate,values);
  };
  update('Flower Camping Le Mas de Mourgues',{
    status:'available',finalPrice:'76 €',
    reply:'Für eine Nacht am 5. oder 6. August ist noch ein Stellplatz für 6 Personen und den Camper verfügbar. Reservierung direkt über die Website.',
    replyQuote:'Nous avons encore des emplacements disponibles aux dates souhaitées.',
    parking:'Kleinwagen voraussichtlich auf dem Campingparkplatz; endgültige Abstimmung bei Anreise.',
    nextAction:'Anreisetag wählen und direkt auf der Website reservieren',nextActionDate:'',
    repliedAt:'2026-07-15T08:31:00.000Z',mailThreadSubject:'RE: One-night pitch availability – arrival 5 or 6 August 2026 – Flower Camping Le Mas de Mourgues'
  });
  update('Camping La Tamarissière',{
    status:'unavailable',
    reply:'Im August gilt eine Mindestaufenthaltsdauer von drei Nächten; eine einzelne Nacht ist nicht möglich.',
    replyQuote:'Pour louer un emplacement au mois d\'aout, nous louons avec un minimum de 3 nuits et non 1 nuit.',
    nextAction:'',nextActionDate:'',repliedAt:'2026-07-15T07:39:00.000Z',mailThreadSubject:'RE: One-night pitch availability – arrival 6 or 7 August 2026 – Camping La Tamarissière'
  });
  update('Camping Le Val de Cesse',{
    status:'available',finalPrice:'ca. 90 €',
    reply:'Für eine Nacht am 6. oder 7. August ist noch ein Stellplatz für 6 Personen und den Camper verfügbar.',
    replyQuote:'We do have availability for one night on either 6 or 7 August 2026.',
    parking:'Der Kleinwagen kann auf dem Parkplatz außerhalb des Campingplatzes stehen.',
    nextAction:'Anreisetag wählen und Reservierung anfragen',nextActionDate:'',
    repliedAt:'2026-07-15T07:29:00.000Z',mailThreadSubject:'RE: One-night pitch availability – arrival 6 or 7 August 2026 – Camping Le Val de Cesse'
  });
  update('Camping Laspaúles',{
    status:'available',price:'141 €',tax:'Strom zusätzlich',offeredArrivalDate:'2026-08-09',offeredDepartureDate:'2026-08-11',
    reply:'Wegen der Mindestaufenthaltsdauer ist keine einzelne Nacht möglich. Angeboten wurden zwei Nächte vom 9. bis 11. August.',
    replyQuote:'We do have a two-night opening from August 9th to 11th.',
    pitchNote:'Stellplatz ca. 60 m²; Angebot für 6 Erwachsene und den Camper.',
    parking:'Der zusätzliche Kleinwagen ist im Angebot enthalten.',
    nextAction:'Prüfen, ob zwei Nächte passen, und bei Interesse antworten',nextActionDate:'',
    repliedAt:'2026-07-15T05:04:00.000Z',mailThreadSubject:'Re: One-night pitch availability – 9–10 August 2026 – Camping Laspaúles'
  });
  update('Camping Les Restanques',{
    status:'available',finalPrice:'66,16 €',tax:'Strom optional +5 €',
    reply:'Für eine Nacht am 4. oder 5. August ist ein Stellplatz für 6 Erwachsene, den Camper und ein Auto verfügbar. Reservierung direkt über die Website.',
    nextAction:'Anreisetag wählen und direkt auf der Website reservieren',nextActionDate:'',
    repliedAt:'2026-07-14T06:32:55.000Z'
  });
  update('Wecamp Cadaqués',{
    status:'reservable',
    reply:'Der Platz verweist für Verfügbarkeit, Preis und Buchung auf seine Website; ein konkreter Stellplatz ist noch nicht bestätigt.',
    nextAction:'Verfügbarkeit und Preis auf der Website prüfen',nextActionDate:'',
    repliedAt:'2026-07-15T06:24:39.000Z'
  });
  const reviewed=new Set(['Camping Alquézar','Camping Mare Monti','Wecamp Cadaqués','Youcamp Village Marseille Provence','Camping Les Restanques']);
  (s.mailAssistant?.reviewQueue||[]).forEach(item=>{
    const row=all.find(({candidate})=>candidate.id===item.candidateId);if(item.status==='pending'&&row&&reviewed.has(row.candidate.name)){item.status='resolved';item.resolvedAt='2026-07-15T12:00:00.000Z';item.resolvedBy='Codex';}
  });
  s.meta.campingReplyBatch20260715=3;
}
function applyKnownCampingReplyBatch(s){
  s.meta=s.meta||{}; if((s.meta.campingReplyBatch||0)>=1)return;
  const search=(s.sleepSearches||[]).find(x=>/erste nacht/i.test(x.title||''))||s.sleepSearches?.[0]; if(!search)return;
  const find=name=>search.candidates.find(c=>String(c.name||'').toLowerCase().includes(name));
  const update=(name,data)=>{const c=find(name);if(c&&c.status!=='booked')Object.assign(c,data,{repliedAt:new Date().toISOString()});return c;};
  update('piccolo',{status:'unavailable',reply:'Keine Plätze für den angefragten Zeitraum verfügbar; spontane Anrufe wurden nicht bestätigt.'});
  update('moosbauer',{status:'unavailable',reply:'Für den angefragten Zeitraum vollständig ausgebucht.'});
  update('löwenhof',{status:'unavailable',reply:'Campingplatz ausgebucht. Als separate Alternative wurde PA-LO Parking angeboten.'});
  update('al pescatore',{status:'available',email:'trentino@campingpescatore.it',reply:'Ein Stellplatz für 02.–03.08. kann reserviert werden. Zur definitiven Reservierung auf die E-Mail antworten; danach folgt eine weitere Bestätigung.',nextAction:'Reservierung per E-Mail bestätigen'});
  update('pilzone',{status:'followup',email:'campeggiopilzone@gmail.com',reply:'Keine telefonische Abstimmung; der Platz möchte alles per E-Mail klären.',nextAction:'Nur per E-Mail erneut fragen',nextActionDate:'01.–02.08.2026'});
  update('maroadi',{status:'unavailable',reply:'Keine Verfügbarkeit. In der Hochsaison außerdem keine An- oder Abreise montags; daher sehr unwahrscheinlich.'});
  update('passeier',{status:'followup',email:'info@campingpasseier.com',phone:'+39 0473 645454',reply:'Verfügbarkeit kann geprüft werden, sobald die Länge des Campers mitgeteilt wurde.',nextAction:'Camperlänge senden'});
  if(!find('pa-lo parking'))search.candidates.push(normalizeSleepCandidate({name:'PA-LO Parking Löwenhof',region:'Vahrn / Varna',email:'info@loewenhof.it',phone:'+39 0472 836216',status:'available',price:'41 € pro Nacht',parking:'Kleinwagen darf mit in den Parkbereich, diagonal innerhalb der markierten Fläche.',reply:'Offiziell angebotene Ausweichfläche 50 m vom Löwenhof. Campingplatz selbst ist voll.',nextAction:'Reservierung per E-Mail anfragen',repliedAt:new Date().toISOString()}));
  s.meta.campingReplyBatch=1;
}
function seedLegacySleepSearch(s){
  if((s.sleepSearches||[]).length) return;
  const campsite = /camping|campeggio|fornace|spiaggia|ansitz gamp|löwenhof|schlosshof|passeier/i;
  const reminders=(s.reminders||[]).filter(r=>campsite.test(r.title||'') && /2\.8\s*-\s*3\.8/i.test(r.title||''));
  const search={id:uid(),title:'Erste Nacht',dateLabel:'02.–03.08.2026',region:'Ab Innsbruck · Norditalien',maxDrive:'realistische erste Etappe',mode:'planned',createdAt:new Date().toISOString(),candidates:[]};
  reminders.forEach(r=>{
    let status=!r.done?'awaiting':(/✅/.test(r.title)?'booked':/spontan/i.test(r.title)?'call':'unavailable');
    search.candidates.push(normalizeSleepCandidate({name:cleanCampName(r.title),status,reminderId:r.id,contactedAt:r.createdAt}));
  });
  const upsert=(needle,data)=>{
    let c=search.candidates.find(x=>x.name.toLowerCase().includes(needle));
    if(!c){ c=normalizeSleepCandidate({name:data.name}); search.candidates.push(c); }
    Object.assign(c,data);
  };
  upsert('belvedere',{name:'Camping Belvedere',email:'info@campingbelvedere.it',status:'available',price:'112 € pro Stellplatz',tax:'9 € Kurtaxe',pitchNote:'Standard-Camper: ein Stellplatz; bei größerem Camper zwei benachbarte Stellplätze empfohlen.',reply:'Einige Stellplätze frei. Anreise nur mit Reservierung, kein spontanes Erscheinen.',nextAction:'Reservierung entscheiden'});
  upsert('al sole',{name:'Camping Al Sole',status:'call',phone:'+39 0464 508496',callWindow:'08:00–22:00',reply:'Anrufen ist ausdrücklich möglich, um nach kurzfristigen Stornierungen zu fragen.'});
  upsert('al lago',{name:'Camping Al Lago',status:'unavailable',reply:'Voll ausgebucht; derzeit keine Chance auf einen Stellplatz am 2. August.'});
  upsert('punta lago',{name:'Camping Punta Lago',status:'followup',reply:'Aktuell ausgebucht. Ein paar Tage vorher erneut per E-Mail nachfragen.',nextAction:'Erneut per E-Mail fragen',nextActionDate:'29.–30.07.2026'});
  upsert('schlosshof',{name:'Schlosshof Resort',status:'unavailable',reply:'Campingresort laut aktuellem Buchungsstand vollständig ausgebucht.'});
  (s.campContacts||[]).forEach(contact=>{
    let c=search.candidates.find(x=>x.name.toLowerCase().includes(contact.name.toLowerCase())||contact.name.toLowerCase().includes(x.name.toLowerCase()));
    if(!c){ c=normalizeSleepCandidate({name:contact.name}); search.candidates.push(c); }
    Object.assign(c,{region:contact.region||c.region,phone:contact.phone||c.phone,link:contact.link||c.link,status:'call',contactId:contact.id,reply:contact.note||c.reply});
  });
  if(search.candidates.length) s.sleepSearches=[search];
}

/* ---------- Laden + Migration ---------- */
function migrate(s){
  if(!s || typeof s !== 'object') s=defaultState();
  const fromVersion = Number(s.schemaVersion) || 1;
  // Firebase RTDB speichert leere Arrays/Objekte NICHT — bei einem bereits
  // benutzten State (meta.lastSaved existiert) fehlende, leerbare Container
  // als leer wiederherstellen statt mit Defaults zu befüllen.
  if(s.meta && s.meta.lastSaved){
    ['checklist','returnStages','spots','festival','log','reminders','polls','campContacts','sleepPlaces','sleepSearches'].forEach(k=>{ if(s[k] === undefined) s[k] = []; });
    if(s.budget === undefined) s.budget = {expenses:[]};
  }
  // Fehlende Top-Level-Schlüssel defensiv aus dem Standard ergänzen
  const def = defaultState();
  for(const k of Object.keys(def)){
    if(s[k] === undefined) s[k] = def[k];
  }
  // Eine leere Routenliste ist kein nutzbarer Zustand: mehrere Ansichten
  // erwarten stets eine ausgewählte Route. Kaputte/zu stark gekürzte Backups
  // werden deshalb auf die editierbaren Standardrouten zurückgeführt.
  if(!Array.isArray(s.routes)||!s.routes.length){s.routes=JSON.parse(JSON.stringify(def.routes));s.selectedRoute=def.selectedRoute;}
  s.trip=Object.assign({},def.trip,s.trip&&typeof s.trip==='object'?s.trip:{});
  ['id','title','subtitle','startDate','endDate','homeBase'].forEach(k=>s.trip[k]=String(s.trip[k]||def.trip[k]||''));
  if(fromVersion<15&&s.trip.title.trim().toLowerCase()==='sizigia 2026')s.trip.title='Roadtrip';
  if(fromVersion<15&&/münchen\s*→\s*huesca/i.test(s.trip.subtitle))s.trip.subtitle='Gemeinsam unterwegs';
  s.archive=s.archive&&typeof s.archive==='object'?s.archive:{campingReminders:[]};
  s.archive.campingReminders=Array.isArray(s.archive.campingReminders)?s.archive.campingReminders:[];
  // Verschachtelte Pflicht-Arrays normalisieren (ebenfalls Firebase-Schutz)
  (s.routes||[]).forEach(r=>{ r.stages = r.stages || []; r.custom = !!r.custom; r.stages.forEach(normalizeStageFields); });
  (s.returnStages||[]).forEach(normalizeStageFields);
  if(!s.routes.find(r=>r.id===s.selectedRoute)) s.selectedRoute = s.routes[0]?.id || def.selectedRoute;
  (s.spots||[]).forEach(sp=>{ sp.votes = sp.votes || []; });
  (s.vehicles||[]).forEach(v=>{ v.drivers=v.drivers||[]; v.passengers=v.passengers||[]; v.docs=v.docs||[]; ['model','lengthM','widthM','heightM','registration'].forEach(k=>{if(v[k]===undefined)v[k]='';}); });
  (s.packing||[]).forEach(c=>{ c.items = c.items || []; });
  (s.shopping||[]).forEach(c=>{ c.items = c.items || []; });
  allListItems(s).forEach(normalizeListItem);
  s.budget.expenses = s.budget.expenses || [];
  s.budget.expenses.forEach(e=>{ e.sharers = e.sharers || []; });
  s.reminders = (s.reminders || []).map(r=>{
    const done=!!r.done||r.status==='done',allowed=['open','waiting','decision','done'],status=done?'done':(allowed.includes(r.status)?r.status:'open');
    return {
      id:r.id || uid(), title:String(r.title || ''), done, status,
      previousStatus:['open','waiting','decision'].includes(r.previousStatus)?r.previousStatus:undefined,
      priority:!!r.priority, ownerId:s.crew.some(c=>c.id===r.ownerId)?r.ownerId:null,
      dueDate:/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate||'')?r.dueDate:'', note:String(r.note||''),
      createdAt:r.createdAt || new Date().toISOString(), createdBy:r.createdBy || null,
      link:r.link && r.link.type==='listItem' ? {type:'listItem', ref:r.link.ref, itemId:r.link.itemId} : undefined
    };
  }).filter(r=>r.title);
  // V3 übernimmt die bisherige sichtbare Reihenfolge einmalig als persistierte
  // Ausgangsreihenfolge; danach bestimmen ausschließlich die Pfeil-Buttons.
  if(fromVersion < 3) s.reminders.sort((a,b)=>(a.done===b.done ? new Date(b.createdAt)-new Date(a.createdAt) : (a.done?1:-1)));
  s.polls = (s.polls || []).map(p=>({
    id:p.id || uid(),
    question:String(p.question || ''),
    options:Array.isArray(p.options) ? p.options.map(o=>({id:o.id || uid(), text:String(o.text || '')})).filter(o=>o.text) : [],
    votes:p.votes && typeof p.votes==='object' ? p.votes : {},
    closed:!!p.closed,
    createdAt:p.createdAt || new Date().toISOString(),
    createdBy:p.createdBy || null
  })).filter(p=>p.question && p.options.length);
  s.polls.forEach(p=>{
    const optionIds = new Set(p.options.map(o=>o.id));
    Object.keys(p.votes).forEach(cid=>{
      p.votes[cid] = Array.isArray(p.votes[cid]) ? p.votes[cid].filter(id=>optionIds.has(id)) : [];
    });
  });
  if(fromVersion < 4) seedLegacySleepSearch(s);
  s.sleepSearches = (s.sleepSearches||[]).map(x=>{const inferred=inferSleepDates(x.dateLabel);return Object.assign({id:uid(),title:'Schlafplatz-Suche',dateLabel:'',startDate:'',endDate:'',arrivalWindowStart:'',arrivalWindowEnd:'',region:'',maxDrive:'',mode:'planned',createdAt:new Date().toISOString()},x,{startDate:x.startDate||inferred.startDate,endDate:x.endDate||inferred.endDate,candidates:(x.candidates||[]).map(normalizeSleepCandidate)});});
  migrateSleepPlaces(s);
  applyKnownCampingReplyBatch(s);
  migrateSleepPlaces(s);
  mergeLegacyCampContacts(s);
  if(fromVersion<9)archiveCampingReminders(s);
  if(fromVersion<9||!s.meta.campingNetworkSeeded){seedCampingSafetyNetwork(s);s.meta.campingNetworkSeeded=true;}
  if(fromVersion<10)applyCampingContactVerificationV10(s);
  if(fromVersion<11)applyCampingFlexibleWindowsV11(s);
  if(fromVersion<12)applyFrenchCritAirNetworkV12(s);
  if(fromVersion<13)applyRouteLeadAdditionsV13(s);
  if(fromVersion<16||!s.meta.privateStayLesSalces)applyPrivateStayAdditionV16(s);
  if(fromVersion<17||s.meta.campingReplyBatch20260715!==3)applyCampingReplyBatchV17(s);
  if(fromVersion<18||!s.meta.seasideCampingOptions)applySeasideCampingOptionsV18(s);
  if(fromVersion<19||!s.meta.scenicCoastalOptions||!s.meta.scenicCoastalContactFix)applyScenicCoastalOptionsV19(s);
  s.mailAssistant=Object.assign({processedMessageIds:[],draftRequests:[],reviewQueue:[],runnerMode:'local',mailProvider:'icloud',runners:{},lease:null,lastSuccessAt:null,lastRunAt:null,lastError:'',nextRunAt:null},s.mailAssistant||{});
  s.mailAssistant.processedMessageIds=Array.isArray(s.mailAssistant.processedMessageIds)?s.mailAssistant.processedMessageIds.slice(-200):[];
  s.mailAssistant.draftRequests=Array.isArray(s.mailAssistant.draftRequests)?s.mailAssistant.draftRequests:[];
  s.mailAssistant.reviewQueue=Array.isArray(s.mailAssistant.reviewQueue)?s.mailAssistant.reviewQueue.slice(-50):[];
  s.mailAssistant.runnerMode=['local','shadow','cloud'].includes(s.mailAssistant.runnerMode)?s.mailAssistant.runnerMode:'local';
  const legacyRunner={lastSuccessAt:s.mailAssistant.lastSuccessAt||null,lastRunAt:s.mailAssistant.lastRunAt||null,lastError:s.mailAssistant.lastError||'',nextRunAt:s.mailAssistant.nextRunAt||null};
  s.mailAssistant.runners={local:Object.assign({},legacyRunner,s.mailAssistant.runners?.local||{}),cloud:Object.assign({lastSuccessAt:null,lastRunAt:null,lastError:'',nextRunAt:null},s.mailAssistant.runners?.cloud||{})};
  // V6 setzte beim bloßen Anfordern eines Entwurfs fälschlich den fachlichen
  // Status um. Entwurfszustand und Reservierungszustand sind nun unabhängig.
  (s.sleepSearches||[]).forEach(search=>(search.candidates||[]).forEach(c=>{if(c.status!=='draft_requested')return;const req=[...s.mailAssistant.draftRequests].reverse().find(x=>x.candidateId===c.id);c.status=req?.previousStatus||'awaiting';c.draftState=req?.status||c.draftState||'none';}));
  if(Array.isArray(s.log)){
    while(s.log.length > LOG_MAX) s.log.shift();
    let keep = UNDO_MAX;
    for(let i=s.log.length-1; i>=0; i--){
      if(!s.log[i].undo) continue;
      if(keep>0) keep--;
      else s.log[i].undo = null;
    }
  }
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}
const _bootRaw = StorageAdapter.load();
let state = migrate(_bootRaw);
// Frisches Gerät (noch nie lokal gespeichert): beim ersten Sync gewinnt IMMER
// der Gruppen-Stand aus der Cloud — sonst würde der frische Default-State
// wegen des neueren Zeitstempels die Gruppendaten überschreiben.
let _virgin = !_bootRaw;
const LOCAL_ONLY_KEY = STORAGE_KEY + '-local-only';
let _localOnlyRestore = false;
try{ _localOnlyRestore = localStorage.getItem(LOCAL_ONLY_KEY) === '1'; }catch(e){}

/* --- Automatische Sicherungen (Snapshots) ---
   Rollierend max. 5 Stände in localStorage: 1× täglich vor der ersten
   Änderung des Tages sowie vor Import/Wiederherstellung. */
const SNAP_KEY = STORAGE_KEY + '-snapshots';
function getSnapshots(){
  try{ return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); }catch(e){ return []; }
}
function takeSnapshot(reason){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const snaps = getSnapshots();
    snaps.push({ts:new Date().toISOString(), reason, raw});
    while(snaps.length>5) snaps.shift();
    localStorage.setItem(SNAP_KEY, JSON.stringify(snaps));
  }catch(e){ console.warn('Snapshot fehlgeschlagen', e); }
}
function enterLocalOnlyMode(){
  if(!CLOUD_URL) return;
  _localOnlyRestore = true;
  try{ localStorage.setItem(LOCAL_ONLY_KEY, '1'); }catch(e){}
  clearTimeout(_syncTimer);
  setSyncStatus('localOnly');
}
function leaveLocalOnlyMode(){
  _localOnlyRestore = false;
  try{ localStorage.removeItem(LOCAL_ONLY_KEY); }catch(e){}
}
function openBackupLocal(data, snapshotReason, logDesc, toastMsg){
  takeSnapshot(snapshotReason);
  state = migrate(data);
  if(CLOUD_URL) enterLocalOnlyMode();
  logChange(logDesc, null);
  StorageAdapter.save(state);
  renderAll();
  updateSaveInfo(true);
  setSyncStatus(CLOUD_URL ? 'localOnly' : 'ok');
  toast(toastMsg, CLOUD_URL ? 'Gruppenstand laden' : null, CLOUD_URL ? loadGroupState : null);
}
function restoreSnapshot(idx){
  const snaps = getSnapshots();
  const s = snaps[idx];
  if(!s) return;
  const when = new Date(s.ts).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  const msg = CLOUD_URL
    ? 'Sicherung vom ' + when + ' Uhr nur auf diesem Gerät öffnen? Der Gruppenstand bleibt unverändert und der Sync wird hier pausiert, bis du den Gruppenstand wieder lädst.'
    : 'Sicherung vom ' + when + ' Uhr wiederherstellen? Der aktuelle Stand wird vorher gesichert.';
  if(!confirm(msg)) return;
  openBackupLocal(
    JSON.parse(s.raw),
    'Vor Wiederherstellung',
    'hat eine Sicherung lokal geöffnet (' + s.reason + ')',
    CLOUD_URL ? 'Sicherung lokal geöffnet — Gruppe bleibt unverändert' : 'Sicherung wiederhergestellt'
  );
}

/* --- Rückgängig (eine Stufe) für Lösch-Aktionen --- */
let _undoJson = null;
function withUndo(msg, fn){
  _undoJson = JSON.stringify(state);
  fn(); save(); renderAll();
  toast(msg, 'Rückgängig', ()=>{
    state = migrate(JSON.parse(_undoJson));
    _undoJson = null;
    save(); renderAll();
    toast('Wiederhergestellt ↩');
  });
}

function save(){
  // Tagessicherung: 1× pro Tag den Stand VOR der ersten Änderung aufheben
  const snaps = getSnapshots(), today = new Date().toDateString();
  if(!snaps.some(s=>new Date(s.ts).toDateString()===today)) takeSnapshot('Tagessicherung');
  // Monoton steigender Zeitstempel: schützt Last-write-wins vor Uhren-
  // Schiefstand zwischen Geräten (lokale Änderung basiert immer auf dem
  // aktuellen Stand und muss ihn daher überstimmen)
  const prev = state.meta.lastSaved;
  let ts = new Date().toISOString();
  if(prev && ts <= prev) ts = new Date(new Date(prev).getTime() + 1000).toISOString();
  state.meta.lastSaved = ts;
  const dot = document.getElementById('saveDot');
  dot.classList.add('saving');
  const ok = StorageAdapter.save(state);
  setTimeout(()=>dot.classList.remove('saving'), 300);
  updateSaveInfo(ok);
  scheduleSync();
}
function updateSaveInfo(ok=true){
  const el = document.getElementById('saveInfo');
  if(!state.meta.lastSaved){ el.textContent = 'Noch nichts gespeichert'; return; }
  const d = new Date(state.meta.lastSaved);
  let txt = (ok===false ? 'Speichern fehlgeschlagen · ' : '') +
    'Gespeichert ' + d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) + ' · ' +
    d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  const le = state.meta.lastExport;
  if(!le) txt += ' · kein Backup';
  else{
    const days = Math.floor((Date.now() - new Date(le)) / 86400000);
    if(days >= 7) txt += ' · Backup ' + days + ' Tage alt';
  }
  el.textContent = txt;
}
function toggleCloudDetails(){
  const panel = document.getElementById('cloudDetails');
  const btn = document.getElementById('cloudStatus');
  if(!panel || !btn) return;
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}
function closeCloudDetails(){
  const panel = document.getElementById('cloudDetails');
  const btn = document.getElementById('cloudStatus');
  if(!panel || !btn || panel.hidden) return;
  panel.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e=>{
  const wrap = document.querySelector('.cloud-wrap');
  if(wrap && !wrap.contains(e.target)) closeCloudDetails();
});

/* ============================================================
   CLOUD-SYNC-ENGINE
   Local-first: localStorage bleibt Quelle für sofortiges Rendern,
   die Cloud hält alle Geräte auf demselben Stand.
   - Konflikte: Last-write-wins über meta.lastSaved (ISO-Vergleich).
     Vor Übernahme eines fremden Standes werden ungepushte lokale
     Änderungen als Snapshot gesichert.
   - Offline: fetch schlägt fehl → Status „offline", lokal geht alles
     weiter; erneuter Versuch per Intervall/online-Event.
   ============================================================ */
let _syncTimer = null, _syncing = false, _lastPushed = null;
function setSyncStatus(s){
  const el = document.getElementById('syncBadge');
  const cloud = document.getElementById('cloudStatus');
  if(!el) return;
  if(!CLOUD_URL){
    el.textContent = 'Nur lokal';
    if(cloud) cloud.dataset.status = 'localOnly';
    return;
  }
  const map = {
    syncing:['Sync läuft','var(--sun)'],
    ok:['Synchron','var(--mint)'],
    offline:['Offline · lokal','var(--danger)'],
    localOnly:['Lokale Sicherung','var(--sun-deep)'],
  };
  const m = map[s] || ['',''];
  el.textContent = m[0];
  el.style.color = m[1];
  if(cloud){
    cloud.dataset.status = s || 'ok';
    cloud.title = m[0] || 'Cloud-Sync Status';
  }
  el.style.cursor = s === 'localOnly' ? 'pointer' : '';
  el.title = s === 'localOnly' ? 'Gruppenstand wieder laden' : '';
  el.onclick = s === 'localOnly' ? loadGroupState : null;
}
async function cloudGet(){
  const r = await fetch(CLOUD_URL, {headers:{'X-Firebase-ETag':'true'},cache:'no-store'});
  if(!r.ok) throw new Error('HTTP ' + r.status);
  return {remote:await r.json(),etag:r.headers.get('etag')};
}
async function cloudPut(etag){
  const r = await fetch(CLOUD_URL, {method:'PUT', headers:{'Content-Type':'application/json','if-match':etag}, body:JSON.stringify(state)});
  if(r.status===412)return false;
  if(!r.ok) throw new Error('HTTP ' + r.status);
  _lastPushed = state.meta.lastSaved;
  return true;
}
async function loadGroupState(){
  if(!CLOUD_URL || _syncing) return;
  _syncing = true;
  setSyncStatus('syncing');
  try{
    const {remote}=await cloudGet();
    if(remote){
      state = migrate(remote);
      StorageAdapter.save(state);
      _lastPushed = state.meta.lastSaved;
      leaveLocalOnlyMode();
      renderAll();
      toast('Gruppenstand geladen');
    } else {
      leaveLocalOnlyMode();
    }
    _virgin = false;
    setSyncStatus('ok');
  }catch(e){
    setSyncStatus('offline');
  }
  _syncing = false;
}
async function syncNow(){
  if(_localOnlyRestore){ setSyncStatus('localOnly'); return; }
  if(!CLOUD_URL || _syncing) return;
  _syncing = true;
  setSyncStatus('syncing');
  try{
    let synced=false;
    for(let attempt=0;attempt<3;attempt++){
      const {remote,etag}=await cloudGet(); // null bei leerer Datenbank
      const rT = (remote && remote.meta && remote.meta.lastSaved) || '';
      const lT = state.meta.lastSaved || '';
      if(_virgin && remote){
        // Neues Gerät tritt der Gruppe bei: Cloud-Stand übernehmen, Zeitstempel egal.
        // Falls vor dem ersten Sync offline editiert wurde, bleibt der lokale Stand auffindbar.
        if(lT)takeSnapshot('Vor Cloud-Übernahme');
        state = migrate(remote);
        StorageAdapter.save(state);
        _lastPushed = state.meta.lastSaved;
        renderAll();
      } else if(rT && rT > lT){
        if(lT && _lastPushed !== lT) takeSnapshot('Vor Cloud-Übernahme');
        state = migrate(remote);
        StorageAdapter.save(state);
        _lastPushed = state.meta.lastSaved;
        renderAll();
        toast('Neuer Stand aus der Gruppe übernommen');
      } else if(lT && lT > rT){
        if(!await cloudPut(etag))continue;
      } else {
        _lastPushed = lT;
      }
      synced=true;
      break;
    }
    if(!synced)throw new Error('Cloud-Konflikt nach 3 Versuchen');
    _virgin = false;
    setSyncStatus('ok');
  }catch(e){
    setSyncStatus('offline');
  }
  _syncing = false;
}
function scheduleSync(){
  if(!CLOUD_URL) return;
  if(_localOnlyRestore){ setSyncStatus('localOnly'); return; }
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(syncNow, 1200);
}

/* ---------- Export / Import ---------- */
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roadtrip-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  state.meta.lastExport = new Date().toISOString();
  save();
  toast('Backup exportiert — z. B. in die WhatsApp-Gruppe schicken 📤');
}
function importData(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data || typeof data !== 'object' || !data.crew || !data.routes) throw new Error('Kein gültiges Roadtrip-Backup');
      const msg = CLOUD_URL
        ? 'Backup nur auf diesem Gerät öffnen? Der Gruppenstand bleibt unverändert und der Sync wird hier pausiert, bis du den Gruppenstand wieder lädst.'
        : 'Backup importieren? Die aktuellen Daten auf diesem Gerät werden überschrieben (eine Sicherung wird vorher angelegt).';
      if(!confirm(msg)) return;
      openBackupLocal(
        data,
        'Vor Import',
        'hat ein Backup lokal geöffnet',
        CLOUD_URL ? 'Backup lokal geöffnet — Gruppe bleibt unverändert' : 'Backup importiert'
      );
    }catch(e){
      alert('Import fehlgeschlagen: ' + e.message);
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
}

/* ---------- Helfer ---------- */
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ============================================================
   IDENTITÄT & VERLAUF (Changelog)
   - whoami: Crew-Mitglied dieses Geräts (nur lokal gespeichert).
   - state.log: geteiltes Protokoll aller Änderungen (max. 150),
     jede Aktion mit Umkehr-Daten (undo) für Schritt-Rückgängig.
   ============================================================ */
const WHO_KEY = STORAGE_KEY + '-whoami';
function whoami(){ return localStorage.getItem(WHO_KEY) || null; }
function setWhoami(id){ localStorage.setItem(WHO_KEY, id); renderAll(); toast('Profil gewählt: ' + (crewById(id)?.name || '')); }
function askWho(){
  openModal('Wer bist du?', [
    {key:'who', label:'Damit der Verlauf weiß, wer was ändert (nur auf diesem Gerät gespeichert)', type:'select',
     value:whoami() || state.crew[0].id, options:state.crew.map(c=>({value:c.id, label:c.name}))}
  ], v=>{
    localStorage.setItem(WHO_KEY, v.who);
    toast('Profil gewählt: ' + (crewById(v.who)?.name || ''));
  }, null, {skipSave:true});
}
function logChange(desc, undo=null, who=whoami()){
  if(!Array.isArray(state.log)) state.log = [];
  state.log.push({id:uid(), ts:new Date().toISOString(), who, desc, undo});
  pruneLog();
}
function pruneLog(){
  if(!Array.isArray(state.log)) state.log = [];
  while(state.log.length > LOG_MAX) state.log.shift();
  let keep = UNDO_MAX;
  for(let i=state.log.length-1; i>=0; i--){
    if(!state.log[i].undo) continue;
    if(keep>0) keep--;
    else state.log[i].undo = null;
  }
}
function refLabel(ref){
  if(ref==='checklist') return 'Checkliste';
  const [kind, id] = ref.split(':');
  if(kind==='vdoc') return state.vehicles.find(v=>v.id===id)?.name || 'Fahrzeug';
  if(kind==='pack') return 'Packliste · ' + (state.packing.find(c=>c.id===id)?.name || '?');
  if(kind==='shop') return 'Einkauf · ' + (state.shopping.find(c=>c.id===id)?.name || '?');
  return ref;
}
// Inverse Operation eines Log-Eintrags anwenden; wirft, wenn das Ziel weg ist
function applyRevert(u){
  const need = x => { if(!x) throw new Error('Ziel existiert nicht mehr'); return x; };
  switch(u.t){
    case 'toggle':   need(resolveList(u.ref)?.find(i=>i.id===u.id)).done = u.prev; break;
    case 'personDone': { const it=need(resolveList(u.ref)?.find(i=>i.id===u.id)); it.doneBy = u.prevDoneBy || []; it.done = !!u.prevDone; break; }
    case 'itemAdd':  { const l=need(resolveList(u.ref)); const i=l.findIndex(x=>x.id===u.id); if(i<0) throw 0; l.splice(i,1); break; }
    case 'itemAddMulti': { const l=need(resolveList(u.ref)); u.ids.forEach(id=>{ const i=l.findIndex(x=>x.id===id); if(i>=0) l.splice(i,1); }); break; }
    case 'itemDel':  { const l=need(resolveList(u.ref)); l.splice(Math.min(u.idx,l.length),0,u.item); if(u.reminder) state.reminders.splice(Math.min(u.reminderIdx ?? state.reminders.length,state.reminders.length),0,u.reminder); break; }
    case 'itemEdit': Object.assign(need(resolveList(u.ref)?.find(i=>i.id===u.id)), u.prev); break;
    case 'remAdd':   { const i=state.reminders.findIndex(r=>r.id===u.id); if(i<0) throw 0; state.reminders.splice(i,1); break; }
    case 'remDel':   state.reminders.splice(Math.min(u.idx,state.reminders.length),0,u.reminder); break;
    case 'remEdit':  Object.assign(need(state.reminders.find(r=>r.id===u.id)), u.prev); break;
    case 'remToggle': { const r=need(state.reminders.find(r=>r.id===u.id)),done=u.prevDone!==undefined?u.prevDone:!!u.prev;r.done=done;r.status=u.prevStatus||(done?'done':'open');if(u.prevPreviousStatus)r.previousStatus=u.prevPreviousStatus;else delete r.previousStatus;break; }
    case 'remMove': { const a=state.reminders.findIndex(r=>r.id===u.id), b=state.reminders.findIndex(r=>r.id===u.otherId); if(a<0||b<0) throw 0; [state.reminders[a],state.reminders[b]]=[state.reminders[b],state.reminders[a]]; break; }
    case 'pollAdd':  { const i=state.polls.findIndex(p=>p.id===u.id); if(i<0) throw 0; state.polls.splice(i,1); break; }
    case 'pollDel':  state.polls.splice(Math.min(u.idx,state.polls.length),0,u.poll); break;
    case 'pollEdit': Object.assign(need(state.polls.find(p=>p.id===u.id)), u.prev); break;
    case 'pollVote': need(state.polls.find(p=>p.id===u.id)).votes = u.prev; break;
    case 'pollClose': need(state.polls.find(p=>p.id===u.id)).closed = u.prev; break;
    case 'campAdd':  { const i=state.campContacts.findIndex(c=>c.id===u.id); if(i<0) throw 0; state.campContacts.splice(i,1); break; }
    case 'campDel':  state.campContacts.splice(Math.min(u.idx,state.campContacts.length),0,u.contact); break;
    case 'campEdit': Object.assign(need(state.campContacts.find(c=>c.id===u.id)), u.prev); break;
    case 'sleepState': state.sleepSearches=u.sleepSearches; state.sleepPlaces=u.sleepPlaces||[]; state.mailAssistant=u.mailAssistant||state.mailAssistant; state.reminders=u.reminders; state.campContacts=u.campContacts; break;
    case 'stageAdd': { const l=getStageList(u.ref); const i=l.findIndex(x=>x.id===u.id); if(i<0) throw 0; l.splice(i,1); break; }
    case 'stageDel': { const l=getStageList(u.ref); l.splice(Math.min(u.idx,l.length),0,u.stage);
      if(u.followFix){ const f=l.find(x=>x.id===u.followFix.id); if(f){ f.from=u.followFix.prevFrom; f.km=u.followFix.prevKm; f.time=u.followFix.prevTime;
        if(u.followFix.prevEst) f.est=u.followFix.prevEst; else delete f.est;
        if(u.followFix.prevFromLat!=null){ f.fromLat=u.followFix.prevFromLat; f.fromLng=u.followFix.prevFromLng; } else { delete f.fromLat; delete f.fromLng; } } } break; }
    case 'stageEdit':{ const s=need(getStageList(u.ref).find(x=>x.id===u.id));
      ['date','from','to','km','time','stay','note','link'].forEach(k=>s[k]=u.prev[k]);
      if(u.prev.est) s.est=u.prev.est; else delete s.est;
      if(u.prev.lat!=null){ s.lat=u.prev.lat; s.lng=u.prev.lng; } else { delete s.lat; delete s.lng; }
      if(u.prev.fromLat!=null){ s.fromLat=u.prev.fromLat; s.fromLng=u.prev.fromLng; } else { delete s.fromLat; delete s.fromLng; } break; }
    case 'stageMove':{ const l=getStageList(u.ref); if(u.from<0||u.from>=l.length) throw 0; const [s]=l.splice(u.from,1); l.splice(u.to,0,s); break; }
    case 'stageListRestore': { const l=getStageList(u.ref); l.length=0; u.list.forEach(x=>l.push(x)); break; }
    case 'datesShift': { const l=need(getStageList(u.ref)); u.prevDates.forEach(p=>{ const s=l.find(x=>x.id===p.id); if(s) s.date=p.date; }); break; }
    case 'stageInsert': { const l=getStageList(u.ref); const i=l.findIndex(x=>x.id===u.id); if(i<0) throw 0; l.splice(i,1);
      if(u.followFix){ const f=l.find(x=>x.id===u.followFix.id); if(f){ f.from=u.followFix.prevFrom; f.km=u.followFix.prevKm; f.time=u.followFix.prevTime;
        if(u.followFix.prevEst) f.est=u.followFix.prevEst; else delete f.est; } } break; }
    case 'routeAdd':  { const i=state.routes.findIndex(r=>r.id===u.id); if(i<0) throw 0; state.routes.splice(i,1); state.selectedRoute = u.prevSelected || state.routes[0]?.id; break; }
    case 'routeDel':  state.routes.splice(Math.min(u.idx,state.routes.length),0,u.route); state.selectedRoute = u.prevSelected || u.route.id; break;
    case 'routeEdit': Object.assign(need(state.routes.find(r=>r.id===u.id)), u.prev); break;
    case 'routeSel': state.selectedRoute = u.prev; break;
    case 'vote':     { const sp=need(state.spots.find(s=>s.id===u.spotId)); const i=sp.votes.indexOf(u.crewId);
      if(u.prev && i<0) sp.votes.push(u.crewId); if(!u.prev && i>=0) sp.votes.splice(i,1); break; }
    case 'voteSingle': {
      if(u.newSpotId) need(state.spots.find(s=>s.id===u.newSpotId));
      if(u.prevSpotId) need(state.spots.find(s=>s.id===u.prevSpotId));
      if(u.newSpotId){ const sp=state.spots.find(s=>s.id===u.newSpotId); const i=sp.votes.indexOf(u.crewId); if(i>=0) sp.votes.splice(i,1); }
      if(u.prevSpotId){ const sp=state.spots.find(s=>s.id===u.prevSpotId); if(!sp.votes.includes(u.crewId)) sp.votes.push(u.crewId); }
      break; }
    case 'spotAdd':  { const i=state.spots.findIndex(s=>s.id===u.id); if(i<0) throw 0; state.spots.splice(i,1); break; }
    case 'spotDel':  state.spots.splice(Math.min(u.idx,state.spots.length),0,u.spot); break;
    case 'spotEdit': { const sp=need(state.spots.find(s=>s.id===u.id));
      ['name','region','type','detour','desc','link'].forEach(k=>sp[k]=u.prev[k]);
      if(u.prev.lat!=null){ sp.lat=u.prev.lat; sp.lng=u.prev.lng; } else { delete sp.lat; delete sp.lng; } break; }
    case 'driver':   { const v=need(state.vehicles.find(x=>x.id===u.vid)); const i=v.drivers.indexOf(u.cid);
      if(u.prev && i<0) v.drivers.push(u.cid); if(!u.prev && i>=0) v.drivers.splice(i,1); break; }
    case 'pass':     { state.vehicles.forEach(v=>{ const i=v.passengers.indexOf(u.cid); if(i>=0) v.passengers.splice(i,1); });
      if(u.prevVid){ need(state.vehicles.find(x=>x.id===u.prevVid)).passengers.push(u.cid); } break; }
    case 'vehEdit':  Object.assign(need(state.vehicles.find(x=>x.id===u.vid)), u.prev); break;
    case 'expAdd':   { const i=state.budget.expenses.findIndex(e=>e.id===u.id); if(i<0) throw 0; state.budget.expenses.splice(i,1); break; }
    case 'expDel':   state.budget.expenses.push(u.expense); break;
    case 'crewEdit': need(crewById(u.cid)).name = u.prev; break;
    case 'festAdd':  { const i=state.festival.findIndex(f=>f.id===u.id); if(i<0) throw 0; state.festival.splice(i,1); break; }
    case 'festDel':  state.festival.splice(Math.min(u.idx,state.festival.length),0,u.f); break;
    case 'festEdit': Object.assign(need(state.festival.find(f=>f.id===u.id)), u.prev); break;
    case 'catAdd':   { const t=u.kind==='pack'?state.packing:state.shopping; const i=t.findIndex(c=>c.id===u.id); if(i<0) throw 0; t.splice(i,1); break; }
    default: throw new Error('unbekannter Typ');
  }
}
function revertEntry(id){
  const e = (state.log||[]).find(x=>x.id===id);
  if(!e || !e.undo || e.undone) return;
  const backup = JSON.stringify(state);
  try{ applyRevert(e.undo); }
  catch(err){
    state = migrate(JSON.parse(backup));
    toast('Nicht mehr möglich — der betroffene Eintrag existiert nicht mehr');
    return;
  }
  e.undone = true;
  logChange('hat rückgängig gemacht: ' + e.desc, null);
  save(); renderAll();
  toast('Schritt rückgängig gemacht ↩', 'Doch nicht', ()=>{
    state = migrate(JSON.parse(backup));
    save(); renderAll();
  });
}
function crewById(id){ return state.crew.find(c=>c.id===id); }
function euro(n){ return n.toLocaleString('de-DE',{style:'currency',currency:'EUR'}); }
let _toastAction = null;
function toast(msg, actionLabel, actionFn){
  const t = document.getElementById('toast');
  t.innerHTML = esc(msg) + (actionLabel ? '<button onclick="runToastAction()">'+esc(actionLabel)+'</button>' : '');
  t.classList.toggle('actionable', !!actionLabel);
  _toastAction = actionFn || null;
  t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), actionLabel ? 6000 : 2600);
}
function runToastAction(){
  if(_toastAction){ _toastAction(); _toastAction = null; }
  document.getElementById('toast').classList.remove('show');
}
function mapsLink(stage){
  if(stage.link) return stage.link;
  if(stage.from && stage.to) return 'https://www.google.com/maps/dir/' + encodeURIComponent(stage.from) + '/' + encodeURIComponent(stage.to);
  return null;
}

/* ============================================================
   KARTE — echte Europakarte als eingebettetes WebP (Natural Earth,
   public domain — Terrain + Landesgrenzen ins Bild gebacken),
   komplett offline, keine Tiles/CDNs. Equirektangulare Projektion
   fest über die Bildgrenzen. Beschriftungen, Marker und Routen sind
   SVG-Overlays, die beim Zoomen gegenskaliert werden (konstante
   Bildschirmgröße). Pan/Zoom: ziehen / Pinch / Mausrad / +−-Buttons.
   Positionen: gespeichertes lat/lng am Objekt, sonst automatische
   Erkennung über das GEO-Ortslexikon (Textabgleich, letzter Treffer
   im String gewinnt = Zielort).
   ============================================================ */
/* MAP_IMG is loaded from map-data.js before this file. */
// Geografische Grenzen des Kartenbilds; W/H = viewBox-Einheiten (1° = 20 Einheiten)
const MAP = {lonMin:-12, lonMax:45, latMin:33, latMax:63, W:1140, H:600};
MAP.kx = MAP.W/(MAP.lonMax-MAP.lonMin); MAP.ky = MAP.H/(MAP.latMax-MAP.latMin);
function project(lat,lng){ return {x:(lng-MAP.lonMin)*MAP.kx, y:(MAP.latMax-lat)*MAP.ky}; }
function unproject(x,y){ return {lat:MAP.latMax-y/MAP.ky, lng:MAP.lonMin+x/MAP.kx}; }

const GEO = {
  'münchen':[48.14,11.57],'innsbruck':[47.27,11.39],'gardasee':[45.88,10.85],'riva':[45.885,10.84],
  'sestri':[44.27,9.40],'finale ligure':[44.17,8.34],'genua':[44.41,8.93],'cinque terre':[44.13,9.71],'levanto':[44.17,9.61],
  'côte d’azur':[43.50,6.85],"côte d'azur":[43.50,6.85],'fréjus':[43.43,6.74],'estérel':[43.45,6.90],'nizza':[43.70,7.27],
  'cassis':[43.21,5.54],'calanque':[43.20,5.45],'marseille':[43.30,5.37],'toulon':[43.12,5.93],
  'sète':[43.40,3.70],'montpellier':[43.61,3.88],'camargue':[43.52,4.42],
  'cadaqués':[42.29,3.28],'cap de creus':[42.32,3.32],'begur':[41.95,3.21],'costa brava':[41.97,3.17],
  'huesca':[42.14,-0.41],'zaragoza':[41.65,-0.88],'barcelona':[41.39,2.17],
  'maggiore':[45.92,8.55],'comer see':[46.02,9.26],'annecy':[45.90,6.13],
  'ardèche':[44.40,4.39],'vallon':[44.40,4.39],'carcassonne':[43.21,2.35],
  'aínsa':[42.42,0.14],'ordesa':[42.65,-0.06],'verdon':[43.76,6.26],'sainte-croix':[43.76,6.20],
  'collioure':[42.53,3.08],'escala':[42.12,3.13],'figueres':[42.27,2.96],'bardenas':[42.19,-1.47],
  'pont du gard':[43.95,4.54],'perpignan':[42.70,2.90],
};
function geoLookup(text){
  const t=String(text||'').toLowerCase();
  let best=null, bestIdx=-1;
  for(const k in GEO){ const i=t.lastIndexOf(k); if(i>bestIdx){ bestIdx=i; best=GEO[k]; } }
  return best;
}
// Position eines Objekts: manuell gesetzt (lat/lng) schlägt Automatik
function pointOf(o, text){
  if(o && o.lat!=null && o.lng!=null && o.lat!=='' && o.lng!=='') return {lat:+o.lat, lng:+o.lng};
  const g = geoLookup(text);
  return g ? {lat:g[0], lng:g[1]} : null;
}

// Beschriftungen fürs Overlay: [Name, lat, lng, Stufe] — Stufe 1 immer,
// 2 ab Zoom ≥1.5, 3 ab Zoom ≥2.4; alle ausgeblendet ab Zoom ≥4.6 (dann zählt die Route)
const COUNTRY_LABELS=[
  ['Deutschland',50.96,9.68,1],['Frankreich',46.7,2.55,1],['Spanien',40.09,-3.46,1],
  ['Italien',43.6,11.6,1],['Portugal',39.61,-8.27,1],['Polen',51.99,19.49,1],
  ['Vereinigtes Königreich',54.4,-2.12,1],['Türkei',39.35,34.51,1],['Russland',57.5,38.5,1],
  ['Ukraine',49.72,32.14,1],['Rumänien',45.73,24.97,1],['Norwegen',60.9,7.9,1],
  ['Schweden',62.35,16.6,1],['Finnland',62.0,26.8,1],['Griechenland',39.49,21.73,1],['Irland',53.08,-7.8,1],
  ['Österreich',47.52,14.13,2],['Schweiz',46.72,7.46,2],['Tschechien',49.88,15.38,2],
  ['Ungarn',47.09,19.45,2],['Kroatien',45.4,16.6,2],['Serbien',44.19,20.79,2],
  ['Bulgarien',42.51,25.16,2],['Belarus',53.82,28.42,2],['Litauen',55.1,24.09,2],
  ['Lettland',57.07,25.46,2],['Estland',58.72,25.87,2],['Dänemark',55.97,9.02,2],
  ['Niederlande',52.42,5.61,2],['Belgien',50.64,4.66,2],['Slowakei',48.73,19.05,2],
  ['Tunesien',34.6,9.4,2],['Syrien',35.01,38.28,2],['Georgien',41.87,43.74,2],
  ['Bosnien u. Herzegowina',44.09,18.07,3],['Slowenien',46.06,14.83,3],['Albanien',41.14,20.05,3],
  ['Nordmazedonien',41.6,21.7,3],['Montenegro',42.75,19.25,3],['Kosovo',42.6,20.9,3],
  ['Moldau',47.2,28.5,3],['Luxemburg',49.75,6.1,3],['Andorra',42.55,1.55,3],
  ['Malta',35.89,14.43,3],['Zypern',34.91,33.08,3],['Libanon',34.13,35.99,3],['Färöer',62.19,-7.06,3],
];
const CITY_LABELS=[ // sichtbar ab Zoom ≥1.7
  ['München',48.14,11.57],['Innsbruck',47.27,11.39],['Huesca',42.14,-0.41],['Barcelona',41.39,2.17],
  ['Marseille',43.30,5.37],['Lyon',45.76,4.84],['Toulouse',43.60,1.44],['Zaragoza',41.65,-0.88],
  ['Genua',44.41,8.93],['Nizza',43.70,7.27],['Mailand',45.46,9.19],['Bordeaux',44.84,-0.58],
  ['Bilbao',43.26,-2.94],['Paris',48.86,2.35],['Berlin',52.52,13.40],['Wien',48.21,16.37],
  ['Prag',50.08,14.44],['Rom',41.90,12.50],['Madrid',40.42,-3.70],
];
const SEA_LABELS=[['Mittelmeer',40.6,6.6],['Atlantik',47.5,-8.6],['Nordsee',56.2,3.2],['Ostsee',58.4,19.8]];
// Ortsvorschläge (Datalist) für Von/Nach/Spot-Name: bekannte Städte + eigene
// Spots + bereits verwendete Etappen-Ziele. Rein additiv, kein Zwang — tippen
// bleibt frei möglich, Auswahl erspart nur Tipparbeit.
function placeSuggestions(){
  const names = new Set(CITY_LABELS.map(c=>c[0]));
  state.spots.forEach(sp=>{ if(sp.name) names.add(sp.name); });
  state.routes.forEach(r=>r.stages.forEach(s=>{ if(s.to) names.add(s.to); }));
  state.returnStages.forEach(s=>{ if(s.to) names.add(s.to); });
  return [...names].sort((a,b)=>a.localeCompare(b,'de'));
}

/* --- Pan/Zoom-Engine: eine Ansicht {z,cx,cy} pro Karten-Instanz (data-mapid).
   Der Karteninhalt liegt in <g class="map-pan">; Gesten ändern nur dessen
   transform (billig). Am Gesten-Ende wird die Karte neu aufgebaut, damit
   Marker/Labels gegenskaliert scharf und konstant groß bleiben. --- */
const MAP_VIEWS = {};           // id → {z, cx, cy, rebuild, onTap, autoPos?}
// Hoher Maximalzoom ist für dicht beieinanderliegende Campingplätze nötig:
// 1° entspricht nur 20 Karten-Einheiten, einzelne Plätze können <300 m trennen.
const MAPV_MIN=1, MAPV_MAX=1600;
const ROUTE_VIEW_KEY = STORAGE_KEY + '-map-view';
function defaultCorridorView(){ const c=project(45.4,5.6); return {z:2.3, cx:c.x, cy:c.y}; }
function mapView(id, rebuild, init){
  if(!MAP_VIEWS[id]){ MAP_VIEWS[id] = init || defaultCorridorView(); }
  MAP_VIEWS[id].rebuild = rebuild;
  return MAP_VIEWS[id];
}
function panTf(v){ return `translate(${(MAP.W/2 - v.z*v.cx).toFixed(1)} ${(MAP.H/2 - v.z*v.cy).toFixed(1)}) scale(${v.z.toFixed(4)})`; }
let MZ = 1; // Zoom der gerade gebauten Karte — Gegenskalierung für Marker/Linien
let MU = 3; // viewBox-Einheiten pro Bildschirm-Pixel der gerade gebauten Karte
// px/Einheit des Containers (slice ⇒ Maximum beider Achsen); vor dem ersten
// Einfügen ins DOM (oder in verstecktem Tab) wird über die Fensterbreite geschätzt
function mapPxPerUnit(id){
  const wrap = mapWrapEl(id);
  if(wrap){ const r = wrap.getBoundingClientRect(); if(r.width && r.height) return Math.max(r.width/MAP.W, r.height/MAP.H); }
  if(id==='big'){ const st = document.getElementById('bigMapStage'); const r = st && st.getBoundingClientRect(); if(r && r.width && r.height) return Math.max(r.width/MAP.W, r.height/MAP.H); }
  const w = Math.max(280, Math.min(document.documentElement.clientWidth-48, 860));
  return Math.max(w/MAP.W, Math.min(.68*w,430)/MAP.H);
}
function mapCalib(id){ MZ = MAP_VIEWS[id].z; MU = 1/mapPxPerUnit(id); }

function baseMapSvg(inner, id){
  const v = MAP_VIEWS[id], z = v.z;
  mapCalib(id);
  const u = MU/z; // Einheiten für 1 Bildschirm-px bei Elementen direkt im Pan-Layer
  const halo = `style="stroke-width:${(2.2*u).toFixed(2)}px"`;
  const labels =
    (z<4.6 ? COUNTRY_LABELS
      .filter(c=> c[3]===1 || (c[3]===2 && z>=1.5) || (c[3]===3 && z>=2.4))
      .map(c=>{const q=project(c[1],c[2]); const fs=(c[3]===1?14:c[3]===2?11:9.5)*u;
        return `<text x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" class="country-label" font-size="${fs.toFixed(1)}" ${halo}>${c[0]}</text>`;}).join('') : '')
    + (z>=1.7 ? CITY_LABELS.map(c=>{const q=project(c[1],c[2]);
        return `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="${(3.4*u).toFixed(2)}" fill="#454c5e" stroke="#fffef8" stroke-width="${(1.1*u).toFixed(2)}"/>`+
          `<text x="${(q.x+6*u).toFixed(1)}" y="${(q.y+3.6*u).toFixed(1)}" class="city-label" font-size="${(11*u).toFixed(1)}" style="stroke-width:${(1.8*u).toFixed(2)}px">${c[0]}</text>`;}).join('') : '')
    + (z<3.4 ? SEA_LABELS.map(s=>{const q=project(s[1],s[2]);
        return `<text x="${q.x.toFixed(1)}" y="${q.y.toFixed(1)}" class="sea-label" font-size="${(13*u).toFixed(1)}">${s[0]}</text>`;}).join('') : '');
  return `<div class="mapwrap" data-mapid="${id}">
    <svg viewBox="0 0 ${MAP.W} ${MAP.H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <rect width="${MAP.W}" height="${MAP.H}" fill="#a9cbe2"/>
      <g class="map-pan" transform="${panTf(v)}">
        <image href="${MAP_IMG}" x="0" y="0" width="${MAP.W}" height="${MAP.H}" preserveAspectRatio="none"/>
        ${labels}
        ${inner}
      </g>
    </svg>
    <div class="map-tools">
      <button type="button" class="mtool" onclick="mapZoomBy('${id}',2)" aria-label="Hineinzoomen">+</button>
      <button type="button" class="mtool" onclick="mapZoomBy('${id}',.5)" aria-label="Herauszoomen">−</button>
      ${id.startsWith('pick') ? '' : `<button type="button" class="mtool" onclick="locateMe('${id}')" aria-label="Mein Standort" title="Mein Standort">◎</button>`}
    </div>
  </div>`;
}

function mapWrapEl(id){ return document.querySelector(`.mapwrap[data-mapid="${id}"]`); }
function mapApplyTf(id){
  const wrap = mapWrapEl(id), g = wrap && wrap.querySelector('.map-pan');
  if(g) g.setAttribute('transform', panTf(MAP_VIEWS[id]));
}
function mapClampView(id){
  const v = MAP_VIEWS[id], wrap = mapWrapEl(id), svg = wrap && wrap.querySelector('svg');
  v.z = Math.max(MAPV_MIN, Math.min(MAPV_MAX, v.z));
  if(!svg) return;
  const r = svg.getBoundingClientRect(), ctm = svg.getScreenCTM();
  if(!ctm || !r.width) return;
  const hw = Math.min(r.width/ctm.a/v.z, MAP.W)/2, hh = Math.min(r.height/ctm.d/v.z, MAP.H)/2;
  v.cx = Math.max(hw, Math.min(MAP.W-hw, v.cx));
  v.cy = Math.max(hh, Math.min(MAP.H-hh, v.cy));
}
// Zoom um einen festen Bildschirmpunkt (px,py in Client-Koordinaten)
function mapZoomAt(id, f, px, py){
  const v = MAP_VIEWS[id], wrap = mapWrapEl(id), svg = wrap && wrap.querySelector('svg');
  if(!svg) return;
  const inv = svg.getScreenCTM().inverse();
  const q = new DOMPoint(px, py).matrixTransform(inv);
  const mx = v.cx + (q.x-MAP.W/2)/v.z, my = v.cy + (q.y-MAP.H/2)/v.z;
  v.z = Math.max(MAPV_MIN, Math.min(MAPV_MAX, v.z*f));
  v.cx = mx - (q.x-MAP.W/2)/v.z; v.cy = my - (q.y-MAP.H/2)/v.z;
}
// Gesten-Ende: begrenzen, ggf. merken, Overlay mit neuer Gegenskalierung neu aufbauen
function mapSettle(id){
  mapClampView(id);
  mapApplyTf(id);
  const v = MAP_VIEWS[id];
  if(id==='route') sessionStorage.setItem(ROUTE_VIEW_KEY, JSON.stringify({z:v.z, cx:v.cx, cy:v.cy}));
  if(v.rebuild) v.rebuild();
}
function mapZoomBy(id, f){
  const wrap = mapWrapEl(id), svg = wrap && wrap.querySelector('svg');
  if(!svg) return;
  const r = svg.getBoundingClientRect();
  mapZoomAt(id, f, r.left+r.width/2, r.top+r.height/2);
  mapSettle(id);
}
// Pointer-Gesten (dokumentweit, eine aktive Karte): 1 Finger = verschieben,
// 2 Finger = Pinch-Zoom, kurzes Tippen = onTap (Positionswahl im Modal)
const mapPtrs = new Map();
let mapActiveId = null, mapMoved = 0, mapTapStart = null;
document.addEventListener('pointerdown', e=>{
  const wrap = e.target.closest && e.target.closest('.mapwrap[data-mapid]');
  if(!wrap || e.target.closest('.map-tools')) return;
  if(mapActiveId && mapActiveId !== wrap.dataset.mapid) mapPtrs.clear();
  mapActiveId = wrap.dataset.mapid;
  mapPtrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(mapPtrs.size===1){ mapMoved = 0; mapTapStart = {x:e.clientX, y:e.clientY, t:Date.now(), target:e.target}; }
  wrap.classList.add('dragging');
});
document.addEventListener('pointermove', e=>{
  if(!mapActiveId || !mapPtrs.has(e.pointerId)) return;
  const wrap = mapWrapEl(mapActiveId);
  if(!wrap){ mapPtrs.clear(); mapActiveId = null; return; }
  const svg = wrap.querySelector('svg'), v = MAP_VIEWS[mapActiveId];
  const ctm = svg.getScreenCTM();
  const prev = mapPtrs.get(e.pointerId), cur = {x:e.clientX, y:e.clientY};
  if(mapPtrs.size===1){
    v.cx -= (cur.x-prev.x)/ctm.a/v.z;
    v.cy -= (cur.y-prev.y)/ctm.d/v.z;
    mapMoved += Math.abs(cur.x-prev.x)+Math.abs(cur.y-prev.y);
  } else if(mapPtrs.size===2){
    const other = [...mapPtrs.entries()].find(([pid])=>pid!==e.pointerId)[1];
    const d0 = Math.hypot(prev.x-other.x, prev.y-other.y);
    const d1 = Math.hypot(cur.x-other.x, cur.y-other.y);
    if(d0>0) mapZoomAt(mapActiveId, d1/d0, (cur.x+other.x)/2, (cur.y+other.y)/2);
    mapMoved += 10;
  }
  mapPtrs.set(e.pointerId, cur);
  mapApplyTf(mapActiveId);
});
function mapPointerEnd(e){
  if(!mapActiveId || !mapPtrs.delete(e.pointerId)) return;
  if(mapPtrs.size) return;
  const id = mapActiveId; mapActiveId = null;
  const wrap = mapWrapEl(id);
  if(wrap) wrap.classList.remove('dragging');
  const v = MAP_VIEWS[id];
  const tap = mapTapStart && mapMoved<8 && Date.now()-mapTapStart.t<600;
  if(tap && v.onTap && wrap && !mapTapStart.target.closest('.map-pt')){
    const g = wrap.querySelector('.map-pan');
    const q = new DOMPoint(mapTapStart.x, mapTapStart.y).matrixTransform(g.getScreenCTM().inverse());
    v.onTap(unproject(q.x, q.y));
  } else if(mapMoved>=8){
    mapSettle(id);
  }
  mapTapStart = null;
}
document.addEventListener('pointerup', mapPointerEnd);
document.addEventListener('pointercancel', mapPointerEnd);
let mapWheelTimer = null;
document.addEventListener('wheel', e=>{
  const wrap = e.target.closest && e.target.closest('.mapwrap[data-mapid]');
  if(!wrap) return;
  e.preventDefault();
  const id = wrap.dataset.mapid;
  mapZoomAt(id, e.deltaY<0 ? 1.15 : 1/1.15, e.clientX, e.clientY);
  mapApplyTf(id);
  clearTimeout(mapWheelTimer);
  mapWheelTimer = setTimeout(()=>mapSettle(id), 220);
}, {passive:false});

// Klick-Infos: Labels werden pro Render gesammelt, Marker referenzieren den Index
let mapInfoItems=[];
function mapInfo(i){
  const item = mapInfoItems[i];
  if(item && typeof item==='object'){
    if(item.type==='spot'){ openSpotInfo(item.id); return; }
    if(item.type==='stage'){ openStageInfo(item.ref, item.id); return; }
    if(item.type==='sleep'){ openSleepMapInfo(item.searchId,item.candidateId); return; }
  }
  toast(item);
}
function lineSvg(pts, color, {dashed, glow, faint}={}){
  if(pts.length<2) return '';
  const d='M'+pts.map(p=>{const q=project(p.lat,p.lng);return q.x.toFixed(1)+','+q.y.toFixed(1);}).join('L');
  const u = MU/MZ; // 1 Bildschirm-px in Pan-Layer-Einheiten
  const w = (faint?2:2.6)*u, dash = dashed?` stroke-dasharray="${(7*u).toFixed(2)} ${(5*u).toFixed(2)}"`:'';
  // weiße Kontur unter der Linie — Kontrast auf der hellen Karte
  return `<path d="${d}" fill="none" stroke="#fffef8" stroke-width="${(w+2.2*u).toFixed(2)}" stroke-opacity="${faint?.5:.85}" stroke-linejoin="round" stroke-linecap="round"/>`+
    (glow?`<path d="${d}" fill="none" stroke="${color}" stroke-width="${(8*u).toFixed(2)}" stroke-opacity=".18" stroke-linejoin="round" stroke-linecap="round"/>`:'')+
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w.toFixed(2)}"${dash} stroke-linejoin="round" stroke-linecap="round" stroke-opacity="${faint?.55:(glow?1:.9)}"/>`;
}
// Marker: Formen in Bildschirm-px, Gruppe skaliert mit MU/MZ ⇒ konstante Größe
function markerSvg(p, {num, color, kind, label}){
  const q=project(p.lat,p.lng), idx=mapInfoItems.push(label)-1;
  // Vier Nachkommastellen erhalten auch bei starkem Zoom Abstände von wenigen
  // Metern; die frühere Rundung auf 0,1 ließ nahe Campingplätze kollabieren.
  const on=`class="map-pt" onclick="mapInfo(${idx})" transform="translate(${q.x.toFixed(4)} ${q.y.toFixed(4)}) scale(${(MU/MZ).toFixed(4)})"`;
  if(kind==='start') return `<g ${on}><circle r="7" fill="#fff" stroke="${color}" stroke-width="3.5"/></g>`;
  if(kind==='dot')   return `<g ${on}><circle r="5" fill="${color}" stroke="#fffef8" stroke-width="1.6"/></g>`;
  if(kind==='me')    return `<g ${on}><circle r="11" fill="${color}" fill-opacity=".22"/><circle r="5.5" fill="${color}" stroke="#fff" stroke-width="2.2"/></g>`;
  if(kind==='spot')  return `<g ${on}><rect x="-9" y="-9" width="18" height="18" rx="4" transform="rotate(45)" fill="${color}" stroke="#fffef8" stroke-width="1.8"/><text y="3.9" text-anchor="middle" font-size="10.5" font-weight="800" fill="#1a0d05">${num}</text></g>`;
  return `<g ${on}><circle r="11" fill="${color}" stroke="#fffef8" stroke-width="1.8"/><text y="4.2" text-anchor="middle" font-size="12" font-weight="800" fill="#10131f">${num}</text></g>`;
}
// Etappenliste → Kartenpunkte (Startpunkt der 1. Etappe + alle Ziele, Duplikate kollabiert).
// ref = getStageList()-Referenz (Routen-Id oder 'return'), id = Etappen-Id für den Info-Popup.
function routePts(stages, ref){
  const pts=[];
  stages.forEach((s,i)=>{
    if(i===0){ const p0=pointOf({lat:s.fromLat,lng:s.fromLng}, s.from); if(p0) pts.push({...p0, stage:i, ref, id:s.id, start:true, label:'Start: '+s.from}); }
    const p=pointOf(s, s.to);
    if(!p) return;
    const prev=pts[pts.length-1];
    if(prev && Math.abs(prev.lat-p.lat)<1e-4 && Math.abs(prev.lng-p.lng)<1e-4) return;
    pts.push({...p, stage:i, ref, id:s.id, label:(s.date?s.date+' · ':'')+s.from+' → '+s.to});
  });
  return pts;
}
const ROUTE_COLORS={'r-kueste':'#54c8ff','r-alpen':'#5fd4a8','r-mix':'#ff8a5c'};
function routeColor(route){ return route.color || ROUTE_COLORS[route.id] || '#8ea8ff'; }
// „Mein Standort": einmalige GPS-Abfrage pro Tap (kein Netz nötig — GPS läuft
// offline; nur die Berechtigung braucht ggf. https). Nicht persistiert, reine
// Anzeige auf den Routen-/Spots-/Groß-Karten dieses Geräts.
let userPos = null;
function locateMe(id){
  if(!navigator.geolocation){ toast('Standort wird von diesem Browser nicht unterstützt'); return; }
  toast('Standort wird ermittelt …');
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    if(lat<MAP.latMin || lat>MAP.latMax || lng<MAP.lonMin || lng>MAP.lonMax){
      userPos = null;
      toast('Dein Standort liegt außerhalb des Kartenausschnitts');
      return;
    }
    userPos = {lat, lng};
    const v = MAP_VIEWS[id];
    if(v){ const q = project(lat, lng); v.cx = q.x; v.cy = q.y; v.z = Math.max(v.z, 4); mapSettle(id); }
    toast('📍 Dein Standort');
  }, err=>{
    toast(err && err.code===1 ? 'Standort-Zugriff wurde abgelehnt' : 'Standort konnte nicht ermittelt werden');
  }, {enableHighAccuracy:true, timeout:12000, maximumAge:60000});
}
function userPosMarker(){
  return userPos ? markerSvg(userPos, {kind:'me', color:'#3d76d8', label:'📍 Dein Standort'}) : '';
}
let mapLayers={alle:false, rueck:true, spots:true};
function toggleMapLayer(k){ mapLayers[k]=!mapLayers[k]; renderRoute(); }
let routesExpanded = false;
function toggleSuggestedRoutes(){ routesExpanded = !routesExpanded; renderRoute(); }
// Spot-Art: steuert Kartenfarbe + Badge in der Liste. Fehlt bei alten Spots (vor
// Einführung dieses Felds) → Fallback 'day', damit sie weiter wie bisher orange erscheinen.
const SPOT_TYPES = {
  day:  {label:'Tagesausflug', color:'#ff6b4a', icon:'☀️'},
  camp: {label:'Camping', color:'#5fd4a8', icon:'⛺'},
  both: {label:'Tagesausflug + Camping', color:'#b18cff', icon:'🌗'},
};
function spotType(sp){ return SPOT_TYPES[sp.type] || SPOT_TYPES.day; }
// Welche Spot-Arten aktuell auf Karte + Liste angezeigt werden (alle drei per Default an).
let spotTypeFilter = new Set(Object.keys(SPOT_TYPES));
function toggleSpotTypeFilter(t){
  if(spotTypeFilter.has(t)) spotTypeFilter.delete(t); else spotTypeFilter.add(t);
  renderSpots();
}
function spotMarkers(sorted, withNum){
  return sorted.map((sp,i)=>{
    const p=pointOf(sp, sp.name);
    if(!p) return '';
    return markerSvg(p,{num:i+1, color:spotType(sp).color, kind:'spot', label:{type:'spot', id:sp.id}});
  }).join('');
}
function routeViewInit(){
  try{ const s = JSON.parse(sessionStorage.getItem(ROUTE_VIEW_KEY)); if(s && s.z) return s; }catch(e){}
  return defaultCorridorView();
}
function buildRouteMap(id='route', rebuild=renderRoute){
  const v = mapView(id, rebuild, id==='route' ? routeViewInit() : null);
  mapCalib(id);
  const sel=state.routes.find(r=>r.id===state.selectedRoute);
  let inner='';
  if(mapLayers.alle) state.routes.filter(r=>r.id!==sel.id).forEach(r=>{
    inner+=lineSvg(routePts(r.stages), routeColor(r), {dashed:true, faint:true});
  });
  if(mapLayers.spots) inner+=spotMarkers(sortedSpots(), false);
  if(mapLayers.rueck){
    const pts=routePts(state.returnStages, 'return');
    inner+=lineSvg(pts,'#b18cff',{dashed:true});
    inner+=pts.map(p=>markerSvg(p,{color:'#b18cff', kind:'dot', label:{type:'stage', ref:p.ref, id:p.id}})).join('');
  }
  const pts=routePts(sel.stages, sel.id);
  inner+=lineSvg(pts,'#ffb257',{glow:true});
  inner+=pts.map(p=>markerSvg(p, p.start ? {color:'#ffb257', kind:'start', label:{type:'stage', ref:p.ref, id:p.id}}
                                         : {num:p.stage+1, color:'#ffb257', kind:'', label:{type:'stage', ref:p.ref, id:p.id}})).join('');
  inner+=userPosMarker();
  return baseMapSvg(inner, id);
}
function buildSpotsMap(sorted){
  const v = mapView('spots', renderSpots);
  mapCalib('spots');
  const sel=state.routes.find(r=>r.id===state.selectedRoute);
  let inner=lineSvg(routePts(sel.stages),'#ffb257',{faint:true});
  inner+=spotMarkers(sorted, true);
  inner+=userPosMarker();
  return baseMapSvg(inner, 'spots');
}

function renderBigMap(){
  const stage = document.getElementById('bigMapStage');
  if(!stage) return;
  stage.innerHTML = buildRouteMap('big', renderBigMap);
}
function openBigMap(){
  // Ansicht der kleinen Karte übernehmen und groß weiterzoomen
  MAP_VIEWS.big = {...(MAP_VIEWS.route || routeViewInit())};
  document.getElementById('mapModalBg').classList.add('open');
  renderBigMap();
}
function closeBigMap(){ document.getElementById('mapModalBg').classList.remove('open'); }

/* --- Kartenauswahl im Modal (Position durch Antippen setzen) --- */
function parsePos(str){
  if(!str) return null;
  const [la,ln]=String(str).split(',').map(Number);
  return (isFinite(la)&&isFinite(ln)) ? {lat:la,lng:ln} : null;
}
function pickMarkerSvg(i, cur, autoPos){
  const mk=(p,color,dashed,op)=>{const q=project(p.lat,p.lng);
    return `<g id="pickmarker${i}"${op?` opacity="${op}"`:''} transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) scale(${(MU/MZ).toFixed(4)})"><circle r="10" fill="none" stroke="${color}" stroke-width="2.5"${dashed?' stroke-dasharray="3.5 3.5"':''}/><circle r="4" fill="${color}"/></g>`;};
  if(cur) return mk(cur,'#e8641c');
  if(autoPos) return mk(autoPos,'#3d76d8',true,.8);
  return '';
}
function pickMapSvg(i, cur){
  const v = MAP_VIEWS['pick'+i];
  mapCalib('pick'+i);
  return baseMapSvg(pickMarkerSvg(i, cur, v.autoPos), 'pick'+i);
}
function rebuildPicker(i){
  const host = document.querySelector(`.pickmap[data-pick="${i}"]`);
  const input = document.getElementById('mf'+i);
  if(host && input) host.innerHTML = pickMapSvg(i, parsePos(input.value));
}
function pickMapSet(i, p){
  const input = document.getElementById('mf'+i);
  if(!input) return;
  input.value = p.lat.toFixed(4)+','+p.lng.toFixed(4);
  rebuildPicker(i);
}
function pickMapField(i, val, autoPos){
  const cur = val || null;
  const start = cur || autoPos;
  const c = start ? project(start.lat, start.lng) : null;
  MAP_VIEWS['pick'+i] = Object.assign(c ? {z:3, cx:c.x, cy:c.y} : defaultCorridorView(), {
    autoPos: autoPos || null,
    onTap: p => pickMapSet(i, p),
    rebuild: () => rebuildPicker(i),
  });
  return `<input type="hidden" id="mf${i}" value="${cur?cur.lat.toFixed(4)+','+cur.lng.toFixed(4):''}">
    <div class="pickmap" data-pick="${i}">${pickMapSvg(i, cur)}</div>
    <div class="pickhint">${cur?'📍 Position manuell gesetzt.':(autoPos?'Position automatisch erkannt (blau gestrichelt).':'Keine Position erkannt.')} Karte antippen zum Setzen, Zoomen mit zwei Fingern/Mausrad/+− · <a href="#" style="color:var(--sky)" onclick="event.preventDefault();pickMapClear(${i})">Zurücksetzen auf Automatik</a></div>`;
}
function pickMapClear(i){
  document.getElementById('mf'+i).value='';
  rebuildPicker(i);
}
// Gespeicherte Werte aus dem Modal aufs Objekt anwenden. keys erlaubt ein
// abweichendes Feldpaar (z. B. ['fromLat','fromLng'] für die Start-Position
// der ersten Etappe statt der normalen Ziel-Position).
function applyPos(target, posStr, keys=['lat','lng']){
  if(posStr){ const [la,ln]=posStr.split(',').map(Number); if(isFinite(la)&&isFinite(ln)){ target[keys[0]]=la; target[keys[1]]=ln; return; } }
  delete target[keys[0]]; delete target[keys[1]];
}

/* ============================================================
   MODAL — generischer Editor
   fields: [{key,label,type:'text'|'number'|'tripDate'|'unit'|'textarea'|'select',options,value,placeholder}]
   ============================================================ */
let modalCtx = null;
function modalDateBounds(){
  const years=[state?.trip?.startDate,state?.trip?.endDate].map(x=>Number(String(x||'').slice(0,4))).filter(Number.isFinite),lo=years.length?Math.min(...years)-1:new Date().getFullYear()-1,hi=years.length?Math.max(...years)+1:new Date().getFullYear()+2;
  return {min:`${lo}-01-01`,max:`${hi}-12-31`};
}
function openModal(title, fields, onSave, onDelete, opts={}){
  modalCtx = {fields, onSave, onDelete, ...opts};
  const dateBounds=modalDateBounds();
  const box = document.getElementById('modalBox');
  box.innerHTML = '<h3>' + esc(title) + '</h3>' + fields.map((f,i)=>{
    let input;
    if(f.type==='textarea') input = '<textarea id="mf'+i+'" placeholder="'+esc(f.placeholder||'')+'">'+esc(f.value||'')+'</textarea>';
    else if(f.type==='select') input = '<select id="mf'+i+'">'+f.options.map(o=>'<option value="'+esc(o.value)+'"'+(o.value===f.value?' selected':'')+'>'+esc(o.label)+'</option>').join('')+'</select>';
    else if(f.type==='map') input = pickMapField(i, f.value, f.auto);
    else if(f.type==='checkbox') input = '<label class="modal-check"><input id="mf'+i+'" type="checkbox" '+(f.value?'checked':'')+'> '+esc(f.text||'aktiv')+'</label>';
    else if(f.type==='crewMulti') input = crewMultiField(i, f.value || []);
    else if(f.type==='tripDate'||f.type==='isoDate') input = '<input id="mf'+i+'" type="date" min="'+dateBounds.min+'" max="'+dateBounds.max+'" value="'+esc(f.value||'')+'">';
    else if(f.type==='unit') input = '<div class="unit-field"><input id="mf'+i+'" type="number" min="0" step="'+esc(f.step||'0.25')+'" inputmode="decimal" value="'+esc(f.value??'')+'" placeholder="'+esc(f.placeholder||'')+'"><span>'+esc(f.unit)+'</span></div>';
    else input = '<input id="mf'+i+'" type="'+(f.type==='number'?'number':'text')+'" '+(f.type==='number'?'step="0.01" inputmode="decimal"':'')+(f.datalist?' list="dl'+i+'" autocomplete="off"':'')+' value="'+esc(f.value||'')+'" placeholder="'+esc(f.placeholder||'')+'">'+(f.datalist?'<datalist id="dl'+i+'">'+f.datalist.map(o=>'<option value="'+esc(o)+'">').join('')+'</datalist>':'');
    return '<div class="field"><label>'+esc(f.label)+'</label>'+input+'</div>';
  }).join('') +
  '<div class="btnrow">' +
    (onDelete ? '<button class="btn danger" onclick="modalDelete()">Löschen</button>' : '') +
    '<button class="btn ghost" onclick="closeModal()">Abbrechen</button>' +
    '<button class="btn primary" onclick="modalSave()">Speichern</button>' +
  '</div>';
  document.getElementById('modalBg').classList.add('open');
  const first = document.getElementById('mf0');
  if(first && window.innerWidth > 700) first.focus();
}
function modalSave(){
  const vals = {};
  modalCtx.fields.forEach((f,i)=>{
    const el = document.getElementById('mf'+i);
    let value = f.type==='checkbox' ? el.checked : el.value;
    if(f.type==='tripDate') value = value ? fmtStageDate(parseTripDateInput(value)) : (f.legacyValue || '');
    if(f.type==='unit') value = value!=='' ? formatStageUnit(value, f.unit, f.approx) : (f.legacyValue || '');
    vals[f.key] = value;
  });
  const skipSave = !!modalCtx.skipSave;
  modalCtx.onSave(vals);
  closeModal();
  if(!skipSave) save();
  renderAll();
}
function modalDelete(){
  const fn = modalCtx.onDelete;
  closeModal();
  withUndo('Gelöscht', fn);
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); modalCtx = null; }
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

function crewMultiField(i, selected){
  const ids = Array.isArray(selected) ? selected : [];
  return `<input type="hidden" id="mf${i}" value="${esc(ids.join(','))}">
    <div class="chips crewselect" id="crewMulti${i}">
      <span class="chip${ids.length===state.crew.length?' on':''}" onclick="toggleCrewMulti(${i},'__all')">Alle</span>
      ${state.crew.map(c=>`<span class="chip${ids.includes(c.id)?' on':''}" style="--c:${c.color}" data-id="${c.id}" onclick="toggleCrewMulti(${i},'${c.id}')"><span class="dot"></span>${esc(c.name)}</span>`).join('')}
    </div>`;
}
function toggleCrewMulti(i, id){
  const input = document.getElementById('mf'+i);
  if(!input) return;
  let ids = input.value ? input.value.split(',').filter(Boolean) : [];
  if(id==='__all') ids = ids.length===state.crew.length ? [] : state.crew.map(c=>c.id);
  else {
    ids = ids.includes(id) ? ids.filter(x=>x!==id) : [...ids, id];
    ids = state.crew.map(c=>c.id).filter(cid=>ids.includes(cid));
  }
  input.value = ids.join(',');
  const box = document.getElementById('crewMulti'+i);
  if(!box) return;
  box.querySelectorAll('.chip').forEach(ch=>{
    const cid = ch.dataset.id;
    ch.classList.toggle('on', cid ? ids.includes(cid) : ids.length===state.crew.length);
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const TABS = [
  {id:'uebersicht', label:'Start'},
  {id:'route',      label:'Route'},
  {id:'spots',      label:'Stopps'},
  {id:'logistik',   label:'Fahrzeuge'},
  {id:'packen',     label:'Packen'},
  {id:'einkauf',    label:'Einkaufen'},
  {id:'budget',     label:'Ausgaben'},
  {id:'sleep',      label:'Schlafplätze'},
  {id:'festival',   label:'Festival'},
  {id:'reminder',   label:'Orga'},
  {id:'verlauf',    label:'Verlauf'},
];
const HOME_TILES = [
  {id:'spots', label:'Stopps', icon:'pin', accent:'#ff6b4a'},
  {id:'logistik', label:'Fahrzeuge', icon:'van', accent:'#8ea8ff'},
  {id:'packen', label:'Packen', icon:'suitcase', accent:'#d38cff'},
  {id:'einkauf', label:'Einkaufen', icon:'cart', accent:'#5fd4a8'},
  {id:'budget', label:'Ausgaben', icon:'money', accent:'#ffd76b'},
  {id:'sleep', label:'Schlafplätze', icon:'tent', accent:'#5fd4a8'},
  {id:'festival', label:'Festival', icon:'ticket', accent:'#ffb257'},
];
let activeTab = sessionStorage.getItem('sizigia-tab') || 'uebersicht';
function renderNav(){
  document.getElementById('nav').innerHTML = TABS.map(t =>
    '<button class="tab'+(t.id===activeTab?' active':'')+'" onclick="switchTab(\''+t.id+'\')">'+t.label+'</button>'
  ).join('');
  TABS.forEach(t => document.getElementById('page-'+t.id).classList.toggle('active', t.id===activeTab));
}
function switchTab(id){
  activeTab = id;
  sessionStorage.setItem('sizigia-tab', id);
  renderNav();
  if(id==='sleep'&&sleepView==='map'&&sleepMapLayer==='detail')setTimeout(initSleepDetailMap,0);
  window.scrollTo({top:0});
}
function homeIconSvg(kind){
  const icons = {
    pin:'<svg viewBox="0 0 24 24"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    van:'<svg viewBox="0 0 24 24"><path d="M4 16V8h12l4 4v4"/><path d="M6 16a2 2 0 1 0 4 0"/><path d="M16 16a2 2 0 1 0 4 0"/><path d="M4 12h16"/></svg>',
    suitcase:'<svg viewBox="0 0 24 24"><path d="M8 7V6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1"/><rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M4 12h16"/><path d="M8 10v7"/><path d="M16 10v7"/></svg>',
    cart:'<svg viewBox="0 0 24 24"><path d="M4 5h2l2 11h10l2-8H7"/><path d="M9 20a1 1 0 1 0 0-2"/><path d="M17 20a1 1 0 1 0 0-2"/></svg>',
    money:'<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M17 7H9.5a3 3 0 0 0 0 6H14a3 3 0 0 1 0 6H6"/></svg>',
    ticket:'<svg viewBox="0 0 24 24"><path d="M5 6h14v4a2 2 0 0 0 0 4v4H5v-4a2 2 0 0 0 0-4V6Z"/><path d="M9 9h6"/><path d="M9 15h4"/><path d="M16.5 6v12"/></svg>',
    activity:'<svg viewBox="0 0 24 24"><path d="M4 12h4l2-6 4 12 2-6h4"/><path d="M5 20h14"/></svg>',
    bell:'<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21h4"/></svg>',
    poll:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>',
    check:'<svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6"/></svg>',
    tent:'<svg viewBox="0 0 24 24"><path d="M1 20L23 20"/><path d="M4 20L12 4L20 20"/><path d="M12 4L12 20"/></svg>',
    chevron:'<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  };
  return icons[kind] || icons.activity;
}
function renderLatestActivityTile(recent){
  const desc = recent ? recent.desc : 'Noch keine Änderungen protokolliert.';
  const meta = recent ? fmtLogTs(recent.ts) : '';
  return `
    <button class="home-tile home-latest-tile" onclick="switchTab('verlauf')" aria-label="Letzte Änderung öffnen">
      <span class="home-latest-kicker">Verlauf${meta?' · '+esc(meta):''}</span>
      <span class="home-latest-text">${esc(desc)}</span>
    </button>`;
}
function reminderCounts(){
  return {
    reminders:(state.reminders||[]).filter(r=>!r.done).length,
    polls:(state.polls||[]).filter(p=>!p.closed).length
  };
}
// Kurzfassung, was gerade ansteht: offene Umfrage (Frage) schlägt fällige Aufgabe (Titel)
function reminderHomeHighlight(){
  const openPolls = (state.polls||[]).filter(p=>!p.closed).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const openRems = (state.reminders||[]).filter(r=>!r.done);
  if(openPolls.length) return 'Umfrage offen: „'+esc(openPolls[0].question)+'"';
  if(openRems.length){
    const next = esc(openRems[0].title);
    return openRems.length>1 ? openRems.length+' Aufgaben offen · nächste: „'+next+'"' : 'Aufgabe offen: „'+next+'"';
  }
  return 'Alles erledigt – keine offenen Punkte 🎉';
}
function renderReminderHomeTile(){
  const c = reminderCounts();
  const total = c.reminders + c.polls;
  return `
    <button class="home-tile home-reminder-tile" onclick="switchTab('reminder')" aria-label="Orga: Aufgaben und Entscheidungen öffnen">
      <div class="home-reminder-head">
        <span class="home-tile-icon" aria-hidden="true">${homeIconSvg('bell')}</span>
        <b>Aufgaben &amp; Entscheidungen</b>
        <span class="home-count-pill ${total?'active':'clear'}">${total ? total : homeIconSvg('check')}</span>
      </div>
      <div class="home-reminder-badges">
        <span class="hr-badge rem">${homeIconSvg('bell')}${c.reminders} Aufgabe${c.reminders===1?'':'n'}</span>
        <span class="hr-badge poll">${homeIconSvg('poll')}${c.polls} Umfrage${c.polls===1?'':'n'}</span>
      </div>
      <span class="home-reminder-highlight">${reminderHomeHighlight()}</span>
    </button>`;
}

/* ============================================================
   ÜBERSICHT
   ============================================================ */
function listProgress(items){
  const flat = items.flatMap(g => g.items ? g.items : [g]);
  const done = flat.filter(itemComplete).length;
  return {done, total:flat.length, pct: flat.length ? Math.round(done/flat.length*100) : 0};
}
// Summen über Etappen: km aus "280 km", Stunden aus "~4,5 Std"
function routeTotals(stages){
  let km=0, h=0;
  stages.forEach(s=>{
    km += parseInt(String(s.km||'').replace(/[^\d]/g,''), 10) || 0;
    const m = String(s.time||'').replace(',','.').match(/(\d+(?:\.\d+)?)/);
    if(m) h += parseFloat(m[1]);
  });
  return {km, hTxt: String(Math.round(h*10)/10).replace('.',',')};
}
function localIsoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function tripStageIso(stage){
  const m=String(stage?.date||'').match(/(\d{1,2})\.(\d{1,2})\./),year=Number(String(state.trip?.startDate||'').slice(0,4))||new Date().getFullYear();
  return m?`${year}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`:'';
}
function tripDayContext(now=new Date()){
  const route=state.routes.find(r=>r.id===state.selectedRoute)||state.routes[0],today=localIsoDate(now),stages=[...(route?.stages||[]),...(state.returnStages||[])].map(stage=>({stage,iso:tripStageIso(stage)})).filter(x=>x.iso).sort((a,b)=>a.iso.localeCompare(b.iso));
  const configuredStart=state.trip?.startDate||'',configuredEnd=state.trip?.endDate||'',routeStart=stages[0]?.iso||'',routeEnd=stages.at(-1)?.iso||'',start=routeStart&&(!configuredStart||routeStart<configuredStart)?routeStart:configuredStart,end=routeEnd&&(!configuredEnd||routeEnd>configuredEnd)?routeEnd:configuredEnd;
  const startDate=start?new Date(start+'T12:00:00'):null,endDate=end?new Date(end+'T12:00:00'):null,todayDate=new Date(today+'T12:00:00'),daysToStart=startDate?Math.round((startDate-todayDate)/86400000):null,tripDay=startDate?Math.floor((todayDate-startDate)/86400000)+1:null;
  const exact=stages.find(x=>x.iso===today),next=stages.find(x=>x.iso>=today),last=stages.at(-1),phase=start&&today<start?'before':end&&today>end?'after':'during',pick=exact||next||(phase==='after'?last:null);
  let timing='Reise in Planung';
  if(phase==='before'&&daysToStart!=null)timing=daysToStart===0?'Abfahrt heute':daysToStart===1?'Morgen geht’s los':`${daysToStart} Tage bis zur Abfahrt`;
  else if(phase==='during'&&tripDay!=null)timing=`Reisetag ${Math.max(1,tripDay)}`;
  else if(phase==='after')timing='Reise abgeschlossen';
  return {route,today,start,end,phase,timing,stage:pick?.stage||null,stageIso:pick?.iso||'',stageExact:!!exact};
}
function homeRouteContext(route,tot){
  const ctx=tripDayContext(),stage=ctx.stage;
  const fallback=`${route.name} · ca. ${tot.km} km · ~${tot.hTxt} Std`;
  return {eyebrow:'Roadtrip',title:'Route planen',meta:stage?[ctx.timing,stage.to].filter(Boolean).join(' · '):fallback};
}
function renderHomeDashboard(route, tot, recent){
  const routeContext=homeRouteContext(route,tot);
  return `
    <div class="home-dashboard">
      <div class="route-hero" onclick="switchTab('route')" role="button" tabindex="0" aria-label="Route planen" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();switchTab('route')}">
        <div class="route-hero-img" style="background-image:url('data:image/jpeg;base64,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')" aria-hidden="true"></div>
        <div class="hero-copy">
          <div class="eyebrow">${esc(routeContext.eyebrow)}</div>
          <b>${esc(routeContext.title)}</b>
          <span>${esc(routeContext.meta)}</span>
        </div>
      </div>
      <div class="home-tile-grid">
        ${HOME_TILES.map(t=>`
          <button class="home-tile home-grid-tile" style="--accent:${t.accent}" onclick="switchTab('${t.id}')">
            <span class="home-tile-icon" aria-hidden="true">${homeIconSvg(t.icon)}</span>
            <b>${esc(t.label)}</b>
          </button>`).join('')}
        ${renderReminderHomeTile()}
        ${renderLatestActivityTile(recent)}
      </div>
    </div>`;
}
function sectionBackButton(){
  return `<div class="section-return"><button onclick="switchTab('uebersicht')" aria-label="Zur Startseite">←</button><span>Zur Startseite</span></div>`;
}
function renderOverview(){
  const route = state.routes.find(r=>r.id===state.selectedRoute);
  const tot = routeTotals(route.stages);
  const recent = [...(state.log||[])].reverse()[0];
  document.getElementById('page-uebersicht').innerHTML = renderHomeDashboard(route, tot, recent);
}
function toggleSnapshots(){
  const el = document.getElementById('snapshotList');
  if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function editCrew(id){
  const c = crewById(id);
  openModal('Crew-Mitglied bearbeiten', [{key:'name',label:'Name',value:c.name}], v=>{
    if(!v.name.trim() || v.name.trim()===c.name) return;
    const prev = c.name;
    c.name = v.name.trim();
    logChange('hat „'+prev+'" in „'+c.name+'" umbenannt', {t:'crewEdit', cid:id, prev});
  });
}

/* ============================================================
   ROUTE
   ============================================================ */
// Startpunkt der Liste: die Etappen-Karten zeigen seit der Timeline-Umstellung nur
// noch ihr Ziel (die Herkunft ergibt sich aus der Vorgänger-Karte) — ohne diesen
// Block wäre die Startadresse der allerersten Etappe (list[0].from) nirgends mehr
// sichtbar. Antippen öffnet die erste Etappe zum Bearbeiten.
function renderStageStart(ref, list){
  if(!list.length || !list[0].from) return '';
  return `
  <div class="stage-start" role="button" tabindex="0" title="Startpunkt bearbeiten"
       onclick="editStage('${ref}',0)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editStage('${ref}',0)}">
    <span class="stage-start-dot"></span>
    <span class="stage-start-kicker">Start</span>
    <b>${esc(list[0].from)}</b>
  </div>`;
}
// Verbindung zwischen zwei Etappen-Karten: Linie + Pille mit Distanz/Fahrzeit/
// Navigations-Link der Fahrt, die zu Etappe s hinführt. Läuft immer vor der
// zugehörigen Etappen-Karte (auch vor der ersten — Strecke ab Treffpunkt).
// Navigations-Link der Verbindungs-Pille: immer eine echte Route (Von → Nach),
// nie der evtl. hinterlegte Ziel-Link der Etappe (der zeigt nur einen Pin — für
// den Etappen-Popup richtig, zum Losfahren nicht). Bekannte Koordinaten schlagen
// Ortsnamen: eindeutiger für Google Maps als Namen mit Zusätzen wie "(Region)".
function stageRouteLink(s, prevStage){
  const part = (pt, txt) => pt ? pt.lat.toFixed(5)+','+pt.lng.toFixed(5) : (txt ? encodeURIComponent(txt) : null);
  const o = part(stageFromPoint(prevStage, s), s.from);
  const d = part(pointOf(s, s.to), s.to);
  return (o && d) ? 'https://www.google.com/maps/dir/'+o+'/'+d : null;
}
// Fahrzeit-Text → Stunden (für den "lange Etappe"-Hinweis); unparsebar ⇒ null
function stageHours(time){
  const s = String(time||'');
  const hours = s.match(/(\d+(?:[.,]\d+)?)\s*(?:Std|Stunden?|h)\b/i);
  if(hours) return parseFloat(hours[1].replace(',','.'));
  const minutes = s.match(/(\d+(?:[.,]\d+)?)\s*(?:Min|Minuten?)\b/i);
  return minutes ? parseFloat(minutes[1].replace(',','.'))/60 : null;
}
function renderStageConnector(s, ref, idx){
  const link = stageRouteLink(s, getStageList(ref)[idx-1]);
  const hasInfo = s.km || s.time || link;
  const h = stageHours(s.time);
  return `
  <div class="stage-connector">
    <div class="stage-connector-line"></div>
    ${hasInfo?`<div class="stage-connector-pill">
      ${s.km?`<span>📏 ${esc(s.km)}</span>`:''}
      ${s.time?`<span>⏱ ${esc(s.time)}</span>`:''}
      ${h!=null && h>=6?'<span class="stage-warn" title="Lange Fahr-Etappe — Pausen einplanen">⚠️ lang</span>':''}
      ${link?`<a class="maplink" href="${esc(link)}" target="_blank" rel="noopener">🗺️ Route</a>`:''}
    </div>`:''}
    ${idx>0?`<button class="stage-connector-add" title="Stopp dazwischen einfügen" onclick="openStageChooser('${ref}',${idx})">+</button>`:''}
  </div>`;
}
function renderStage(s, listRef, idx, len){
  // Während des Trips: heutige Etappe hervorheben (Datum "So 02.08." → Tag+Monat)
  const m = String(s.date||'').match(/(\d{1,2})\.(\d{1,2})\./);
  const now = new Date();
  const isToday = m && +m[1]===now.getDate() && +m[2]===now.getMonth()+1;
  // Datums-Reihenfolge prüfen: Etappe datiert vor ihrem Vorgänger ⇒ Hinweis
  const prevS = getStageList(listRef)[idx-1];
  const d = parseStageDate(s.date), dPrev = prevS ? parseStageDate(prevS.date) : null;
  const dateWarn = d && dPrev && d < dPrev;
  return `
  <div class="stage${isToday?' today':''}" id="stage-${listRef}-${s.id}">
    <div class="actions">
      ${idx>0?`<button title="nach oben" onclick="moveStage('${listRef}',${idx},-1)">↑</button>`:''}
      ${idx<len-1?`<button title="nach unten" onclick="moveStage('${listRef}',${idx},1)">↓</button>`:''}
      <button title="bearbeiten" onclick="editStage('${listRef}',${idx})">✎</button>
    </div>
    <div class="toprow"><span class="date">${esc(s.date)}</span>${dateWarn?'<span class="stage-warn" title="Datum liegt vor der vorherigen Etappe">⚠️</span>':''}${isToday?'<span class="todaybadge">HEUTE</span>':''}<span class="fromto">${esc(s.to)}</span></div>
    ${s.stay?`<div class="stay">⛺ ${esc(s.stay)}</div>`:''}
    ${s.note?`<div class="note">${esc(s.note)}</div>`:''}
  </div>`;
}
function getStageList(ref){
  if(ref==='return') return state.returnStages;
  return state.routes.find(r=>r.id===ref).stages;
}
// Popup beim Antippen eines Etappen-Markers auf der Karte (Hinweg wie Rückreise):
// Details, Google-Maps-Link, Sprung zur Etappen-Karte in der Liste.
function openStageInfo(ref, id){
  const list = getStageList(ref);
  const s = list && list.find(x=>x.id===id);
  if(!s){ toast('Diese Etappe wurde entfernt'); return; }
  const link = mapsLink(s);
  const isReturn = ref==='return';
  const routeName = isReturn ? '' : (state.routes.find(r=>r.id===ref)?.name || '');
  modalCtx = null;
  document.getElementById('modalBox').innerHTML = `
    <h3>${isReturn?'🔙':'🧭'} ${esc(s.from)} → ${esc(s.to)}</h3>
    <div style="font-size:12px;color:var(--sun);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin:-10px 0 12px">${esc(s.date||'')}${isReturn?' · Rückreise':(routeName?' · '+esc(routeName):'')}</div>
    <div class="meta" style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-bottom:12px">
      ${s.km?`<span>📏 ${esc(s.km)}</span>`:''}
      ${s.time?`<span>⏱ ${esc(s.time)}</span>`:''}
    </div>
    ${s.stay?`<p style="font-size:13.5px;color:var(--muted);margin:0 0 10px">⛺ ${esc(s.stay)}</p>`:''}
    ${s.note?`<p style="font-size:13.5px;color:var(--muted);margin:0 0 12px">${esc(s.note)}</p>`:''}
    <div class="btnrow">${link?`<a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">🗺️ Google Maps öffnen</a>`:'<span class="hint" style="margin:0">Keine Positionsangabe verfügbar</span>'}</div>
    <div class="btnrow">
      <button class="btn ghost" onclick="closeModal()">Schließen</button>
      <button class="btn primary" onclick="goToStageInList('${ref}','${s.id}')">Zur Etappen-Liste</button>
    </div>`;
  document.getElementById('modalBg').classList.add('open');
}
function goToStageInList(ref, id){
  closeModal();
  closeBigMap();
  switchTab('route');
  const el = document.getElementById('stage-'+ref+'-'+id);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.classList.add('map-flash');
  setTimeout(()=>el.classList.remove('map-flash'), 1600);
}
function routeFields(r={}){
  return [
    {key:'name',label:'Name der Route',value:r.name||'',placeholder:'z. B. Pyrenäen frei geplant'},
    {key:'desc',label:'Kurzbeschreibung',type:'textarea',value:r.desc||'',placeholder:'z. B. Eigene Idee mit Stopps, Campingplätzen und Pausen.'},
    {key:'emoji',label:'Symbol',type:'select',value:r.emoji||'🧭',options:[
      {value:'🧭',label:'Kompass'},
      {value:'🌄',label:'Berge & Meer'},
      {value:'🌊',label:'Küste'},
      {value:'🏔️',label:'Alpen'},
      {value:'🛣️',label:'Straße'},
      {value:'✨',label:'Eigene Idee'},
    ]},
  ];
}
function addRoute(){
  openModal('Eigene Route anlegen', routeFields(), v=>{
    const name = v.name.trim();
    if(!name){ toast('Name der Route fehlt'); return; }
    const prevSelected = state.selectedRoute;
    const route = {id:uid(), emoji:v.emoji||'🧭', name, desc:v.desc.trim()||'Eigene Route von Grund auf planen.', stages:[], custom:true};
    state.routes.push(route);
    state.selectedRoute = route.id;
    logChange('hat eigene Route „'+route.name+'" angelegt', {t:'routeAdd', id:route.id, prevSelected});
  });
}
function editRoute(id){
  const route = state.routes.find(r=>r.id===id);
  if(!route || !route.custom){ toast('Nur eigene Routen können hier bearbeitet werden'); return; }
  openModal('Route bearbeiten', routeFields(route), v=>{
    const prev = {name:route.name, desc:route.desc, emoji:route.emoji};
    route.name = v.name.trim() || route.name;
    route.desc = v.desc.trim() || 'Eigene Route von Grund auf planen.';
    route.emoji = v.emoji || '🧭';
    logChange('hat eigene Route „'+route.name+'" bearbeitet', {t:'routeEdit', id, prev});
  }, ()=>deleteRoute(id));
}
function deleteRoute(id){
  const route = state.routes.find(r=>r.id===id);
  if(!route || !route.custom){ toast('Nur eigene Routen können gelöscht werden'); return; }
  const idx = state.routes.findIndex(r=>r.id===id);
  const prevSelected = state.selectedRoute;
  logChange('hat eigene Route „'+route.name+'" gelöscht', {t:'routeDel', route:{...route, stages:route.stages.map(s=>({...s}))}, idx, prevSelected});
  state.routes.splice(idx,1);
  if(state.selectedRoute === id) state.selectedRoute = state.routes[0]?.id || '';
}
function renderRoute(){
  const route = state.routes.find(r=>r.id===state.selectedRoute);
  document.getElementById('page-route').innerHTML = sectionBackButton() + `
    <div class="card route-map-card">
      <h2>🗺️ Karte <span class="spacer"></span><button class="btn small" onclick="openBigMap()">Groß öffnen</button></h2>
      ${buildRouteMap()}
      <div class="route-switch">
        <select onchange="selectRoute(this.value)" aria-label="Route wechseln">
          ${state.routes.map(r=>`<option value="${r.id}"${r.id===state.selectedRoute?' selected':''}>${esc(r.emoji)} ${esc(r.name)}</option>`).join('')}
        </select>
      </div>
      <div class="layerchips">
        <span class="lchip static on" style="--c:#ffb257"><span class="swatch"></span>${esc(route.name)} (gewählt)</span>
        <span class="lchip${mapLayers.alle?' on':''}" style="--c:#54c8ff" onclick="toggleMapLayer('alle')"><span class="swatch"></span>Alle Routen vergleichen</span>
        <span class="lchip${mapLayers.rueck?' on':''}" style="--c:#b18cff" onclick="toggleMapLayer('rueck')"><span class="swatch"></span>Rückreise</span>
        <span class="lchip${mapLayers.spots?' on':''}" style="--c:#ff6b4a" onclick="toggleMapLayer('spots')"><span class="swatch"></span>Spots</span>
      </div>
      <div class="hint">Echte Europakarte, komplett offline (Natural Earth). Ziehen verschiebt den Ausschnitt, Zoomen mit zwei Fingern, Mausrad oder den +/−-Buttons — hineinzoomen zeigt die geplante Route im Detail. Marker antippen für Infos, ◎ zeigt deinen Standort (GPS). Getaggte Orte der Gruppe: <a href="https://maps.app.goo.gl/JnPwkaBY46XwAN8g7?g_st=iw" target="_blank" rel="noopener" style="color:var(--sky)">Google-Maps-Liste öffnen ↗</a> (braucht Internet).</div>
    </div>

    <div class="card">
      <h2>🧭 Routen-Option wählen <span class="spacer"></span><button class="btn small" onclick="addRoute()">+ Eigene Route</button></h2>
      ${(()=>{
        const customRoutes = state.routes.filter(r=>r.custom);
        const suggestedRoutes = state.routes.filter(r=>!r.custom);
        const selRoute = state.routes.find(r=>r.id===state.selectedRoute);
        const selectedIsSuggested = selRoute && !selRoute.custom;
        const routeCard = r=>{
          const t = routeTotals(r.stages);
          return `
          <button class="route-opt${r.id===state.selectedRoute?' sel':''}${r.custom?' custom':''}" onclick="selectRoute('${r.id}')">
            <span class="star">★</span>
            ${r.custom?`<span class="route-actions">
              <span class="route-action" onclick="event.stopPropagation();editRoute('${r.id}')" title="Route bearbeiten">✎</span>
            </span>`:''}
            <span class="emoji">${r.emoji}</span>
            <h3>${esc(r.name)}</h3>
            <p>${esc(r.desc)}</p>
            <p class="routetotal">${r.stages.length ? `ca. ${t.km} km · ~${t.hTxt} Std Fahrzeit` : 'Noch keine Etappen'}</p>
          </button>`;};
        return `
      <div class="route-picker">
        ${customRoutes.map(routeCard).join('')}
        <button class="route-opt route-create" onclick="addRoute()">
          <span class="emoji">+</span>
          <h3>Eigene Route</h3>
          <p>Von Grund auf planen und danach Etappen hinzufügen.</p>
        </button>
      </div>
      <button class="route-suggest-toggle" onclick="toggleSuggestedRoutes()">
        <span class="chev">${routesExpanded?'▾':'▸'}</span>
        Vorschläge ${routesExpanded?'ausblenden':'anzeigen'} (${suggestedRoutes.length})${(!routesExpanded && selectedIsSuggested)?` · aktuell gewählt: ${esc(selRoute.emoji)} ${esc(selRoute.name)}`:''}
      </button>
      ${routesExpanded?`<div class="route-picker" style="margin-top:10px">${suggestedRoutes.map(routeCard).join('')}</div>`:''}
      <div class="hint">Die ersten Routen sind Vorschläge. Eigene Routen könnt ihr von Grund auf planen, auswählen und wieder löschen.</div>`;
      })()}
    </div>

    <div class="card">
      <h2 style="flex-wrap:wrap">${route.emoji} Hinweg: ${esc(route.name)} <span class="spacer"></span><button class="btn small" onclick="openStageChooser('${route.id}')">+ Etappe</button></h2>
      <div class="stage-list">${renderStageStart(route.id, route.stages)}${route.stages.map((s,i)=>renderStageConnector(s, route.id, i)+renderStage(s, route.id, i, route.stages.length)).join('')}</div>
      ${route.stages.length===0?`<div class="route-empty">
        <b>Noch keine Etappen</b>
        <p class="hint" style="margin:5px 0 12px">Starte mit dem ersten Abschnitt, danach funktionieren Karte, Gesamtstrecke und Bearbeitung wie bei den Vorschlägen.</p>
        <button class="btn primary" onclick="openStageChooser('${route.id}')">Erste Etappe anlegen</button>
      </div>`:
        `<div class="routetotal">Gesamt Hinweg: ca. ${routeTotals(route.stages).km} km · ~${routeTotals(route.stages).hTxt} Std reine Fahrzeit</div>
        ${(()=>{ // Ankunfts-Check: letzte datierte Hinweg-Etappe nach Festival-Start (10.08.)?
          const dated = route.stages.map(s=>parseStageDate(s.date)).filter(Boolean);
          return dated.length && dated[dated.length-1] > new Date(2026,7,10)
            ? '<div class="stage-warn" style="margin-top:6px">⚠️ Letzte Etappe liegt nach dem Festival-Start (Mo 10.08.)</div>' : '';
        })()}`}
    </div>

    <div class="card">
      <h2 style="flex-wrap:wrap">🔙 Rückreise (ab 14.08., Vorschlag) <span class="spacer"></span><button class="btn small" onclick="openStageChooser('return')">+ Etappe</button></h2>
      <div class="stage-list">${renderStageStart('return', state.returnStages)}${state.returnStages.map((s,i)=>renderStageConnector(s, 'return', i)+renderStage(s, 'return', i, state.returnStages.length)).join('')}</div>
      ${state.returnStages.length?`<div class="routetotal">Gesamt Rückreise: ca. ${routeTotals(state.returnStages).km} km · ~${routeTotals(state.returnStages).hTxt} Std</div>`:''}
      <div class="hint">Nur ein Vorschlag — Datum & Route der Rückreise sind noch offen, alles anpassbar.</div>
    </div>`;
}
function selectRoute(id){
  if(state.selectedRoute === id) return;
  const prev = state.selectedRoute;
  state.selectedRoute = id;
  logChange('hat Route „' + (state.routes.find(r=>r.id===id)?.name||'?') + '" als Favorit gewählt', {t:'routeSel', prev});
  save(); renderAll();
}
// Luftlinie in km (Haversine) — Grundlage für die Offline-Schätzung von Strecken.
function haversineKm(a, b){
  const R=6371, toR=Math.PI/180;
  const dLat=(b.lat-a.lat)*toR, dLng=(b.lng-a.lng)*toR;
  const h=Math.sin(dLat/2)**2 + Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
// Grobe Fahr-Schätzung ohne Netz: Luftlinie × 1,25 Straßenfaktor, Ø ~80 km/h.
// Distanz und Fahrzeit werden immer in den Standard-Einheiten km / Std gespeichert.
function estimateLeg(fromPt, toPt){
  if(!fromPt || !toPt) return null;
  const road = haversineKm(fromPt, toPt)*1.25;
  if(road < 1) return null;
  const km = road<100 ? Math.max(5,Math.round(road/5)*5) : Math.round(road/10)*10;
  const h = road/80;
  const time = '~'+formatDecimal(Math.max(0.25,Math.round(h*4)/4))+' Std';
  return {km:'~'+km+' km', time};
}
// Von-Position einer (neuen) Etappe fürs Schätzen: entspricht das "Von" noch dem
// Ziel der Vorgänger-Etappe, deren (ggf. manuell gesetzte) Position nutzen — sonst
// eigene fromLat/fromLng (erste Etappe) bzw. GEO-Lexikon über den Text.
function stageFromPoint(prevStage, s){
  if(prevStage && prevStage.to === s.from) return pointOf(prevStage, prevStage.to);
  return pointOf({lat:s.fromLat, lng:s.fromLng}, s.from);
}
// Fehlen Distanz UND Fahrzeit, aus den Endpunkten vorbelegen (falls auflösbar).
// s.est = true markiert automatisch geschätzte km/Fahrzeit: nur solche Werte
// dürfen bei späteren Umstellungen (Verschieben/Einfügen/Löschen) automatisch
// aktualisiert werden — handeingetragene Werte werden nie angefasst.
function autoEstimateStage(s, prevStage){
  if(s.km || s.time) return;
  const est = estimateLeg(stageFromPoint(prevStage, s), pointOf(s, s.to));
  if(est){ s.km = est.km; s.time = est.time; s.est = true; }
}
function formatDecimal(n){ return String(Math.round(Number(n)*100)/100).replace('.',','); }
function parseTripDateInput(value){
  const m = String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return d.getFullYear()===+m[1] && d.getMonth()===+m[2]-1 && d.getDate()===+m[3] ? d : null;
}
function stageDateInputValue(str){
  const d = parseStageDate(str);
  if(!d) return '';
  const pad = n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function stageMetricNumber(value, kind){
  const s = String(value||'').trim();
  if(!s) return null;
  if(kind==='time') return stageHours(s);
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',','.')) : null;
}
function formatStageUnit(value, unit, approx=false){
  const n = Number(value);
  if(!isFinite(n)) return '';
  return (approx?'~':'')+formatDecimal(n)+' '+unit;
}
function stripApprox(value){ return String(value||'').replace(/^~\s*/, ''); }
function normalizeStageFields(stage){
  if(!stage || typeof stage!=='object') return stage;
  const date = parseStageDate(stage.date);
  if(date) stage.date = fmtStageDate(date);
  const km = stageMetricNumber(stage.km, 'km');
  if(km!=null) stage.km = formatStageUnit(km, 'km', !!stage.est||String(stage.km||'').trim().startsWith('~'));
  const hours = stageMetricNumber(stage.time, 'time');
  if(hours!=null) stage.time = formatStageUnit(hours, 'Std', !!stage.est||String(stage.time||'').trim().startsWith('~'));
  return stage;
}
// Etappen-Datum "So 02.08.", "02.08" oder ISO ↔ Date (Reisejahr 2026).
function parseStageDate(str){
  const iso = parseTripDateInput(str);
  if(iso) return iso;
  const m = String(str||'').match(/(?:^|\s)(\d{1,2})\.(\d{1,2})(?:\.|$)/);
  if(!m) return null;
  const d = new Date(2026, +m[2]-1, +m[1]);
  return d.getFullYear()===2026 && d.getMonth()===+m[2]-1 && d.getDate()===+m[1] ? d : null;
}
function fmtStageDate(d){
  const pad = n=>String(n).padStart(2,'0');
  return ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()]+' '+pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.';
}
// Folgetag der Vorgänger-Etappe als Datums-Vorschlag.
function nextStageDate(prevDate){
  const d = parseStageDate(prevDate);
  if(!d) return '';
  d.setDate(d.getDate()+1);
  return fmtStageDate(d);
}
// Koordinaten aus einem eingefügten Google-Maps-Link ziehen (…!3d44.4!4d8.9…,
// „@44.4,8.9", „q=44.4,8.9" / „query=44.4,8.9"). !3d/!4d zuerst — das ist der
// Marker selbst, „@" nur die Kartenmitte. Kein Treffer ⇒ null.
function coordsFromLink(url){
  const s = String(url||'');
  const m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    || s.match(/[?&]q(?:uery)?=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i);
  return m ? {lat:+m[1], lng:+m[2]} : null;
}
// Nach dem Speichern: keine Position gesetzt, aber der Karten-Link enthält
// Koordinaten ⇒ automatisch übernehmen (die häufigste Realität: jemand teilt
// einen Google-Maps-Link in der Gruppe, niemand tippt die Mini-Karte an).
function applyLinkCoords(target){
  if(target.lat != null) return;
  const c = coordsFromLink(target.link);
  if(c){ target.lat = c.lat; target.lng = c.lng; }
}
// isFirst: bei der allerersten Etappe einer Liste gibt es noch keine Vorgänger-
// Etappe, deren Ziel-Position als "Von" übernommen werden könnte — dafür zusätzlich
// ein Positionsfeld für den Startpunkt selbst (sonst landet er nur als Text ohne
// Karten-Marker, siehe routePts()).
function stageFields(s={}, isFirst=false){
  const stored = (s.lat!=null && s.lng!=null) ? {lat:+s.lat, lng:+s.lng} : null;
  const auto = stored ? null : (()=>{ const g=geoLookup(s.to); return g?{lat:g[0],lng:g[1]}:null; })();
  const places = placeSuggestions();
  const kmValue = stageMetricNumber(s.km, 'km');
  const timeValue = stageMetricNumber(s.time, 'time');
  const fields = [
    {key:'date',label:'Datum',type:'tripDate',value:stageDateInputValue(s.date),legacyValue:s.date&&!parseStageDate(s.date)?s.date:''},
    {key:'from',label:'Von',value:s.from||'',datalist:places},
  ];
  if(isFirst){
    const fromStored = (s.fromLat!=null && s.fromLng!=null) ? {lat:+s.fromLat, lng:+s.fromLng} : null;
    const fromAuto = fromStored ? null : (()=>{ const g=geoLookup(s.from); return g?{lat:g[0],lng:g[1]}:null; })();
    fields.push({key:'posFrom',label:'Start-Position auf der Karte',type:'map',value:fromStored,auto:fromAuto});
  }
  fields.push(
    {key:'to',label:'Nach',value:s.to||'',datalist:places},
    {key:'km',label:'Distanz',type:'unit',unit:'km',step:'1',value:kmValue,legacyValue:kmValue==null?s.km:'',approx:!!s.est||String(s.km||'').trim().startsWith('~'),placeholder:'300'},
    {key:'time',label:'Fahrzeit',type:'unit',unit:'Std',step:'0.25',value:timeValue,legacyValue:timeValue==null?s.time:'',approx:!!s.est||String(s.time||'').trim().startsWith('~'),placeholder:'3,5'},
    {key:'stay',label:'Übernachtung',value:s.stay||'',placeholder:'z. B. Camping am See'},
    {key:'note',label:'Notizen',type:'textarea',value:s.note||''},
    {key:'link',label:'Karten-Link (optional, sonst automatisch)',value:s.link||'',placeholder:'https://…'},
    {key:'pos',label:'Ziel-Position auf der Karte',type:'map',value:stored,auto},
  );
  return fields;
}
// Einstieg für "+ Etappe": eine Liste mit "manuell eintragen" oben angepinnt,
// darunter alle Spots zur Übernahme (Name, Position & Link werden vorausgefüllt).
// Eigenes Popup statt openModal (modalSave() ruft nach onSave() immer closeModal()
// auf — ein zweites openModal() direkt daraus würde vom eigenen Schließen sofort
// wieder zugeklappt).
function openStageChooser(ref, insertAt=null){
  modalCtx = null;
  // Spots nach Umweg sortieren: das Etappen-Umfeld ist bekannt (A = Ziel der
  // Vorgänger-Etappe, B = Ziel der bisher folgenden beim Einfügen) — der Umweg
  // A→Spot→B minus A→B (Luftlinie × Straßenfaktor) macht aus der Liste eine
  // echte Empfehlung "liegt praktisch auf dem Weg". Ohne Positionsdaten
  // bleibt die bisherige Sortierung nach Sternen, diese Spots stehen hinten.
  const list = getStageList(ref);
  const prev = insertAt!=null ? list[insertAt-1] : list[list.length-1];
  const next = insertAt!=null ? list[insertAt] : null;
  const A = prev ? pointOf(prev, prev.to) : null;
  const B = next ? pointOf(next, next.to) : null;
  const spots = sortedSpots().map(sp=>{
    const p = pointOf(sp, sp.name);
    let detour = null;
    if(p && A && B) detour = Math.max(0, (haversineKm(A,p)+haversineKm(p,B)-haversineKm(A,B))*1.25);
    else if(p && A) detour = haversineKm(A,p)*1.25;
    return {sp, detour};
  }).sort((a,b)=>{
    if(a.detour==null && b.detour==null) return 0;
    if(a.detour==null) return 1;
    if(b.detour==null) return -1;
    return a.detour-b.detour;
  });
  const badge = d => d==null ? '' :
    `<span>${B?'~+':'~'}${d<100?Math.max(5,Math.round(d/5)*5):Math.round(d/10)*10} km${B?' Umweg':''}</span>`;
  document.getElementById('modalBox').innerHTML = `
    <h3>${insertAt!=null?'Stopp einfügen':'Neue Etappe'}</h3>
    <p class="hint" style="margin:0 0 12px">${insertAt!=null?'Wird zwischen die beiden Etappen eingefügt. ':''}Manuell eintragen oder einen vorhandenen Spot übernehmen — ${A?'sortiert nach '+(B?'Umweg':'Entfernung')+', ':''}Name, Position und Karten-Link werden vorausgefüllt.</p>
    <div class="spotpick-list">
      <button type="button" class="spotpick-item manual" onclick="closeModal();addStage('${ref}',${insertAt})">
        <b>✎ Manuell eintragen</b>
      </button>
      ${spots.map(({sp, detour})=>`
        <button type="button" class="spotpick-item" onclick="addStageFromSpot('${ref}','${sp.id}',${insertAt})">
          <b>📍 ${esc(sp.name)}</b>
          ${badge(detour) || (sp.region?`<span>${esc(sp.region)}</span>`:'')}
        </button>`).join('')}
    </div>
    <div class="btnrow"><button class="btn ghost" onclick="closeModal()">Abbrechen</button></div>`;
  document.getElementById('modalBg').classList.add('open');
}
// Etappe s wird an Position insertAt eingefügt statt angehängt: die bisher dort
// stehende Etappe rückt weiter und ihr "Von" wird an das neue Ziel angeglichen —
// ihre Distanz/Fahrzeit galt für die jetzt nicht mehr existierende, längere Strecke
// und wird zurückgesetzt statt eine falsche Zahl stehen zu lassen. Beides zusammen
// ein Verlaufseintrag, damit "Rückgängig" beides in einem Schritt umkehrt.
function insertStageAt(ref, insertAt, s){
  const list = getStageList(ref);
  const following = list[insertAt];
  let followFix = null;
  if(following){
    followFix = {id:following.id, prevFrom:following.from, prevKm:following.km, prevTime:following.time, prevEst:following.est};
    following.from = s.to;
    const est = estimateLeg(pointOf(s, s.to), pointOf(following, following.to));
    following.km = est ? est.km : '';
    following.time = est ? est.time : '';
    if(est) following.est = true; else delete following.est;
  }
  list.splice(insertAt, 0, s);
  logChange('hat Etappe „'+s.from+' → '+s.to+'" eingefügt', {t:'stageInsert', ref, id:s.id, followFix});
  if(following) toast(following.km
    ? 'Distanz/Fahrzeit zur nächsten Etappe „'+following.to+'" geschätzt — bitte prüfen'
    : 'Distanz/Fahrzeit zur nächsten Etappe „'+following.to+'" bitte prüfen');
}
function addStage(ref, insertAt=null){
  const list = getStageList(ref);
  const isFirst = (insertAt!=null ? insertAt : list.length) === 0;
  const prevStage = insertAt!=null ? list[insertAt-1] : list[list.length-1];
  openModal('Neue Etappe', stageFields({from: prevStage ? prevStage.to : '', date: prevStage ? nextStageDate(prevStage.date) : ''}, isFirst), v=>{
    const {pos, posFrom, ...rest} = v;
    const s = {id:uid(), ...rest};
    applyPos(s, pos);
    applyLinkCoords(s);
    if(isFirst) applyPos(s, posFrom, ['fromLat','fromLng']);
    autoEstimateStage(s, prevStage);
    if(insertAt!=null){ insertStageAt(ref, insertAt, s); return; }
    list.push(s);
    logChange('hat Etappe „'+s.from+' → '+s.to+'" hinzugefügt', {t:'stageAdd', ref, id:s.id});
  });
}
function addStageFromSpot(ref, spotId, insertAt=null){
  const sp = state.spots.find(s=>s.id===spotId);
  if(!sp) return;
  closeModal();
  const list = getStageList(ref);
  const isFirst = (insertAt!=null ? insertAt : list.length) === 0;
  const prevStage = insertAt!=null ? list[insertAt-1] : list[list.length-1];
  const prefill = {
    from: prevStage ? prevStage.to : '',
    date: prevStage ? nextStageDate(prevStage.date) : '',
    to: sp.name,
    link: sp.link || '',
    note: [sp.detour?'🛣️ '+sp.detour:'', sp.desc||''].filter(Boolean).join('\n\n'),
    lat: sp.lat, lng: sp.lng,
  };
  openModal('Neue Etappe aus Spot', stageFields(prefill, isFirst), v=>{
    const {pos, posFrom, ...rest} = v;
    const s = {id:uid(), ...rest};
    applyPos(s, pos);
    applyLinkCoords(s);
    if(isFirst) applyPos(s, posFrom, ['fromLat','fromLng']);
    autoEstimateStage(s, prevStage);
    if(insertAt!=null){ insertStageAt(ref, insertAt, s); return; }
    list.push(s);
    logChange('hat Etappe „'+s.from+' → '+s.to+'" aus Spot „'+sp.name+'" hinzugefügt', {t:'stageAdd', ref, id:s.id});
  });
}
function editStage(ref, idx){
  const list = getStageList(ref);
  const s = list[idx];
  const isFirst = idx===0;
  openModal('Etappe bearbeiten', stageFields(s, isFirst), v=>{
    const prev = {date:s.date, from:s.from, to:s.to, km:s.km, time:s.time, stay:s.stay, note:s.note, link:s.link, lat:s.lat, lng:s.lng, fromLat:s.fromLat, fromLng:s.fromLng, est:s.est};
    const {pos, posFrom, ...rest} = v;
    // Hand angefasste km/Fahrzeit sind ab jetzt manuell — nie mehr automatisch überschreiben
    if(rest.km !== prev.km || rest.time !== prev.time){
      delete s.est;
      rest.km = stripApprox(rest.km);
      rest.time = stripApprox(rest.time);
    }
    Object.assign(s, rest);
    applyPos(s, pos);
    applyLinkCoords(s);
    if(isFirst) applyPos(s, posFrom, ['fromLat','fromLng']);
    logChange('hat Etappe „'+s.from+' → '+s.to+'" bearbeitet', {t:'stageEdit', ref, id:s.id, prev});
    maybeOfferDateShift(ref, s.id, prev.date, s.date);
  }, ()=>{
    const following = list[idx+1];
    let followFix = null;
    if(following){
      followFix = {id:following.id, prevFrom:following.from, prevKm:following.km, prevTime:following.time, prevFromLat:following.fromLat, prevFromLng:following.fromLng, prevEst:following.est};
      following.from = idx>0 ? list[idx-1].to : s.from;
      if(idx===0){ following.fromLat = s.fromLat; following.fromLng = s.fromLng; }
      const newPrevPt = idx>0 ? pointOf(list[idx-1], list[idx-1].to) : pointOf({lat:s.fromLat,lng:s.fromLng}, s.from);
      const est = estimateLeg(newPrevPt, pointOf(following, following.to));
      following.km = est ? est.km : '';
      following.time = est ? est.time : '';
      if(est) following.est = true; else delete following.est;
    }
    logChange('hat Etappe „'+s.from+' → '+s.to+'" gelöscht'+(following?(following.km?' (Distanz zur nächsten Etappe neu geschätzt)':' (Distanz zur nächsten Etappe zurückgesetzt)'):''), {t:'stageDel', ref, stage:{...s}, idx, followFix});
    list.splice(idx,1);
  });
}
function moveStage(ref, idx, dir){
  const list = getStageList(ref);
  const prevList = copyData(list); // kompletter Vorher-Stand für sauberes Rückgängig
  const start = {from:list[0].from, fromLat:list[0].fromLat, fromLng:list[0].fromLng};
  const [s] = list.splice(idx,1);
  list.splice(idx+dir,0,s);
  // Nach dem Verschieben die ganze Kette reparieren: "Von" folgt wieder dem
  // Vorgänger-Ziel, der Routen-Startpunkt bleibt an Position 0. Automatisch
  // geschätzte km/Fahrzeit (est-Flag) werden neu gerechnet — handeingetragene
  // Werte bleiben unangetastet (können also veraltet sein: bewusster Tausch).
  list.forEach((st, i)=>{
    if(i===0){
      st.from = start.from;
      if(start.fromLat!=null){ st.fromLat = start.fromLat; st.fromLng = start.fromLng; }
      else { delete st.fromLat; delete st.fromLng; }
    } else {
      st.from = list[i-1].to;
      delete st.fromLat; delete st.fromLng;
    }
    if(st.est){
      const fromPt = i===0 ? pointOf({lat:st.fromLat,lng:st.fromLng}, st.from) : pointOf(list[i-1], list[i-1].to);
      const est = estimateLeg(fromPt, pointOf(st, st.to));
      if(est){ st.km = est.km; st.time = est.time; } else { st.km=''; st.time=''; delete st.est; }
    }
  });
  logChange('hat Etappe „'+s.to+'" verschoben (Verkettung angepasst)', {t:'stageListRestore', ref, list:prevList});
  save(); renderAll();
}
// Datum einer Etappe geändert ⇒ anbieten, alle folgenden um dieselbe Differenz zu
// verschieben (z. B. eine Nacht länger bleiben). Bewusst opt-in per Toast statt
// automatisch — eine absichtliche Einzel-Korrektur soll nichts stillschweigend kaskadieren.
function maybeOfferDateShift(ref, stageId, oldDate, newDate){
  const d0 = parseStageDate(oldDate), d1 = parseStageDate(newDate);
  if(!d0 || !d1) return;
  const diff = Math.round((d1-d0)/86400000);
  if(!diff) return;
  if(!getStageList(ref).slice(getStageList(ref).findIndex(x=>x.id===stageId)+1).some(x=>parseStageDate(x.date))) return;
  toast('Datum um '+Math.abs(diff)+' Tag'+(Math.abs(diff)===1?'':'e')+' '+(diff>0?'nach hinten':'nach vorn'), 'Folgende anpassen', ()=>{
    // Zum Klick-Zeitpunkt frisch auflösen — zwischen Toast und Klick kann ein
    // Cloud-Sync den State ersetzt haben, alte Objekt-Referenzen wären dann tot.
    const list = getStageList(ref);
    const idx = list.findIndex(x=>x.id===stageId);
    if(idx<0){ toast('Etappe existiert nicht mehr'); return; }
    const following = list.slice(idx+1).filter(x=>parseStageDate(x.date));
    if(!following.length) return;
    const prevDates = following.map(x=>({id:x.id, date:x.date}));
    following.forEach(x=>{
      const d = parseStageDate(x.date);
      d.setDate(d.getDate()+diff);
      x.date = fmtStageDate(d);
    });
    logChange('hat die Daten von '+following.length+' folgenden Etappen um '+diff+' Tag'+(Math.abs(diff)===1?'':'e')+' verschoben', {t:'datesShift', ref, prevDates});
    save(); renderAll();
  });
}

/* ============================================================
   SPOTS + VOTING
   ============================================================ */
function sortedSpots(){
  return [...state.spots].sort((a,b)=>b.votes.length - a.votes.length);
}
function renderSpots(){
  const allSpots = sortedSpots();
  const spots = allSpots.filter(sp=>spotTypeFilter.has(sp.type||'day'));
  document.getElementById('page-spots').innerHTML = sectionBackButton() + `
    <div class="card">
      <h2>🗺️ Spots auf der Karte</h2>
      ${buildSpotsMap(spots)}
      <div class="layerchips">
        ${Object.entries(SPOT_TYPES).map(([key,t])=>`<span class="lchip${spotTypeFilter.has(key)?' on':''}" style="--c:${t.color}" onclick="toggleSpotTypeFilter('${key}')"><span class="swatch"></span>${t.icon} ${esc(t.label)}</span>`).join('')}
      </div>
      <div class="hint">Rauten = Spots (Nummern wie in der Liste unten), Farbe nach Art (s. o.) · Linie = gewählte Route. Art antippen blendet sie auf Karte + Liste aus. Position eines Spots per ✎ → Karte antippen setzen. Getaggte Orte der Gruppe: <a href="https://maps.app.goo.gl/JnPwkaBY46XwAN8g7?g_st=iw" target="_blank" rel="noopener" style="color:var(--sky)">Google-Maps-Liste öffnen ↗</a> (braucht Internet).</div>
    </div>
    <div class="card">
      <h2>📍 Spot-Ideen unterwegs <span class="spacer"></span><button class="btn small" onclick="addSpot()">+ Spot</button></h2>
      <p class="hint" style="margin:0 0 12px">Markiere mit ⭐ alle Spots, die du besuchen möchtest — so viele wie du willst. Sortiert nach Anzahl Sterne, zeigt die Favoriten der Gruppe.</p>
      ${allSpots.length && !spots.length ? '<div class="route-empty"><b>Keine Spots dieser Art</b><p class="hint" style="margin:5px 0 0">Alle Spots sind über die Karte ausgeblendet — oben eine Art antippen, um sie wieder zu zeigen.</p></div>' : ''}
      ${spots.map((sp,i)=>{
        const me = whoami();
        const mine = me && sp.votes.includes(me);
        const voters = sp.votes.map(cid=>crewById(cid)).filter(Boolean);
        return `
        <div class="spot" id="spot-${sp.id}">
          <div class="head">
            <span class="spotnum"><b>${i+1}</b></span>
            <h3>${esc(sp.name)}</h3>
            <span class="region">${esc(sp.region)}</span>
            <span style="margin-left:auto"><button class="btn ghost small" onclick="editSpot('${sp.id}')">✎</button></span>
          </div>
          <span class="spottype" style="--c:${spotType(sp).color}">${spotType(sp).icon} ${esc(spotType(sp).label)}</span>
          <div class="desc">${esc(sp.desc)}</div>
          <div class="meta" style="display:flex;gap:14px;font-size:12.5px;color:var(--muted);margin-bottom:9px">
            ${sp.detour?`<span>🛣️ ${esc(sp.detour)}</span>`:''}
            ${sp.link?`<a class="maplink" href="${esc(sp.link)}" target="_blank" rel="noopener">🗺️ Karte</a>`:''}
          </div>
          <div class="foot">
            <div class="chips">
              ${voters.length ? voters.map(c=>`<span class="chip on static" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span>`).join('') : '<span class="hint" style="margin:0">Noch keine Stimmen</span>'}
            </div>
            <span class="votecount">${sp.votes.length} ⭐</span>
            <button class="btn small${mine?' primary':' ghost'}" onclick="voteSpot('${sp.id}')">${mine?'★ Markiert':'⭐ Merken'}</button>
          </div>
        </div>`;}).join('')}
    </div>`;
}
// Popup beim Antippen eines Spot-Markers auf der Karte: Info, Google-Maps-Link,
// Sprung zur Spot-Liste. Nutzt das generische #modalBg/#modalBox (modalCtx=null,
// da kein Formular — modalSave() wird hier nie aufgerufen).
function openSpotInfo(id){
  const sp = state.spots.find(s=>s.id===id);
  if(!sp){ toast('Dieser Spot wurde entfernt'); return; }
  const voters = sp.votes.map(cid=>state.crew.find(c=>c.id===cid)).filter(Boolean);
  const mapsUrl = sp.link ? sp.link
    : (sp.lat!=null && sp.lng!=null) ? `https://www.google.com/maps?q=${sp.lat},${sp.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sp.name + (sp.region?', '+sp.region:''))}`;
  modalCtx = null;
  document.getElementById('modalBox').innerHTML = `
    <h3>📍 ${esc(sp.name)}</h3>
    ${sp.region?`<div style="font-size:12px;color:var(--sun);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin:-10px 0 12px">${esc(sp.region)}</div>`:''}
    <span class="spottype" style="--c:${spotType(sp).color}">${spotType(sp).icon} ${esc(spotType(sp).label)}</span>
    ${sp.desc?`<p style="font-size:13.5px;color:var(--muted);margin:12px 0 12px">${esc(sp.desc)}</p>`:''}
    ${sp.detour?`<p class="hint" style="margin:0 0 12px">🛣️ ${esc(sp.detour)}</p>`:''}
    <div class="foot" style="margin-bottom:4px">
      <div class="chips">${voters.length ? voters.map(c=>`<span class="chip on" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span>`).join('') : '<span class="hint" style="margin:0">Noch keine Stimmen</span>'}</div>
      <span class="votecount">${sp.votes.length} ⭐</span>
    </div>
    <div class="btnrow"><a class="btn ghost" href="${esc(mapsUrl)}" target="_blank" rel="noopener">🗺️ Google Maps öffnen</a></div>
    <div class="btnrow">
      <button class="btn ghost" onclick="closeModal()">Schließen</button>
      <button class="btn primary" onclick="goToSpotInList('${sp.id}')">Zur Spot-Liste</button>
    </div>`;
  document.getElementById('modalBg').classList.add('open');
}
function goToSpotInList(id){
  closeModal();
  closeBigMap();
  switchTab('spots');
  const el = document.getElementById('spot-'+id);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.classList.add('map-flash');
  setTimeout(()=>el.classList.remove('map-flash'), 1600);
}
// Jede Person kann beliebig viele Spots markieren (Stern an/aus, identifiziert über
// whoami()) — die Liste soll am Ende zeigen, welche Spots die meiste Zustimmung
// haben, nicht wer sich für einen einzigen entscheidet.
function voteSpot(spotId){
  const me = whoami();
  if(!me){ askWho(); return; }
  const sp = state.spots.find(s=>s.id===spotId);
  if(!sp) return;
  const i = sp.votes.indexOf(me);
  const had = i>=0;
  if(had) sp.votes.splice(i,1); else sp.votes.push(me);
  logChange(had ? 'hat den Stern bei „'+sp.name+'" entfernt' : 'hat „'+sp.name+'" markiert',
    {t:'vote', spotId, crewId:me, prev:had}, me);
  save(); renderAll();
}
function spotFields(s={}){
  const stored = (s.lat!=null && s.lng!=null) ? {lat:+s.lat, lng:+s.lng} : null;
  const auto = stored ? null : (()=>{ const g=geoLookup(s.name); return g?{lat:g[0],lng:g[1]}:null; })();
  return [
    {key:'name',label:'Name',value:s.name||'',datalist:placeSuggestions()},
    {key:'region',label:'Region',value:s.region||''},
    {key:'type',label:'Art des Spots',type:'select',value:s.type||'day',options:[
      {value:'day',label:'☀️ Tagesausflug'},
      {value:'camp',label:'⛺ Camping / Übernachtung'},
      {value:'both',label:'🌗 Beides'},
    ]},
    {key:'detour',label:'Umweg / Aufwand',value:s.detour||'',placeholder:'z. B. +45 Min'},
    {key:'desc',label:'Beschreibung',type:'textarea',value:s.desc||''},
    {key:'link',label:'Karten-Link',value:s.link||'',placeholder:'https://maps.google.com/…'},
    {key:'pos',label:'Position auf der Karte',type:'map',value:stored,auto},
  ];
}
function addSpot(){
  openModal('Neuer Spot', spotFields(), v=>{
    const {pos, ...rest} = v;
    const sp = {id:uid(), votes:[], ...rest};
    applyPos(sp, pos);
    applyLinkCoords(sp);
    state.spots.push(sp);
    logChange('hat Spot „'+sp.name+'" hinzugefügt', {t:'spotAdd', id:sp.id});
  });
}
function editSpot(id){
  const sp = state.spots.find(s=>s.id===id);
  openModal('Spot bearbeiten', spotFields(sp), v=>{
    const prev = {name:sp.name, region:sp.region, type:sp.type, detour:sp.detour, desc:sp.desc, link:sp.link, lat:sp.lat, lng:sp.lng};
    const {pos, ...rest} = v;
    Object.assign(sp, rest);
    applyPos(sp, pos);
    applyLinkCoords(sp);
    logChange('hat Spot „'+sp.name+'" bearbeitet', {t:'spotEdit', id, prev});
  }, ()=>{
    const idx = state.spots.findIndex(s=>s.id===id);
    logChange('hat Spot „'+sp.name+'" gelöscht', {t:'spotDel', spot:{...sp}, idx});
    state.spots = state.spots.filter(s=>s.id!==id);
  });
}

/* ============================================================
   LOGISTIK
   ============================================================ */
function renderLogistics(){
  document.getElementById('page-logistik').innerHTML = sectionBackButton() + `
    ${state.vehicles.map(v=>`
      <div class="card">
        <h2>${v.id==='v-camper'?'🚐':'🚗'} ${esc(v.name)} <span class="spacer"></span><button class="btn ghost small" onclick="editVehicle('${v.id}')">✎</button></h2>
        <div class="factrow"><span class="k">Start</span><span class="v">${esc(v.pickup)}</span></div>
        ${v.id==='v-camper'?`<div class="factrow"><span class="k">Camperdaten</span><span class="v">${esc([v.model,v.lengthM&&'L '+v.lengthM+' m',v.widthM&&'B '+v.widthM+' m',v.heightM&&'H '+v.heightM+' m',v.registration].filter(Boolean).join(' · ')||'Noch nicht vollständig')}</span></div>`:''}
        ${v.notes?`<div class="factrow"><span class="k">Notizen</span><span class="v">${esc(v.notes)}</span></div>`:''}
        <div style="margin:12px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Fahrer (antippen)</div>
        <div class="chips">
          ${state.crew.map(c=>`<span class="chip${v.drivers.includes(c.id)?' on':''}" style="--c:${c.color}" onclick="toggleDriver('${v.id}','${c.id}')"><span class="dot"></span>${v.drivers.includes(c.id)?'🚙 ':''}${esc(c.name)}</span>`).join('')}
        </div>
        <div style="margin:14px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Mitfahrer (antippen zum Zuordnen)</div>
        <div class="chips">
          ${state.crew.map(c=>`<span class="chip${v.passengers.includes(c.id)?' on':''}" style="--c:${c.color}" onclick="togglePassenger('${v.id}','${c.id}')"><span class="dot"></span>${esc(c.name)}</span>`).join('')}
        </div>
        <div style="margin:16px 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Dokumente & Vorbereitung</div>
        <div class="list">${v.docs.map(d=>itemRow(d, `vdoc:${v.id}`)).join('')}</div>
        <div class="addrow"><input id="add-vdoc-${v.id}" placeholder="Neuer Punkt…" onkeydown="if(event.key==='Enter')addListItem('vdoc:${v.id}')"><button class="btn" onclick="addListItem('vdoc:${v.id}')">+</button><button class="btn ghost" onclick="addListItemsBulk('vdoc:${v.id}')" title="Mehrere auf einmal hinzufügen">☰</button></div>
      </div>`).join('')}

    <div class="card">
      <h2>✅ Checkliste vor Abfahrt</h2>
      <div class="list">${state.checklist.map(d=>itemRow(d, 'checklist')).join('')}</div>
      <div class="addrow"><input id="add-checklist" placeholder="Neuer Punkt…" onkeydown="if(event.key==='Enter')addListItem('checklist')"><button class="btn" onclick="addListItem('checklist')">+</button><button class="btn ghost" onclick="addListItemsBulk('checklist')" title="Mehrere auf einmal hinzufügen">☰</button></div>
    </div>`;
}
function editVehicle(id){
  const v = state.vehicles.find(x=>x.id===id);
  openModal('Fahrzeug bearbeiten', [
    {key:'name',label:'Bezeichnung',value:v.name},
    {key:'pickup',label:'Start / Übernahme',value:v.pickup},
    ...(v.id==='v-camper'?[
      {key:'model',label:'Modell / Typ',value:v.model||''},{key:'lengthM',label:'Länge in Metern',value:v.lengthM||'',placeholder:'z. B. 6,40'},
      {key:'widthM',label:'Breite in Metern',value:v.widthM||''},{key:'heightM',label:'Höhe in Metern',value:v.heightM||''},{key:'registration',label:'Kennzeichen',value:v.registration||''}
    ]:[]),
    {key:'notes',label:'Notizen',type:'textarea',value:v.notes},
  ], val=>{
    const prev = {name:v.name, pickup:v.pickup, notes:v.notes,model:v.model||'',lengthM:v.lengthM||'',widthM:v.widthM||'',heightM:v.heightM||'',registration:v.registration||''};
    Object.assign(v,val);
    logChange('hat Fahrzeug „'+v.name+'" bearbeitet', {t:'vehEdit', vid:id, prev});
  });
}
function togglePassenger(vid, cid){
  // Eine Person sitzt in genau einem Fahrzeug: woanders austragen
  const v = state.vehicles.find(x=>x.id===vid);
  const prevVid = state.vehicles.find(o=>o.passengers.includes(cid))?.id || null;
  const name = crewById(cid)?.name || '?';
  const i = v.passengers.indexOf(cid);
  if(i>=0){
    v.passengers.splice(i,1);
    logChange('hat '+name+' aus „'+v.name+'" ausgetragen', {t:'pass', cid, prevVid});
  } else {
    state.vehicles.forEach(o=>{ const j=o.passengers.indexOf(cid); if(j>=0) o.passengers.splice(j,1); });
    v.passengers.push(cid);
    logChange('hat '+name+' in „'+v.name+'" gesetzt', {t:'pass', cid, prevVid});
  }
  save(); renderAll();
}
function toggleDriver(vid, cid){
  const v = state.vehicles.find(x=>x.id===vid);
  const i = v.drivers.indexOf(cid);
  const was = i>=0;
  if(was) v.drivers.splice(i,1); else v.drivers.push(cid);
  logChange((crewById(cid)?.name||'?') + (was?' ist kein Fahrer mehr von „':' ist jetzt Fahrer von „') + v.name + '"',
    {t:'driver', vid, cid, prev:was});
  save(); renderAll();
}

/* ============================================================
   GENERISCHE LISTEN (Packen / Einkauf / Checklisten)
   listRef: 'checklist' | 'vdoc:<vehicleId>' | 'pack:<catId>' | 'shop:<catId>'
   ============================================================ */
function resolveList(ref){
  if(ref==='checklist') return state.checklist;
  const [kind, id] = ref.split(':');
  if(kind==='vdoc') return state.vehicles.find(v=>v.id===id).docs;
  if(kind==='pack') return state.packing.find(c=>c.id===id).items;
  if(kind==='shop') return state.shopping.find(c=>c.id===id).items;
  return null;
}
function itemKey(ref, id){ return ref.replace(/[^a-z0-9_-]/gi,'-') + '--' + id; }
function copyData(x){ return JSON.parse(JSON.stringify(x)); }
function itemAssignees(item){ normalizeListItem(item); return item.assignees || []; }
function itemComplete(item){
  const ids = itemAssignees(item);
  if(ids.length <= 1) return !!item.done;
  return ids.every(id=>(item.doneBy||[]).includes(id));
}
function updateMultiDone(item){
  item.doneBy = (item.doneBy || []).filter(id=>itemAssignees(item).includes(id));
  item.done = itemComplete(item);
}
function listItemByRef(ref, id){
  const list = resolveList(ref);
  return list ? list.find(i=>i.id===id) : null;
}
function tabForListRef(ref){
  if(ref.startsWith('pack:')) return 'packen';
  if(ref.startsWith('shop:')) return 'einkauf';
  return 'logistik';
}
function linkedReminder(ref, itemId){
  return (state.reminders||[]).find(r=>!r.done && r.link && r.link.type==='listItem' && r.link.ref===ref && r.link.itemId===itemId);
}
function syncLinkedReminder(ref, item){
  const r = linkedReminder(ref, item.id);
  if(r) r.title = item.text;
}
function itemRow(item, ref){
  normalizeListItem(item);
  const assignees = itemAssignees(item);
  const done = itemComplete(item);
  const who = assignees.length===1 ? crewById(assignees[0]) : null;
  const multi = assignees.length > 1;
  const chips = multi ? `<div class="mini-assignees">${assignees.map(id=>{
    const c = crewById(id);
    if(!c) return '';
    const isDone = (item.doneBy||[]).includes(id);
    return `<span class="chip${isDone?' done on':''}" style="--c:${c.color}" onclick="event.stopPropagation();toggleItemPerson('${ref}','${item.id}','${id}')"><span class="dot"></span>${esc(c.name)}</span>`;
  }).join('')}</div>` : '';
  return `
  <div class="item${done?' done':''}${multi?' multi':''}" data-item-key="${itemKey(ref,item.id)}">
    <button class="checkbox${done?' done':''}" onclick="toggleItem('${ref}','${item.id}')" aria-label="abhaken">${done?'✓':''}</button>
    <div class="item-main">
      <div class="item-titleline">
        <span class="txt" onclick="editItem('${ref}','${item.id}')">${esc(item.text)}</span>
        ${who?`<span class="who" style="--c:${who.color}" onclick="editItem('${ref}','${item.id}')">${esc(who.name)}</span>`:''}
      </div>
      ${chips}
    </div>
    <button class="del" onclick="deleteItem('${ref}','${item.id}')" aria-label="löschen">✕</button>
  </div>`;
}
function toggleItem(ref, id){
  const it = resolveList(ref).find(i=>i.id===id);
  normalizeListItem(it);
  const assignees = itemAssignees(it);
  if(assignees.length > 1){
    const me = whoami();
    if(!me){ askWho(); return; }
    if(!assignees.includes(me)){ toast('Dieser Eintrag ist anderen Personen zugeordnet'); return; }
    toggleItemPerson(ref, id, me);
    return;
  }
  const prev = it.done;
  it.done = !it.done;
  logChange((it.done ? 'hat „'+it.text+'" abgehakt' : 'hat den Haken bei „'+it.text+'" entfernt') + ' (' + refLabel(ref) + ')',
    {t:'toggle', ref, id, prev});
  save(); renderAll();
}
function toggleItemPerson(ref, id, cid){
  const it = resolveList(ref).find(i=>i.id===id);
  normalizeListItem(it);
  if(!itemAssignees(it).includes(cid)) return;
  const prevDoneBy = [...(it.doneBy||[])], prevDone = !!it.done;
  const idx = it.doneBy.indexOf(cid);
  if(idx>=0) it.doneBy.splice(idx,1); else it.doneBy.push(cid);
  updateMultiDone(it);
  logChange((crewById(cid)?.name||'?') + (idx>=0 ? ' hat den eigenen Haken bei „' : ' hat „') + it.text + (idx>=0 ? '" entfernt' : '" erledigt') + ' (' + refLabel(ref) + ')',
    {t:'personDone', ref, id, prevDoneBy, prevDone});
  save(); renderAll();
}
function deleteItem(ref, id){
  const list = resolveList(ref);
  const idx = list.findIndex(i=>i.id===id);
  if(idx<0) return;
  const label = list[idx].text;
  withUndo('„' + (label.length>28 ? label.slice(0,28)+'…' : label) + '" gelöscht', ()=>{
    const remIdx = (state.reminders||[]).findIndex(r=>r.link && r.link.type==='listItem' && r.link.ref===ref && r.link.itemId===id);
    const reminder = remIdx>=0 ? copyData(state.reminders[remIdx]) : null;
    logChange('hat „'+label+'" gelöscht (' + refLabel(ref) + ')', {t:'itemDel', ref, item:copyData(list[idx]), idx, reminder, reminderIdx:remIdx});
    list.splice(idx,1);
    removeLinkedReminderForItem(ref, id, false);
  });
}
function addListItem(ref){
  const input = document.getElementById('add-' + ref.replace(':','-'));
  const text = input.value.trim();
  if(!text) return;
  const item = {id:uid(), text, done:false, who:'', assignees:[], doneBy:[]};
  resolveList(ref).push(item);
  logChange('hat „'+text+'" hinzugefügt (' + refLabel(ref) + ')', {t:'itemAdd', ref, id:item.id});
  input.value = '';
  save(); renderAll();
  // Fokus zurück ins Eingabefeld für schnelles Weitertippen
  const again = document.getElementById('add-' + ref.replace(':','-'));
  if(again) again.focus();
}
// Mehrere Einträge auf einmal (z. B. eine aus WhatsApp eingefügte Liste) —
// ein Verlaufseintrag mit allen IDs, damit "Rückgängig" alle zusammen entfernt.
function addListItemsBulk(ref){
  openModal('Mehrere hinzufügen', [
    {key:'lines', label:'Einträge (einer pro Zeile)', type:'textarea', value:''},
  ], v=>{
    const lines = v.lines.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!lines.length) return;
    const list = resolveList(ref);
    const ids = lines.map(text=>{
      const item = {id:uid(), text, done:false, who:'', assignees:[], doneBy:[]};
      list.push(item);
      return item.id;
    });
    logChange('hat '+ids.length+' Einträge hinzugefügt (' + refLabel(ref) + ')', {t:'itemAddMulti', ref, ids});
  });
}
function editItem(ref, id){
  const it = resolveList(ref).find(i=>i.id===id);
  normalizeListItem(it);
  openModal('Eintrag bearbeiten', [
    {key:'text',label:'Text',value:it.text},
    {key:'assignees',label:'Zuständig',type:'crewMulti',value:itemAssignees(it)},
    {key:'reminder',label:'Aufgabe',type:'checkbox',text:'In Aufgaben anzeigen',value:!!linkedReminder(ref,id)},
  ], v=>{
    const prev = copyData(it);
    it.text = v.text.trim()||it.text;
    it.assignees = v.assignees ? v.assignees.split(',').filter(Boolean) : [];
    it.who = it.assignees.length===1 ? it.assignees[0] : '';
    it.doneBy = (it.doneBy||[]).filter(cid=>it.assignees.includes(cid));
    if(it.assignees.length <= 1) it.doneBy = [];
    updateMultiDone(it);
    if(v.reminder) ensureLinkedReminder(ref, it);
    else removeLinkedReminderForItem(ref, id, true);
    syncLinkedReminder(ref, it);
    logChange('hat „'+it.text+'" bearbeitet (' + refLabel(ref) + ')', {t:'itemEdit', ref, id, prev});
  }, ()=>{
    const l=resolveList(ref); const i=l.findIndex(x=>x.id===id);
    const remIdx = (state.reminders||[]).findIndex(r=>r.link && r.link.type==='listItem' && r.link.ref===ref && r.link.itemId===id);
    const reminder = remIdx>=0 ? copyData(state.reminders[remIdx]) : null;
    logChange('hat „'+l[i].text+'" gelöscht (' + refLabel(ref) + ')', {t:'itemDel', ref, item:copyData(l[i]), idx:i, reminder, reminderIdx:remIdx});
    l.splice(i,1);
    removeLinkedReminderForItem(ref, id, false);
  });
}

/* ============================================================
   PACKEN & EINKAUF
   ============================================================ */
function renderCategoryLists(pageId, groups, kind, addCatLabel, prefix='', hideAdd=false){
  document.getElementById(pageId).innerHTML = sectionBackButton() + prefix + groups.map(g=>{
    const p = listProgress(g.items);
    return `
    <div class="card">
      <h2>${esc(g.name)} <span class="spacer"></span><span style="font-size:12px;color:var(--faint);letter-spacing:0;text-transform:none">${p.done}/${p.total}</span></h2>
      <div class="list">${g.items.map(i=>itemRow(i, kind+':'+g.id)).join('')}</div>
      ${hideAdd?'':`<div class="addrow"><input id="add-${kind}-${g.id}" placeholder="Neuer Eintrag…" onkeydown="if(event.key==='Enter')addListItem('${kind}:${g.id}')"><button class="btn" onclick="addListItem('${kind}:${g.id}')">+</button><button class="btn ghost" onclick="addListItemsBulk('${kind}:${g.id}')" title="Mehrere auf einmal hinzufügen">☰</button></div>`}
    </div>`;
  }).join('') +
  (groups.length===0 ? '<div class="card"><p class="hint" style="margin:0">Keine Einträge für diesen Filter.</p></div>' : '') +
  (hideAdd ? '' : `<button class="btn" style="width:100%" onclick="addCategory('${kind}')">+ ${addCatLabel}</button>`);
}
function addCategory(kind){
  openModal('Neue Kategorie', [{key:'name',label:'Name der Kategorie',value:''}], v=>{
    if(!v.name.trim()) return;
    const target = kind==='pack' ? state.packing : state.shopping;
    const cat = {id:uid(), name:v.name.trim(), items:[]};
    target.push(cat);
    logChange('hat Kategorie „'+cat.name+'" angelegt ('+(kind==='pack'?'Packliste':'Einkauf')+')', {t:'catAdd', kind, id:cat.id});
  });
}
// Packlisten-Filter: nur die einer Person zugeordneten Sachen zeigen
let packFilter = '';
function setPackFilter(id){ packFilter = (packFilter===id ? '' : id); renderPacking(); }
function renderPacking(){
  const bar = `<div class="card">
    <h2>👤 Wer packt gerade?</h2>
    <div class="chips">${state.crew.map(c=>`<span class="chip${packFilter===c.id?' on':''}" style="--c:${c.color}" onclick="setPackFilter('${c.id}')"><span class="dot"></span>${esc(c.name)}</span>`).join('')}</div>
    <div class="hint">${packFilter ? 'Zeigt nur Sachen, die '+esc(crewById(packFilter)?.name||'?')+' zugeordnet sind — nochmal antippen für alle.' : 'Namen antippen, um nur die zugeordneten Sachen dieser Person zu sehen. Zuordnen: Eintrag antippen → „Wer bringt’s mit".'}</div>
  </div>`;
  let groups = state.packing;
  if(packFilter) groups = state.packing
    .map(g=>({ ...g, items: g.items.filter(i=>itemAssignees(i).includes(packFilter)) }))
    .filter(g=>g.items.length);
  renderCategoryLists('page-packen', groups, 'pack', 'Kategorie hinzufügen', bar, !!packFilter);
}
// Offene Einkaufspunkte als Text kopieren (z. B. für die Gruppe, wer gerade im Supermarkt ist)
function copyShoppingList(){
  const groups = state.shopping
    .map(g=>({name:g.name, items:g.items.filter(i=>!i.done).map(i=>i.text)}))
    .filter(g=>g.items.length);
  if(!groups.length){ toast('Einkaufsliste ist leer ✨'); return; }
  const txt = '🛒 Einkaufsliste\n' + groups.map(g=>'\n'+g.name+':\n'+g.items.map(t=>'- '+t).join('\n')).join('');
  const done = ()=>toast('Einkaufsliste kopiert — ab in die Gruppe 📋');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done, ()=>fallbackCopy(txt, done));
  } else fallbackCopy(txt, done);
}
function renderShopping(){
  const openCount = state.shopping.reduce((n,g)=>n+g.items.filter(i=>!i.done).length,0);
  const bar = `<div class="card">
    <h2>🛒 Einkaufsliste <span class="spacer"></span><button class="btn small" onclick="copyShoppingList()">📋 Teilen</button></h2>
    <p class="hint" style="margin:0">${openCount ? openCount+' offene'+(openCount===1?'r Punkt':' Punkte') : 'Alles besorgt 🎉'} — „Teilen" kopiert die offenen Punkte als Text.</p>
  </div>`;
  renderCategoryLists('page-einkauf', state.shopping, 'shop', 'Kategorie hinzufügen', bar);
}

/* ============================================================
   ERINNERUNGEN & UMFRAGEN
   ============================================================ */
function reminderMeta(r){
  const c = r.createdBy ? crewById(r.createdBy) : null;
  return (c ? c.name + ' · ' : '') + fmtLogTs(r.createdAt);
}
function reminderStatusLabel(status){return ({open:'Offen',waiting:'Wartet',decision:'Entscheidung',done:'Erledigt'})[status]||'Offen';}
function reminderStatusOptions(includeDone=false){const rows=[{value:'open',label:'Offen'},{value:'waiting',label:'Wartet auf Antwort / andere Person'},{value:'decision',label:'Entscheidung nötig'}];if(includeDone)rows.push({value:'done',label:'Erledigt'});return rows;}
function reminderOwnerOptions(){return [{value:'',label:'Noch niemand verantwortlich'},...state.crew.map(c=>({value:c.id,label:c.name}))];}
function reminderDueLabel(r,now=new Date()){
  if(!r.dueDate)return '';
  const due=new Date(r.dueDate+'T12:00:00'),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),days=Math.round((due-today)/86400000),date=due.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
  if(days<0)return `Überfällig · ${date}`;
  if(days===0)return 'Heute fällig';
  if(days===1)return 'Morgen fällig';
  return `Bis ${date}`;
}
function ensureLinkedReminder(ref, item){
  if(linkedReminder(ref, item.id)) return;
  const reminder = {id:uid(), title:item.text, done:false, status:'open', priority:false, ownerId:null, dueDate:'', note:'', createdAt:new Date().toISOString(), createdBy:whoami(), link:{type:'listItem', ref, itemId:item.id}};
  state.reminders.push(reminder);
  logChange('hat „'+item.text+'" in Aufgaben angezeigt', {t:'remAdd', id:reminder.id});
}
function removeLinkedReminderForItem(ref, itemId, withLog){
  const idx = (state.reminders||[]).findIndex(r=>r.link && r.link.type==='listItem' && r.link.ref===ref && r.link.itemId===itemId);
  if(idx<0) return;
  const reminder = copyData(state.reminders[idx]);
  state.reminders.splice(idx,1);
  if(withLog) logChange('hat Aufgabe „'+reminder.title+'" entfernt', {t:'remDel', reminder, idx});
}
function addReminder(){
  openModal('Neue Aufgabe', [
    {key:'title',label:'Was ist zu tun?',value:'',placeholder:'z. B. Tickets prüfen'},
    {key:'status',label:'Status',type:'select',value:'open',options:reminderStatusOptions(false)},
    {key:'ownerId',label:'Verantwortlich',type:'select',value:'',options:reminderOwnerOptions()},
    {key:'dueDate',label:'Fällig am',type:'isoDate',value:''},
    {key:'priority',label:'Priorität',type:'checkbox',text:'Hohe Priorität',value:false},
    {key:'note',label:'Notiz',type:'textarea',value:'',placeholder:'Optionaler Kontext oder nächster Schritt'},
  ], v=>{
    const title = v.title.trim();
    if(!title) return;
    const reminder = {id:uid(), title, done:false, status:v.status||'open', priority:!!v.priority, ownerId:v.ownerId||null, dueDate:v.dueDate||'', note:v.note.trim(), createdAt:new Date().toISOString(), createdBy:whoami()};
    state.reminders.push(reminder);
    logChange('hat Aufgabe „'+title+'“ angelegt', {t:'remAdd', id:reminder.id});
  });
}
function editReminder(id){
  const r = state.reminders.find(x=>x.id===id);
  if(!r) return;
  openModal('Aufgabe bearbeiten', [
    {key:'title',label:'Was ist zu tun?',value:r.title},
    {key:'status',label:'Status',type:'select',value:r.done?'done':r.status||'open',options:reminderStatusOptions(true)},
    {key:'ownerId',label:'Verantwortlich',type:'select',value:r.ownerId||'',options:reminderOwnerOptions()},
    {key:'dueDate',label:'Fällig am',type:'isoDate',value:r.dueDate||''},
    {key:'priority',label:'Priorität',type:'checkbox',text:'Hohe Priorität',value:!!r.priority},
    {key:'note',label:'Notiz',type:'textarea',value:r.note||'',placeholder:'Optionaler Kontext oder nächster Schritt'},
  ], v=>{
    const prev = copyData(r);
    r.title = v.title.trim() || r.title;
    r.status=v.status||'open';r.done=r.status==='done';
    if(r.done)r.previousStatus=prev.done?(prev.previousStatus||'open'):(prev.status||'open');else delete r.previousStatus;
    r.ownerId=v.ownerId||null;r.dueDate=v.dueDate||'';r.note=v.note.trim();
    r.priority = !!v.priority;
    logChange('hat Aufgabe „'+r.title+'“ bearbeitet', {t:'remEdit', id, prev});
  }, ()=>{
    const idx = state.reminders.findIndex(x=>x.id===id);
    if(idx<0) return;
    const reminder = copyData(state.reminders[idx]);
    logChange('hat Aufgabe „'+reminder.title+'" gelöscht', {t:'remDel', reminder, idx});
    state.reminders.splice(idx,1);
  });
}
function toggleReminder(id){
  const r = state.reminders.find(x=>x.id===id);
  if(!r) return;
  const prevDone=!!r.done,prevStatus=r.status||'open',prevPreviousStatus=r.previousStatus;
  r.done = !r.done;
  if(r.done){r.previousStatus=prevStatus==='done'?'open':prevStatus;r.status='done';}
  else{r.status=r.previousStatus||'open';delete r.previousStatus;}
  logChange((r.done?'hat Aufgabe erledigt: ':'hat Aufgabe wieder geöffnet: ') + '„'+r.title+'"', {t:'remToggle', id, prevDone, prevStatus, prevPreviousStatus});
  save(); renderAll();
}
function moveReminder(id, dir){
  const r = state.reminders.find(x=>x.id===id);
  if(!r) return;
  const group = state.reminders.filter(x=>!!x.done===!!r.done);
  const pos = group.findIndex(x=>x.id===id);
  const target = group[pos+dir];
  if(pos<0 || !target) return;
  const from = state.reminders.findIndex(x=>x.id===r.id);
  const to = state.reminders.findIndex(x=>x.id===target.id);
  [state.reminders[from],state.reminders[to]] = [state.reminders[to],state.reminders[from]];
  logChange('hat Aufgabe „'+r.title+'“ '+(dir<0?'nach oben':'nach unten')+' verschoben', {t:'remMove', id:r.id, otherId:target.id});
  save(); renderAll();
}
let pendingHighlightKey = '';
function openReminderLink(id){
  const r = state.reminders.find(x=>x.id===id);
  if(!r || !r.link || r.link.type!=='listItem') return;
  pendingHighlightKey = itemKey(r.link.ref, r.link.itemId);
  switchTab(tabForListRef(r.link.ref));
  setTimeout(()=>{
    const el = document.querySelector('[data-item-key="'+pendingHighlightKey+'"]');
    if(!el){ toast('Verknüpfter Eintrag nicht mehr gefunden'); return; }
    el.scrollIntoView({block:'center', behavior:'smooth'});
    el.classList.add('pulse-highlight');
    setTimeout(()=>el.classList.remove('pulse-highlight'), 2200);
  }, 120);
}
function reminderRow(r, idx, total){
  const owner=r.ownerId?crewById(r.ownerId):null,due=reminderDueLabel(r),status=r.done?'done':r.status||'open';
  return `<div class="reminder-card${r.done?' done':''}${r.priority?' priority':''}" data-reminder-id="${r.id}">
    <div class="reminder-head">
      <button class="checkbox${r.done?' done':''}" onclick="toggleReminder('${r.id}')" aria-label="Aufgabe erledigen">${r.done?'✓':''}</button>
      <div class="reminder-title"><b>${esc(r.title)}</b>${r.priority?'<span class="reminder-priority">Hohe Priorität</span>':''}<span class="reminder-status ${status}">${reminderStatusLabel(status)}</span></div>
      <span class="reminder-tools">
        <button onclick="moveReminder('${r.id}',-1)" aria-label="Aufgabe nach oben verschieben" title="nach oben"${idx===0?' disabled':''}>↑</button>
        <button onclick="moveReminder('${r.id}',1)" aria-label="Aufgabe nach unten verschieben" title="nach unten"${idx===total-1?' disabled':''}>↓</button>
        <button onclick="editReminder('${r.id}')" aria-label="Aufgabe bearbeiten" title="bearbeiten">✎</button>
      </span>
    </div>
    <div class="reminder-details">${owner?`<span class="reminder-owner" style="--c:${owner.color}"><i></i>${esc(owner.name)}</span>`:'<span>Noch niemand verantwortlich</span>'}${due?`<span class="reminder-due${due.startsWith('Überfällig')?' overdue':''}">${esc(due)}</span>`:''}</div>
    ${r.note?`<div class="reminder-note">${esc(r.note)}</div>`:''}
    <div class="reminder-meta"><span>${esc(reminderMeta(r))}${r.link?' · '+esc(refLabel(r.link.ref)):''}</span>${r.link?`<button class="btn ghost small" onclick="openReminderLink('${r.id}')">Öffnen</button>`:''}</div>
  </div>`;
}
function addPoll(){
  openModal('Neue Umfrage', [
    {key:'question',label:'Frage',value:'',placeholder:'z. B. Welcher Badestopp?'},
    {key:'options',label:'Optionen (eine pro Zeile)',type:'textarea',value:''},
  ], v=>{
    const question = v.question.trim();
    const lines = v.options.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!question || lines.length < 2){ toast('Bitte Frage und mindestens zwei Optionen eintragen'); return; }
    const poll = {id:uid(), question, options:lines.map(text=>({id:uid(), text})), votes:{}, closed:false, createdAt:new Date().toISOString(), createdBy:whoami()};
    state.polls.push(poll);
    logChange('hat Umfrage „'+question+'" angelegt', {t:'pollAdd', id:poll.id});
  });
}
function editPoll(id){
  const p = state.polls.find(x=>x.id===id);
  if(!p) return;
  openModal('Umfrage bearbeiten', [
    {key:'question',label:'Frage',value:p.question},
    {key:'options',label:'Optionen (eine pro Zeile)',type:'textarea',value:p.options.map(o=>o.text).join('\n')},
  ], v=>{
    const question = v.question.trim();
    const lines = v.options.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!question || lines.length < 2){ toast('Bitte Frage und mindestens zwei Optionen eintragen'); return; }
    const prev = copyData(p);
    const oldByText = new Map(p.options.map(o=>[o.text,o.id]));
    p.question = question;
    p.options = lines.map(text=>({id:oldByText.get(text) || uid(), text}));
    const valid = new Set(p.options.map(o=>o.id));
    Object.keys(p.votes).forEach(cid=>{ p.votes[cid] = (p.votes[cid]||[]).filter(oid=>valid.has(oid)); });
    logChange('hat Umfrage „'+p.question+'" bearbeitet', {t:'pollEdit', id, prev});
  }, ()=>{
    const idx = state.polls.findIndex(x=>x.id===id);
    if(idx<0) return;
    const poll = copyData(state.polls[idx]);
    logChange('hat Umfrage „'+poll.question+'" gelöscht', {t:'pollDel', poll, idx});
    state.polls.splice(idx,1);
  });
}
function togglePollVote(pollId, optionId, crewId){
  const p = state.polls.find(x=>x.id===pollId);
  if(!p || p.closed) return;
  const prev = copyData(p.votes || {});
  p.votes[crewId] = p.votes[crewId] || [];
  const i = p.votes[crewId].indexOf(optionId);
  if(i>=0) p.votes[crewId].splice(i,1); else p.votes[crewId].push(optionId);
  logChange((crewById(crewId)?.name||'?') + ' hat bei „'+p.question+'" abgestimmt', {t:'pollVote', id:pollId, prev});
  save(); renderAll();
}
// Wie bei den Spots: nur die eigene Stimme (whoami()) ist per Klick auf die Option
// setzbar, nicht mehr beliebige Crew-Namen anklickbar.
function togglePollVoteMine(pollId, optionId){
  const me = whoami();
  if(!me){ askWho(); return; }
  togglePollVote(pollId, optionId, me);
}
function togglePollClosed(id){
  const p = state.polls.find(x=>x.id===id);
  if(!p) return;
  const prev = !!p.closed;
  p.closed = !p.closed;
  logChange((p.closed?'hat Umfrage geschlossen: ':'hat Umfrage wieder geöffnet: ') + '„'+p.question+'"', {t:'pollClose', id, prev});
  save(); renderAll();
}
function pollRow(p){
  const creator = p.createdBy ? crewById(p.createdBy) : null;
  return `<div class="poll-card${p.closed?' closed':''}">
    <div class="poll-head">
      <b>${esc(p.question)}</b>
      <button class="btn ghost small" onclick="togglePollClosed('${p.id}')">${p.closed?'Öffnen':'Schließen'}</button>
      <button class="btn ghost small" onclick="editPoll('${p.id}')">✎</button>
    </div>
    <div class="poll-meta">${creator?esc(creator.name)+' · ':''}${fmtLogTs(p.createdAt)}${p.closed?' · geschlossen':''}</div>
    ${(()=>{ const me = whoami(); return p.options.map(o=>{
      const voters = state.crew.filter(c=>(p.votes[c.id]||[]).includes(o.id));
      const mine = me && (p.votes[me]||[]).includes(o.id);
      return `<div class="poll-option${mine?' mine':''}" onclick="togglePollVoteMine('${p.id}','${o.id}')">
        <div class="poll-option-title"><span>${mine?'✓ ':''}${esc(o.text)}</span><span>${voters.length}</span></div>
        <div class="chips">${voters.length ? voters.map(c=>`<span class="chip on static" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span>`).join('') : '<span class="hint" style="margin:0">Noch keine Stimmen</span>'}</div>
      </div>`;
    }).join(''); })()}
  </div>`;
}

/* ============================================================
   SCHLAFPLATZ-RADAR — wiederverwendbare Plan-B-Suchen
   ============================================================ */
const SLEEP_MAP_LAYER_KEY=STORAGE_KEY+'-sleep-map-layer';
const SLEEP_MAP_STATUS_KEY=STORAGE_KEY+'-sleep-map-status';
const SLEEP_ZFE_LAYER_KEY=STORAGE_KEY+'-sleep-zfe-layer';
const SLEEP_DETAIL_STYLE='https://tiles.openfreemap.org/styles/liberty';
let sleepQuery='', sleepFilter='action', sleepView='map', sleepMapStatus='all', sleepMapLayer=navigator.onLine?'detail':'offline';
let sleepZfeVisible=true;
let sleepDetailMap=null, sleepDetailLoadTimer=null, sleepDetailGeneration=0, sleepDetailRows=[];
try{const saved=localStorage.getItem(SLEEP_MAP_LAYER_KEY);if(saved==='detail'||saved==='offline')sleepMapLayer=saved==='detail'&&!navigator.onLine?'offline':saved;}catch(e){}
try{const saved=localStorage.getItem(SLEEP_MAP_STATUS_KEY);if(['all','usable','open','closed'].includes(saved))sleepMapStatus=saved;}catch(e){}
try{sleepZfeVisible=localStorage.getItem(SLEEP_ZFE_LAYER_KEY)!=='off';}catch(e){}
function sleepUndo(){ return {t:'sleepState',sleepSearches:copyData(state.sleepSearches||[]),sleepPlaces:copyData(state.sleepPlaces||[]),mailAssistant:copyData(state.mailAssistant||{}),reminders:copyData(state.reminders||[]),campContacts:copyData(state.campContacts||[])}; }
function findSleep(searchId,candidateId){ const s=(state.sleepSearches||[]).find(x=>x.id===searchId); return {s,c:s?.candidates.find(x=>x.id===candidateId)}; }
function sleepPlace(c){return (state.sleepPlaces||[]).find(p=>p.id===c?.placeId);}
function sleepCandidateView(c){const v=Object.assign({},c,sleepPlace(c)||{});v.id=c?.id;v.placeId=c?.placeId;return v;}
function ensureSleepPlace(c){
  let p=sleepPlace(c), linked=!!p, name=String(c.name||'').trim();
  if(!p)p=(state.sleepPlaces||[]).find(x=>String(x.name||'').trim().toLowerCase()===name.toLowerCase());
  if(!p){p={id:uid(),createdAt:new Date().toISOString()};state.sleepPlaces.push(p);}
  SLEEP_PLACE_KEYS.forEach(k=>{if(c[k]!==undefined&&(linked||c[k]!==''))p[k]=c[k];}); c.placeId=p.id; return p;
}
function sleepDateLabelFromIso(start,end){
  const fmt=iso=>{if(!iso)return '';const d=new Date(iso+'T12:00:00');return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});};
  return start&&end?fmt(start)+'–'+fmt(end):fmt(start)||fmt(end);
}
function sleepDateEnglish(s,c){
  const fmt=iso=>iso?new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'';
  if(c?.requestedArrivalDate){const end=c.requestedDepartureDate||(()=>{const d=new Date(c.requestedArrivalDate+'T12:00:00');d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})();return `from ${fmt(c.requestedArrivalDate)} to ${fmt(end)}`;}
  return s.startDate&&s.endDate?`from ${fmt(s.startDate)} to ${fmt(s.endDate)}`:(s.dateLabel?`for the night of ${s.dateLabel}`:'');
}
function sleepFlexibleStayEnglish(s,c){
  if(c?.requestedArrivalDate)return sleepDateEnglish(s,c);
  const fmt=iso=>iso?new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'';
  const a=s.arrivalWindowStart,b=s.arrivalWindowEnd;if(!a||!b||a===b)return sleepDateEnglish(s,c);
  return `for one night, arriving on any day from ${fmt(a)} to ${fmt(b)} and departing the following morning`;
}
function sleepCandidateStayEnglish(s,c){
  if(!c?.offeredArrivalDate)return sleepDateEnglish(s,c);const start=new Date(c.offeredArrivalDate+'T12:00:00'),end=c.offeredDepartureDate?new Date(c.offeredDepartureDate+'T12:00:00'):new Date(start);if(!c.offeredDepartureDate)end.setDate(end.getDate()+1);
  const fmt=d=>d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});return `from ${fmt(start)} to ${fmt(end)}`;
}
function sleepCandidateStayGerman(c){
  if(!c?.offeredArrivalDate)return '';const start=new Date(c.offeredArrivalDate+'T12:00:00'),end=c.offeredDepartureDate?new Date(c.offeredDepartureDate+'T12:00:00'):new Date(start);if(!c.offeredDepartureDate)end.setDate(end.getDate()+1);
  const same=start.getMonth()===end.getMonth()&&start.getFullYear()===end.getFullYear(),a=same?String(start.getDate()):start.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}),b=end.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});return `${a}.–${b}`;
}
function sleepSearchWindowLabel(s){
  if(!s?.arrivalWindowStart||!s?.arrivalWindowEnd||s.arrivalWindowStart===s.arrivalWindowEnd)return s?.dateLabel||'';
  const fmt=iso=>new Date(iso+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});return `1 Nacht · Anreise ${fmt(s.arrivalWindowStart)}–${fmt(s.arrivalWindowEnd)} flexibel`;
}
function sleepMailWindowLabel(s,c){
  if(c?.requestedArrivalDate){const start=new Date(c.requestedArrivalDate+'T12:00:00'),end=c.requestedDepartureDate?new Date(c.requestedDepartureDate+'T12:00:00'):new Date(start);if(!c.requestedDepartureDate)end.setDate(end.getDate()+1);const same=start.getMonth()===end.getMonth()&&start.getFullYear()===end.getFullYear();return same?`${start.getDate()}–${end.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`:`${start.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}–${end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;}
  if(!s?.arrivalWindowStart||!s?.arrivalWindowEnd||s.arrivalWindowStart===s.arrivalWindowEnd){
    if(!s?.startDate||!s?.endDate)return s?.dateLabel||'';
    const a=new Date(s.startDate+'T12:00:00'),b=new Date(s.endDate+'T12:00:00'),same=a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();
    return same?`${a.getDate()}–${b.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`:`${a.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}–${b.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
  }
  const a=new Date(s.arrivalWindowStart+'T12:00:00'),b=new Date(s.arrivalWindowEnd+'T12:00:00'),same=a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();return same?`arrival ${a.getDate()} or ${b.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`:`arrival ${a.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} or ${b.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;
}
function addSleepSearch(today=false){
  const d=new Date(), start=today?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'', d2=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1), end=today?`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`:'';
  openModal(today?'Suche für heute':'Reiseabschnitt hinzufügen',[
    {key:'title',label:'Titel',value:today?'Heute Abend':'Neuer Abschnitt',placeholder:'z. B. Cassis / Calanques'},
    {key:'startDate',label:'Geplante Anreise',type:'isoDate',value:start},{key:'endDate',label:'Geplante Abreise',type:'isoDate',value:end},
    {key:'arrivalWindowStart',label:'Früheste mögliche Anreise',type:'isoDate',value:start},{key:'arrivalWindowEnd',label:'Späteste mögliche Anreise',type:'isoDate',value:start},
    {key:'region',label:'Region / Korridor',value:'',placeholder:'z. B. rund um Cassis'},
    {key:'maxDrive',label:'Maximale Fahrt / Umweg',value:'',placeholder:'z. B. 45 Min Umweg'},
  ],v=>{ const undo=sleepUndo(), search={id:uid(),title:v.title.trim()||'Reiseabschnitt',startDate:v.startDate,endDate:v.endDate,arrivalWindowStart:v.arrivalWindowStart,arrivalWindowEnd:v.arrivalWindowEnd,dateLabel:sleepDateLabelFromIso(v.startDate,v.endDate),region:v.region.trim(),maxDrive:v.maxDrive.trim(),mode:today?'today':'planned',createdAt:new Date().toISOString(),candidates:[]}; state.sleepSearches.push(search); logChange('hat Reiseabschnitt „'+search.title+'“ hinzugefügt',undo); });
}
function editSleepSearch(id){ const s=state.sleepSearches.find(x=>x.id===id); if(!s)return; openModal('Reiseabschnitt bearbeiten',[
  {key:'title',label:'Titel',value:s.title},{key:'startDate',label:'Geplante Anreise',type:'isoDate',value:s.startDate||''},{key:'endDate',label:'Geplante Abreise',type:'isoDate',value:s.endDate||''},{key:'arrivalWindowStart',label:'Früheste mögliche Anreise',type:'isoDate',value:s.arrivalWindowStart||s.startDate||''},{key:'arrivalWindowEnd',label:'Späteste mögliche Anreise',type:'isoDate',value:s.arrivalWindowEnd||s.startDate||''},{key:'region',label:'Region / Korridor',value:s.region||''},{key:'maxDrive',label:'Maximale Fahrt / Umweg',value:s.maxDrive||''}
],v=>{const undo=sleepUndo(); Object.assign(s,{title:v.title.trim()||s.title,startDate:v.startDate,endDate:v.endDate,arrivalWindowStart:v.arrivalWindowStart,arrivalWindowEnd:v.arrivalWindowEnd,dateLabel:sleepDateLabelFromIso(v.startDate,v.endDate),region:v.region.trim(),maxDrive:v.maxDrive.trim()}); logChange('hat Reiseabschnitt „'+s.title+'“ bearbeitet',undo);},()=>{const undo=sleepUndo(),i=state.sleepSearches.findIndex(x=>x.id===id); state.sleepSearches.splice(i,1); logChange('hat Reiseabschnitt „'+s.title+'“ gelöscht',undo);}); }
function sleepSearchOptionLabel(s){return [s.title,sleepSearchWindowLabel(s),s.region].filter(Boolean).join(' · ');}
function sleepCandidateFields(raw={},searchId=''){ const c=sleepCandidateView(raw), stored=c.lat!=null?{lat:+c.lat,lng:+c.lng}:null, auto=stored?null:pointOf({},c.name+' '+c.region), searches=state.sleepSearches||[]; return [
  {key:'searchId',label:'Reiseabschnitt',type:'select',value:searches.some(s=>s.id===searchId)?searchId:(searches[0]?.id||''),options:searches.map(s=>({value:s.id,label:sleepSearchOptionLabel(s)}))},
  {key:'name',label:'Unterkunft / Stellplatz',value:c.name||'',datalist:(state.sleepPlaces||[]).map(p=>p.name).filter(Boolean)},{key:'kind',label:'Art',type:'select',value:c.kind||'camping',options:[{value:'camping',label:'Campingplatz'},{value:'private',label:'Privater Stellplatz'},{value:'parking',label:'Stellplatz / Parkplatz'},{value:'other',label:'Andere Unterkunft'}]},{key:'region',label:'Ort / Region',value:c.region||''},
  {key:'status',label:'Status',type:'select',value:c.status||'new',options:Object.entries(SLEEP_STATUSES).map(([value,x])=>({value,label:x.label}))},
  {key:'preferred',label:'Auswahl',type:'checkbox',value:!!c.preferred,text:'Als Favorit hervorheben'},
  {key:'email',label:'E-Mail',value:c.email||''},{key:'phone',label:'Telefon',value:c.phone||''},{key:'link',label:'Karten-Link',value:c.link||''},{key:'officialUrl',label:'Website',value:c.officialUrl||''},{key:'contactFormUrl',label:'Kontaktformular',value:c.contactFormUrl||''},{key:'contactVerified',label:'Kontaktprüfung',type:'checkbox',value:raw.id?c.contactVerified===true:false,text:c.kind==='private'?'Quelle und Ort geprüft':'Offizielle Kontaktmöglichkeit geprüft'},
  {key:'pos',label:'Position auf der Karte',type:'map',value:stored,auto},
  {key:'requestedArrivalDate',label:'Gewünschte Anreise für diesen Platz',type:'isoDate',value:c.requestedArrivalDate||''},
  {key:'requestedDepartureDate',label:'Gewünschte Abreise für diesen Platz',type:'isoDate',value:c.requestedDepartureDate||''},
  {key:'price',label:'Preis',value:c.price||''},{key:'tax',label:'Kurtaxe / Zusatzkosten',value:c.tax||''},
  {key:'finalPrice',label:'Bestätigter Gesamtpreis',value:c.finalPrice||''},{key:'deposit',label:'Anzahlung',value:c.deposit||''},{key:'bookingRef',label:'Buchungsnummer',value:c.bookingRef||''},{key:'cancellationDeadline',label:'Stornofrist',value:c.cancellationDeadline||''},
  {key:'offeredArrivalDate',label:'Vom Platz angebotene Anreise',type:'isoDate',value:c.offeredArrivalDate||''},
  {key:'offeredDepartureDate',label:'Vom Platz angebotene Abreise',type:'isoDate',value:c.offeredDepartureDate||''},
  {key:'arrivalWindow',label:'Anreisezeit / Check-in',value:c.arrivalWindow||''},
  {key:'confirmDates',label:'Bestätigung',type:'checkbox',value:!!c.confirmation?.dates,text:'Datum ausdrücklich bestätigt'},
  {key:'confirmParty',label:'Bestätigung',type:'checkbox',value:!!c.confirmation?.party,text:'6 Erwachsene bestätigt'},
  {key:'confirmCamper',label:'Bestätigung',type:'checkbox',value:!!c.confirmation?.camper,text:'Camper akzeptiert'},
  {key:'confirmCar',label:'Bestätigung',type:'checkbox',value:!!c.confirmation?.car,text:'Kleinwagen / Parkplatz bestätigt'},
  {key:'callWindow',label:'Anruf-Zeitfenster',value:c.callWindow||'',placeholder:'z. B. 08:00–22:00'},
  {key:'nextAction',label:'Nächster Schritt',value:c.nextAction||''},{key:'nextActionDate',label:'Wann?',value:c.nextActionDate||''},
  {key:'reply',label:'Antwort kurz zusammengefasst',type:'textarea',value:c.reply||'',placeholder:'Was bedeutet die Antwort praktisch?'},{key:'replyQuote',label:'Kurzes Originalzitat (optional)',type:'textarea',value:c.replyQuote||'',placeholder:'Nur der entscheidende Satz aus der E-Mail'},{key:'pitchNote',label:'Stellplatz / Fahrzeug-Bedingungen',type:'textarea',value:c.pitchNote||''},
  {key:'parking',label:'Kleinwagen / Parken',type:'textarea',value:c.parking||''},{key:'inquiryQuestion',label:'Zusatzfrage für die Anfrage',type:'textarea',value:c.inquiryQuestion||''},{key:'notes',label:'Weitere Notizen',type:'textarea',value:c.notes||''}
]; }
function applyCandidateValues(c,v){ const pos=v.pos,confirmation={dates:!!v.confirmDates,party:!!v.confirmParty,camper:!!v.confirmCamper,car:!!v.confirmCar}; Object.keys(v).filter(k=>!['searchId','pos','confirmDates','confirmParty','confirmCamper','confirmCar'].includes(k)).forEach(k=>c[k]=typeof v[k]==='string'?v[k].trim():v[k]);c.confirmation=confirmation;if(c.status==='booked'&&!Object.values(confirmation).every(Boolean)){c.status='reserving';c.nextAction='Bestätigung für Datum, Gruppe, Camper und Auto vervollständigen';toast('„Bestätigt“ braucht alle vier Bestätigungen');}else if(c.status==='booked'&&!c.confirmedAt)c.confirmedAt=new Date().toISOString(); const p=ensureSleepPlace(c); applyPos(p,pos); applyLinkCoords(p); if(c.reply&&!c.repliedAt)c.repliedAt=new Date().toISOString(); }
function syncSleepCandidate(s,c){
  c.reminderId=null;
}
function addSleepCandidate(searchId=''){ const searches=state.sleepSearches||[];if(!searches.length){addSleepSearch(true);return;}openModal('Unterkunft hinzufügen',sleepCandidateFields({},searchId),v=>{if(!v.name.trim()){toast('Bitte einen Namen eintragen');return;}const s=searches.find(x=>x.id===v.searchId);if(!s){toast('Bitte einen Reiseabschnitt wählen');return;}const undo=sleepUndo(),c=normalizeSleepCandidate({id:uid(),mapPinned:true,contactedAt:v.status==='awaiting'?new Date().toISOString():null});applyCandidateValues(c,v);s.candidates.push(c);syncSleepCandidate(s,c);logChange('hat Schlafplatz-Option „'+c.name+'“ hinzugefügt',undo);if(!sleepCandidatePositioned(c))toast('Gespeichert · Kartenposition fehlt');}); }
function editSleepCandidate(searchId,candidateId){ const {s,c}=findSleep(searchId,candidateId);if(!c)return;const view=sleepCandidateView(c);openModal('Schlafplatz-Option bearbeiten',sleepCandidateFields(c,s.id),v=>{if(!v.name.trim()){toast('Bitte einen Namen eintragen');return;}const target=(state.sleepSearches||[]).find(x=>x.id===v.searchId);if(!target){toast('Bitte einen Reiseabschnitt wählen');return;}const undo=sleepUndo();applyCandidateValues(c,v);if(target.id!==s.id){const i=s.candidates.findIndex(x=>x.id===candidateId);if(i>=0)s.candidates.splice(i,1);target.candidates.push(c);}syncSleepCandidate(target,c);logChange('hat Schlafplatz-Option „'+v.name.trim()+'“ bearbeitet',undo);},()=>{const undo=sleepUndo(),i=s.candidates.findIndex(x=>x.id===candidateId);s.candidates.splice(i,1);logChange('hat Schlafplatz-Option „'+view.name+'“ gelöscht',undo);}); }
function camperProfile(){return state.vehicles.find(v=>v.id==='v-camper')||{};}
function sleepMailMoney(v){return String(v||'').replace(/^(\d+(?:[.,]\d+)?)\s*€/,'€$1');}
function sleepEmailTextRaw(s,c,mode='inquiry'){
  const dates=sleepDateEnglish(s,c),flexible=sleepFlexibleStayEnglish(s,c),exact=sleepCandidateStayEnglish(s,c),party=`${state.crew.length} adults travelling with one camper and one small car`,end=`Thank you very much.\n\nKind regards,\n\n`,hasFlexibleWindow=!c.requestedArrivalDate&&s.arrivalWindowStart&&s.arrivalWindowEnd&&s.arrivalWindowStart!==s.arrivalWindowEnd,extra=c.inquiryQuestion?`\n\n${c.inquiryQuestion}`:'';
  if(mode==='reserve'&&hasFlexibleWindow&&!c.offeredArrivalDate)return `Dear ${c.name} team,\n\nThank you for letting us know that you can offer us one night within our flexible travel window.\n\nCould you please confirm the exact arrival date you can offer ${flexible} for ${party}, as well as the total price and parking arrangement for the small car?\n\nOnce the exact night is clear, we can confirm whether we would like to reserve it.\n\n${end}`;
  if(mode==='reserve'){const priceKnown=c.finalPrice?`the expected total is ${sleepMailMoney(c.finalPrice)}${c.price&&c.tax?` (${sleepMailMoney(c.price)} plus tourist tax)`:''}`:c.price?`the quoted price is ${sleepMailMoney(c.price)}${c.tax?', plus tourist tax':''}`:c.tax?'tourist tax is charged separately':'',parkingKnown=c.parking?(/außerhalb|outside/i.test(c.parking)?'the small car can be parked in the parking area outside the campsite':'the parking arrangement for the small car is clear from your reply'):'',known=[priceKnown,parkingKnown].filter(Boolean),missing=[!(c.finalPrice||c.price)&&'the total price',!c.parking&&'where the small car can be parked'].filter(Boolean),questions=[missing.length&&`Could you please also confirm ${missing.join(' and ')}?`,'Please let us know when the reservation becomes definitive and whether any further step or payment is required.'].filter(Boolean).join(' ');return `Dear ${c.name} team,\n\nThank you for confirming that you can offer us a place ${exact}.\n\nWe would like to accept your offer and reserve it for ${party}.${known.length?`\n\nWe understand that ${known.join(' and ')}.`:''}\n\n${questions}\n\n${end}`;}
  if(mode==='network_policy')return `Dear ${c.name} team,\n\nWe expect to travel through ${s.region||'your region'}, but our route remains flexible. We are ${party}.\n\nCould you please let us know whether you accept a one-night stay on a touring pitch ${flexible} and whether advance reservations are possible?\n\nIf no reservation is possible, may we call on the relevant arrival day or arrive without a reservation in case a pitch is free? Please also let us know the best phone number and reception hours, any minimum-stay or camper restrictions, and whether the small car can be parked at or near the pitch.\n\n${end}`;
  if(mode==='call'){const walkIn=/vorbeifahren|spontaneous arrival|walk.?in/i.test((c.nextAction||'')+' '+(c.reply||''));return walkIn?`Dear ${c.name} team,\n\nThank you for confirming that we may arrive spontaneously ${flexible}. We understand that a pitch cannot be guaranteed in advance for ${party}.\n\nWe will contact you shortly before arrival to check the current situation.\n\n${end}`:`Dear ${c.name} team,\n\nThank you for confirming that we may call you on the relevant arrival day to ask about last-minute availability ${flexible} for ${party}.\n\nWe will contact you ${c.callWindow?'during your reception hours ('+c.callWindow+')':'before travelling to you'}.\n\n${end}`;}
  if(mode==='followup') return `Dear ${c.name} team,\n\nI am following up regarding availability ${flexible} for ${party}. Has a pitch become available for any one night within this window?\n\nIf you are still full, would it be possible to call you spontaneously on the relevant arrival day in case of a cancellation?\n\n${end}`;
  if(mode==='dimensions'){const v=camperProfile();if(!v.lengthM)return '';const size=`${v.lengthM} metres long${v.widthM?`, ${v.widthM} metres wide`:''}${v.heightM?` and ${v.heightM} metres high`:''}${v.model?` (${v.model})`:''}`,twoPitches=/zwei stellplätze|two (?:different |adjacent )?pitches/i.test((c.pitchNote||'')+' '+(c.reply||''));if(twoPitches)return `Dear ${c.name} team,\n\nThank you for confirming availability within our travel window. We understand that your limit is five people per pitch and that our group of six adults would therefore need two pitches.\n\nOur camper is ${size}. Could you please let us know whether two suitable pitches, preferably next to each other, are available ${flexible}?\n\nPlease also confirm the total price for all six adults, the camper and the small car, which pitch types you recommend, and where the small car can be parked. We will add the booking name and phone number when confirming the reservation.\n\n${end}`;return `Dear ${c.name} team,\n\nThank you for your reply. The camper is ${size}.\n\nCould you please check whether a suitable place is available ${flexible}?\n\n${end}`;}
  if(mode==='missing') return `Dear ${c.name} team,\n\nThank you for your reply regarding our stay ${dates}. Could you please also confirm the total price and whether our small car can be parked at or near the place?\n\n${end}`;
  if(mode==='deposit') return `Dear ${c.name} team,\n\nThank you for the booking information for our stay ${dates}. Before we arrange the deposit, could you please confirm the required amount, payment deadline and reference we should include with the payment?\n\n${end}`;
  if(mode==='clarify') return `Dear ${c.name} team,\n\nThank you for your reply. Before we proceed, could you please confirm that the offer applies ${dates} to ${party}, including parking for the small car?\n\n${end}`;
  const flexibility=hasFlexibleWindow?' We only need one night and can choose any available arrival date within this window.':'';
  return `Dear ${c.name} team,\n\nI would like to ask if you have a touring pitch available ${flexible} for ${party}.${flexibility}\n\nIf advance reservations are not available or you are currently full, would it still be possible to call you spontaneously on the relevant arrival day in case a pitch becomes available?\n\nCould you please also let me know the total price for one night and whether the small car can be parked at or near the pitch?${extra}\n\n${end}`;
}
function formatSleepLetter(value){const text=String(value||'').replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/g,'')).join('\n').replace(/\n{3,}/g,'\n\n').trimEnd();return text?text+'\n\n':'';}
function sleepEmailText(s,c,mode='inquiry'){return formatSleepLetter(sleepEmailTextRaw(s,c,mode));}
function sleepArrivalEnglish(s){if(s.startDate)return new Date(s.startDate+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});return s.dateLabel||'the arrival day';}
function sleepMailSubject(s,c,mode='inquiry'){if(c.mailThreadSubject)return c.mailThreadSubject.replace(/^(?:re|r|aw):\s*/i,'Re: ');const label=sleepMailWindowLabel(s,c);return mode==='network_policy'?`One-night camping policy – ${s.region||''} – ${c.name}`:mode==='reserve'?`Reservation request – ${c.offeredArrivalDate||label} – ${c.name}`:mode==='followup'?`Follow-up: One-night pitch availability – ${label}`:`One-night pitch availability – ${label} – ${c.name}`;}
function sleepMailto(s,c,mode='inquiry'){const body=sleepEmailText(s,c,mode).replace(/\n/g,'\r\n');return `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(sleepMailSubject(s,c,mode))}&body=${encodeURIComponent(body)}`;}
function sleepActionMode(c){const action=c.nextAction||'';if(c.status==='deposit_required')return 'deposit';if(c.status==='reserving')return 'clarify';if(/camperlänge|camper length|length of the camper/i.test(action+' '+(c.reply||'')))return 'dimensions';if(/preis|price|parken|parking|parkplatz/i.test(action))return 'missing';if(/klären|clarif|bestätigen lassen|confirm details/i.test(action))return 'clarify';if(c.status==='available')return 'reserve';if(c.status==='call')return 'call';if(c.status==='followup')return 'followup';return 'inquiry';}
function prepareSleepReply(searchId,candidateId,mode){const {s,c}=findSleep(searchId,candidateId);if(!c)return;const view=sleepCandidateView(c),body=sleepEmailText(s,view,mode);if(!body){toast('Zuerst die Camperlänge unter Fahrzeuge eintragen');return;}const cloud=state.mailAssistant?.runnerMode==='cloud',formOnly=!view.email&&!!view.contactFormUrl,box=document.getElementById('modalBox'),destination=formOnly?`Kontaktformular: ${esc(view.contactFormUrl)}`:`An: ${esc(view.email)}<br>Betreff: ${esc(sleepMailSubject(s,view,mode))}`,primary=formOnly?`<button class="btn primary" onclick="openSleepContactForm('${s.id}','${c.id}')">Kontaktformular öffnen</button><button class="btn ghost" onclick="markSleepManualContactSent('${s.id}','${c.id}')">Nach Versand markieren</button>`:`<button class="btn primary" onclick="openSleepMail('${s.id}','${c.id}','${mode}')">${cloud?'Cloud-Entwurf erstellen':'In Apple Mail öffnen'}</button>`;box.innerHTML=`<h3>Anfrage-Vorschau · ${esc(view.name)}</h3><div class="mail-preview-meta">${destination}</div><pre class="mail-preview">${esc(body)}</pre><div class="btnrow"><button class="btn ghost" onclick="copySleepEmail('${s.id}','${c.id}','${mode}')">Text kopieren</button>${primary}<button class="btn ghost" onclick="closeModal()">Schließen</button></div>${formOnly?'<p class="hint">Das Öffnen ändert den Status nicht. Erst nach dem tatsächlichen Absenden markieren.</p>':''}`;document.getElementById('modalBg').classList.add('open');}
function openSleepContactForm(searchId,candidateId){const {c}=findSleep(searchId,candidateId),view=sleepCandidateView(c);if(!view.contactFormUrl)return;window.open(view.contactFormUrl,'_blank','noopener');}
function markSleepManualContactSent(searchId,candidateId){const {s,c}=findSleep(searchId,candidateId);if(!c)return;const undo=sleepUndo();c.status='awaiting';c.draftState='sent';c.contactedAt=new Date().toISOString();c.nextAction='Auf Antwort warten';syncSleepCandidate(s,c);logChange('hat den Formularversand für „'+sleepCandidateView(c).name+'“ bestätigt',undo);save();closeModal();renderAll();}
function openSleepMail(searchId,candidateId,mode,force=false){const {s,c}=findSleep(searchId,candidateId);if(!c)return;const view=sleepCandidateView(c);if(mode==='reserve'&&!force){const conflict=s.candidates.find(x=>x.id!==c.id&&['reserving','deposit_required','booked'].includes(x.status));if(conflict){closeModal();toast('Für diese Nacht läuft bereits: '+sleepCandidateView(conflict).name,'Trotzdem',()=>openSleepMail(searchId,candidateId,mode,true));return;}}const undo=sleepUndo(),now=new Date().toISOString(),cloud=state.mailAssistant?.runnerMode==='cloud',requestStatus=cloud?'requested':'opened',existing=[...(state.mailAssistant.draftRequests||[])].reverse().find(x=>x.candidateId===candidateId&&x.template===mode&&['opened','requested','ready'].includes(x.status));if(!existing)state.mailAssistant.draftRequests.push({id:uid(),searchId,candidateId,template:mode,messageId:c.mailMessageId||'',threadSubject:c.mailThreadSubject||'',createdAt:now,openedAt:cloud?null:now,status:requestStatus,previousStatus:c.status});logChange(cloud?'hat einen Cloud-E-Mail-Entwurf für „'+view.name+'“ angefordert':'hat den E-Mail-Vorschlag für „'+view.name+'“ in Apple Mail geöffnet',undo);save();closeModal();renderAll();if(cloud)toast(existing?'Entwurf ist bereits angefordert':'Entwurf wird beim nächsten Cloud-Check erstellt');else window.location.href=sleepMailto(s,view,mode);}
function markSleepDraftSent(searchId,candidateId){const {s,c}=findSleep(searchId,candidateId);if(!c)return;const undo=sleepUndo(),req=[...state.mailAssistant.draftRequests].reverse().find(x=>x.candidateId===candidateId&&['opened','requested','ready','fallback'].includes(x.status)),policy=['network_policy','inquiry','followup'].includes(req?.template);if(req){req.status='sent_manual';req.sentAt=new Date().toISOString();}c.status=policy?'awaiting':'reserving';c.draftState='sent';c.contactedAt=new Date().toISOString();c.nextAction=policy?'Auf Antwort warten':'Auf definitive Bestätigung warten';syncSleepCandidate(s,c);logChange('hat den E-Mail-Versand für „'+sleepCandidateView(c).name+'“ bestätigt',undo);save();renderAll();}
function cancelSleepDraft(searchId,candidateId){const {c}=findSleep(searchId,candidateId);if(!c)return;const undo=sleepUndo(),req=[...state.mailAssistant.draftRequests].reverse().find(x=>x.candidateId===candidateId&&['opened','requested','ready','fallback'].includes(x.status));if(c.status==='draft_requested')c.status=req?.previousStatus||'awaiting';c.draftState='none';if(req)req.status='cancelled';logChange('hat den E-Mail-Entwurf für „'+sleepCandidateView(c).name+'“ verworfen',undo);save();renderAll();}
function copySleepEmail(searchId,candidateId,mode='inquiry'){const {s,c}=findSleep(searchId,candidateId);if(!c)return;const txt=sleepEmailText(s,sleepCandidateView(c),mode),done=()=>toast('E-Mail-Text kopiert'); if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done));else fallbackCopy(txt,done);}
function sleepStatusSummary(c){if(c.reply)return c.reply;return c.status==='available'?'Die Unterkunft hat eine reservierbare Option angeboten.':c.status==='reservable'?'Eine Reservierung ist grundsätzlich möglich; der konkrete Zeitraum ist noch nicht bestätigt.':c.status==='call'?'Keine feste Reservierung, aber eine spontane Anfrage am Reisetag ist ausdrücklich möglich.':c.status==='reserving'?'Unsere Reservierungsanfrage wurde versendet; die definitive Bestätigung steht noch aus.':c.status==='deposit_required'?'Die Unterkunft ist möglich, für die Buchung ist noch eine Anzahlung erforderlich.':c.status==='followup'?'Aktuell keine feste Zusage; die Unterkunft empfiehlt, kurz vor der Reise erneut nachzufragen.':c.status==='awaiting'?'Anfrage gesendet, noch keine Antwort erhalten.':c.status==='unavailable'?'Für diesen Zeitraum wurde keine nutzbare Möglichkeit angeboten.':c.status==='new'?'Noch nicht kontaktiert; Verfügbarkeit und Bedingungen sind offen.':'Status noch nicht eindeutig.';}
function pointInZfeRing(point,ring){
  const [x,y]=point;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function pointInZfeGeometry(point,geometry){
  const inPolygon=polygon=>pointInZfeRing(point,polygon[0])&&!polygon.slice(1).some(ring=>pointInZfeRing(point,ring));
  if(geometry?.type==='Polygon')return inPolygon(geometry.coordinates);
  if(geometry?.type==='MultiPolygon')return geometry.coordinates.some(inPolygon);
  return false;
}
function zfeSegmentDistanceKm(point,a,b){
  const lat=point[1]*Math.PI/180,scaleX=111.32*Math.cos(lat),scaleY=110.57;
  const px=point[0]*scaleX,py=point[1]*scaleY,ax=a[0]*scaleX,ay=a[1]*scaleY,bx=b[0]*scaleX,by=b[1]*scaleY;
  const dx=bx-ax,dy=by-ay,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len)):0;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}
function zfeGeometryDistanceKm(point,geometry){
  let best=Infinity;
  const visitRing=ring=>{for(let i=1;i<ring.length;i++)best=Math.min(best,zfeSegmentDistanceKm(point,ring[i-1],ring[i]));};
  const visitPolygon=polygon=>polygon.forEach(visitRing);
  if(geometry?.type==='Polygon')visitPolygon(geometry.coordinates);
  else if(geometry?.type==='MultiPolygon')geometry.coordinates.forEach(visitPolygon);
  return best;
}
function isFrenchSleepCandidate(c){
  const text=[c.phone,c.email,c.officialUrl,c.link,c.region,c.notes].filter(Boolean).join(' ').toLowerCase();
  return /\+33|\bfrance\b|\bfrankreich\b|\bmontpellier\b|\bmarseille\b|\bnice\b|\bnîmes\b|\bnimes\b|\bcamargue\b|\bprovence\b|\blanguedoc\b|\bcassis\b|(?:@|\/\/)[^/\s]+\.fr(?:[/:]|$)/.test(text);
}
function zfeCandidateAssessment(raw){
  const c=sleepCandidateView(raw),data=window.ZFE_DATA;
  if(!data?.areas?.features?.length||!isFrenchSleepCandidate(c)||!Number.isFinite(Number(c.lat))||!Number.isFinite(Number(c.lng)))return null;
  const point=[Number(c.lng),Number(c.lat)],zones=data.areas.features,inside=zones.find(zone=>pointInZfeGeometry(point,zone.geometry));
  if(inside)return {status:inside.properties.lightVehiclesFree?'inside-light-free':'inside',zone:inside.properties,distanceKm:0};
  let nearest=null,distanceKm=Infinity;
  zones.forEach(zone=>{const d=zfeGeometryDistanceKm(point,zone.geometry);if(d<distanceKm){distanceKm=d;nearest=zone.properties;}});
  return {status:distanceKm<=25?'near':'outside',zone:nearest,distanceKm};
}
function zfeCandidateBadge(raw){
  const a=zfeCandidateAssessment(raw);if(!a)return '';
  const checked=window.ZFE_DATA?.checkedAt||'';
  if(a.status==='inside-light-free')return `<span class="sleep-fact zfe-info" title="Stand ${esc(checked)} · Leichte Fahrzeuge nicht vom Fahrverbot betroffen, Plakettenpflicht trotzdem prüfen">In Nice-ZFE · Plakette prüfen</span>`;
  if(a.status==='inside')return `<span class="sleep-fact zfe-danger" title="Ohne passende Crit’Air-Plakette nicht anfahren">In ZFE · ${esc(a.zone.shortName)}</span>`;
  if(a.status==='near')return `<span class="sleep-fact zfe-near" title="Der Punkt liegt außerhalb; die Zufahrt kann durch die Zone führen">Nahe ${esc(a.zone.shortName)}-ZFE · Route prüfen</span>`;
  return `<span class="sleep-fact zfe-clear" title="Campingplatz-Punkt außerhalb der dargestellten dauerhaften ZFE-Flächen">Außerhalb Dauer-ZFE</span>`;
}
function sleepCandidateCard(s,raw){
  const c=sleepCandidateView(raw),st=SLEEP_STATUSES[c.status],maps=c.link||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.name+(c.region?', '+c.region:'')),mode=c.status==='reservable'?'followup':sleepActionMode(c),latestReq=[...(state.mailAssistant.draftRequests||[])].reverse().find(x=>x.candidateId===c.id&&['opened','requested','ready','fallback'].includes(x.status)),hasAnswer=!!(c.reply||c.replyQuote||c.pitchNote||c.parking),statusLabel=latestReq?.status==='ready'?'Entwurf bereit':latestReq?.status==='requested'?'Entwurf wird erstellt':latestReq?.status==='fallback'?'Entwurf prüfen':st.label;
  let primary='',secondary='';
  if(latestReq){
    primary=`<button class="btn primary small" onclick="markSleepDraftSent('${s.id}','${c.id}')">Als gesendet markieren</button>`;
    secondary+=`<button class="sleep-link" onclick="cancelSleepDraft('${s.id}','${c.id}')">Entwurf verwerfen</button>`;
  }else if(c.contactVerified===false){
    primary=`<button class="btn primary small" onclick="editSleepCandidate('${s.id}','${c.id}')">Kontaktdaten prüfen</button>`;
  }else if(c.contactFormUrl&&c.status==='new'){
    primary=`<button class="btn primary small" onclick="prepareSleepReply('${s.id}','${c.id}','inquiry')">Anfrage vorbereiten</button>`;
  }else if(c.status==='call'&&c.phone){
    primary=`<a class="btn primary small" href="tel:${esc(c.phone.replace(/[^\d+]/g,''))}">Jetzt anrufen</a>`;
  }else if(['available','reservable'].includes(c.status)&&c.officialUrl&&/website/i.test(c.nextAction||'')){
    primary=`<a class="btn primary small" href="${esc(c.officialUrl)}" target="_blank" rel="noopener">Auf Website reservieren</a>`;
  }else if(c.email&&['new','available','reservable','followup','reserving','deposit_required'].includes(c.status)){
    const label=c.status==='new'?'Verfügbarkeit anfragen':c.status==='available'?'Reservierung vorbereiten':c.status==='reservable'?'Datum anfragen':c.status==='followup'?'Erneut nachfragen':c.status==='deposit_required'?'Anzahlung klären':'Buchung klären';
    primary=`<button class="btn primary small" onclick="prepareSleepReply('${s.id}','${c.id}','${mode}')">${label}</button>`;
  }
  if(c.officialUrl)secondary+=`<a class="sleep-link" href="${esc(c.officialUrl)}" target="_blank" rel="noopener">Website</a>`;
  secondary+=`<a class="sleep-link" href="${esc(maps)}" target="_blank" rel="noopener">Karte</a><button class="sleep-link" onclick="editSleepCandidate('${s.id}','${c.id}')">Details</button>`;
  const stateText=latestReq?.status==='ready'?'Der Entwurf liegt in Apple Mail und kann dort geprüft und gesendet werden.':latestReq?.status==='requested'?'Der Mail-Entwurf wird gerade erstellt.':sleepStatusSummary(c),showNext=c.nextAction&&!/^Auf Antwort warten$/i.test(c.nextAction);
  return `<div class="sleep-card ${c.status}${c.preferred?' preferred':''}"><div class="sleep-head"><div class="sleep-head-main"><h3>${esc(c.name)}</h3><div class="sleep-sub">${esc(c.region||s.region||'Ort noch offen')}</div></div><span class="sleep-status ${c.status}">${esc(statusLabel)}</span></div>
  <div class="sleep-facts">${c.kind&&c.kind!=='camping'?`<span class="sleep-fact">${esc(c.kind==='private'?'Privat':c.kind==='parking'?'Stellplatz':'Unterkunft')}</span>`:''}${c.preferred?'<span class="sleep-fact preferred">Favorit</span>':''}${zfeCandidateBadge(c)}${(c.finalPrice||c.price)?`<span class="sleep-fact">${esc(c.finalPrice||c.price)}${c.finalPrice?' gesamt':''}</span>`:''}${!c.finalPrice&&c.tax?`<span class="sleep-fact">+ ${esc(c.tax)}</span>`:''}${c.deposit?`<span class="sleep-fact">Anzahlung ${esc(c.deposit)}</span>`:''}${c.bookingRef?`<span class="sleep-fact">Nr. ${esc(c.bookingRef)}</span>`:''}${c.requestedArrivalDate?`<span class="sleep-fact">Wunsch ${esc(sleepCandidateStayGerman({offeredArrivalDate:c.requestedArrivalDate,offeredDepartureDate:c.requestedDepartureDate}))}</span>`:''}${c.offeredArrivalDate?`<span class="sleep-fact">Angebot ${esc(sleepCandidateStayGerman(c))}</span>`:''}${c.arrivalWindow?`<span class="sleep-fact">Anreise ${esc(c.arrivalWindow)}</span>`:''}${c.callWindow?`<span class="sleep-fact">Anruf ${esc(c.callWindow)}</span>`:''}</div>
  ${hasAnswer?`<div class="sleep-answer"><div class="sleep-answer-label">Rückmeldung</div><div class="sleep-answer-text">${esc(stateText)}</div>${c.pitchNote?`<div class="sleep-answer-meta"><b>Stellplatz:</b> ${esc(c.pitchNote)}</div>`:''}${c.parking?`<div class="sleep-answer-meta"><b>Auto:</b> ${esc(c.parking)}</div>`:''}${c.replyQuote?`<blockquote class="sleep-answer-quote">„${esc(c.replyQuote.replace(/^[„“\"']+|[„“\"']+$/g,''))}“</blockquote>`:''}</div>`:`<div class="sleep-state-line">${esc(stateText)}</div>`}
  ${c.notes&&!hasAnswer?`<div class="sleep-note">${esc(c.notes)}</div>`:''}${(showNext||c.nextActionDate)?`<div class="sleep-next">${esc(showNext?c.nextAction:'Nachfassen')}${c.nextActionDate?' · '+esc(c.nextActionDate):''}</div>`:''}
  ${(primary||secondary)?`<div class="sleep-actions">${primary}</div><div class="sleep-links">${secondary}</div>`:''}</div>`;
}
function setSleepFilter(f){sleepFilter=f;renderSleep();}
function setSleepView(v){sleepView=v;renderSleep();}
function setSleepMapStatus(v){
  if(!['all','usable','open','closed'].includes(v))return;
  sleepMapStatus=v;
  try{localStorage.setItem(SLEEP_MAP_STATUS_KEY,v);}catch(e){}
  renderSleep();
}
function setSleepMapLayer(v){
  if(v!=='detail'&&v!=='offline')return;
  sleepMapLayer=v;
  try{localStorage.setItem(SLEEP_MAP_LAYER_KEY,v);}catch(e){}
  renderSleep();
}
function setSleepZfeVisible(value){
  sleepZfeVisible=!!value;
  try{localStorage.setItem(SLEEP_ZFE_LAYER_KEY,sleepZfeVisible?'on':'off');}catch(e){}
  renderSleep();
}
function keepActiveSleepMapStatusVisible(){
  setTimeout(()=>{
    const strip=document.getElementById('sleepMapFilters'),active=strip?.querySelector('button.active');
    if(!strip||!active)return;
    strip.scrollLeft=Math.max(0,active.offsetLeft-(strip.clientWidth-active.offsetWidth)/2);
  },0);
}
function normalizeSleepQuery(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').trim();}
function sleepSearchRows(){
  const q=normalizeSleepQuery(sleepQuery);
  if(q.length<2)return [];
  return (state.sleepSearches||[]).flatMap(search=>(search.candidates||[]).map(candidate=>({search,candidate,view:sleepCandidateView(candidate)}))).filter(({search,view})=>{
    const status=SLEEP_STATUSES[view.status]?.label||'';
    return normalizeSleepQuery([view.name,view.region,search.title,search.region,sleepSearchWindowLabel(search),status,view.reply,view.replyQuote,view.pitchNote,view.parking,view.notes,view.nextAction].filter(Boolean).join(' ')).includes(q);
  });
}
function setSleepQuery(value){
  sleepQuery=String(value||'');renderSleep();
  const input=document.getElementById('sleepFinder');
  if(input){try{input.focus({preventScroll:true});input.setSelectionRange(sleepQuery.length,sleepQuery.length);}catch(e){input.focus();}}
}
function clearSleepQuery(){sleepQuery='';renderSleep();}
function renderSleepSearchResults(){
  const q=normalizeSleepQuery(sleepQuery);
  if(q.length<2)return `<div class="sleep-empty"><b>Mindestens zwei Zeichen eingeben</b><span>Gesucht wird in Namen, Orten, Status und Antworten.</span></div>`;
  const rows=sleepSearchRows(),shown=rows.slice(0,40);
  if(!rows.length)return `<div class="sleep-empty"><b>Kein Schlafplatz gefunden</b><span>Versuche einen Ort, den Namen der Unterkunft oder einen Status wie „angefragt“.</span></div>`;
  return `<div class="sleep-search-summary">${rows.length} Treffer auf der Route</div>${shown.map(({search,candidate})=>`<div class="sleep-result"><div class="sleep-result-context"><b>${esc(search.title)}</b><span>${esc([sleepSearchWindowLabel(search),search.region].filter(Boolean).join(' · '))}</span></div>${sleepCandidateCard(search,candidate)}</div>`).join('')}${rows.length>shown.length?`<p class="hint">Die ersten ${shown.length} Treffer werden angezeigt. Suche genauer, um die Liste einzugrenzen.</p>`:''}`;
}
const SLEEP_FILTER_STATUSES={action:['booked','available','reservable','call','draft_requested','reserving','deposit_required'],waiting:['new','awaiting','followup'],closed:['unavailable']};
const SLEEP_CANDIDATE_PRIORITY={booked:0,deposit_required:1,reserving:2,draft_requested:3,available:4,reservable:5,call:6,followup:7,awaiting:8,new:9,unavailable:10};
function sleepVisible(c){return (SLEEP_FILTER_STATUSES[sleepFilter]||[]).includes(c.status);}
function sleepFilterCounts(){const rows=(state.sleepSearches||[]).flatMap(s=>s.candidates||[]);return Object.fromEntries(Object.entries(SLEEP_FILTER_STATUSES).map(([key,statuses])=>[key,rows.filter(c=>statuses.includes(c.status)).length]));}
function sleepEmptyState(){return sleepFilter==='action'?`<div class="sleep-empty"><b>Noch keine nutzbare Zusage</b><span>Offene Anfragen und neue Plätze findest du unter „Kontakt“.</span><button class="btn ghost small" onclick="setSleepFilter('waiting')">Kontakt ansehen</button></div>`:sleepFilter==='waiting'?`<div class="sleep-empty"><b>Keine offenen Kontakte</b><span>Hier erscheinen neue Plätze und versendete Anfragen.</span><button class="btn ghost small" onclick="addSleepCandidate()">+ Unterkunft</button></div>`:`<div class="sleep-empty"><b>Keine Absagen</b><span>Entlang der Route wurde noch keine Option ausgeschlossen.</span></div>`;}
function renderSleepCandidateList(){
  const groups=(state.sleepSearches||[]).map(search=>({search,candidates:[...(search.candidates||[])].filter(sleepVisible).sort((a,b)=>(SLEEP_CANDIDATE_PRIORITY[a.status]??99)-(SLEEP_CANDIDATE_PRIORITY[b.status]??99)||(Number(!!b.preferred)-Number(!!a.preferred)))})).filter(group=>group.candidates.length);
  if(!groups.length)return sleepEmptyState();
  return groups.map(({search,candidates})=>`<section class="sleep-route-group"><div class="sleep-route-group-head"><div><b>${esc(search.title)}</b><span>${esc([sleepSearchWindowLabel(search),search.region].filter(Boolean).join(' · '))}</span></div><button class="sleep-link" onclick="editSleepSearch('${search.id}')">Abschnitt bearbeiten</button></div>${candidates.map(c=>sleepCandidateCard(search,c)).join('')}</section>`).join('');
}
const SLEEP_MAP_COLORS={booked:'#8ea8ff',available:'#5fd4a8',reservable:'#74c9a5',call:'#ffb257',draft_requested:'#54c8ff',reserving:'#54c8ff',deposit_required:'#ffd76b',followup:'#ffd76b',awaiting:'#54c8ff',new:'#b6bfcc',unavailable:'#737b8d'};
const SLEEP_MAP_STATUS_FILTERS={
  all:{label:'Alle'},
  usable:{label:'Nutzbar'},
  open:{label:'Offen'},
  closed:{label:'Absagen'}
};
function sleepMapStatusGroup(c){
  if(c.status==='unavailable')return 'closed';
  if(['new','awaiting','followup','draft_requested'].includes(c.status))return 'open';
  return 'usable';
}
function sleepMapContacted(c){
  // Entwürfe und neue Rechercheoptionen zählen erst nach einem echten Kontakt.
  // Fachliche Antwortstatus stammen teils aus alten Daten ohne Zeitstempel.
  return !!(c.contactedAt||c.repliedAt||!['new','draft_requested'].includes(c.status));
}
function sleepCandidatePositioned(raw){
  const c=sleepCandidateView(raw);
  return Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lng));
}
function sleepMapEligible(c){
  return !!(c.mapPinned||sleepMapContacted(c));
}
function sleepMapBaseRows(){
  const rank={booked:0,deposit_required:1,available:2,reservable:3,call:4,reserving:5,awaiting:6,followup:7,draft_requested:8,new:9,unavailable:10}, seen=new Map();
  (state.sleepSearches||[]).forEach(search=>(search.candidates||[]).filter(sleepMapEligible).forEach(c=>{const key=c.placeId||c.id,prev=seen.get(key);if(!prev||(rank[c.status]??9)<(rank[prev.c.status]??9))seen.set(key,{search,c});}));
  return [...seen.values()];
}
function sleepMapRows(status=sleepMapStatus){
  const rows=sleepMapBaseRows();
  return status==='all'?rows:rows.filter(row=>sleepMapStatusGroup(row.c)===status);
}
function sleepUnpositionedRows(status=sleepMapStatus){
  const rank={booked:0,deposit_required:1,available:2,reservable:3,call:4,reserving:5,awaiting:6,followup:7,draft_requested:8,new:9,unavailable:10},seen=new Map();
  (state.sleepSearches||[]).forEach(search=>(search.candidates||[]).forEach(c=>{
    if(sleepCandidatePositioned(c))return;
    if(status!=='all'&&sleepMapStatusGroup(c)!==status)return;
    const key=c.placeId||c.id,prev=seen.get(key);
    if(!prev||(rank[c.status]??9)<(rank[prev.c.status]??9))seen.set(key,{search,c});
  }));
  return [...seen.values()];
}
function sleepUnpositionedList(status=sleepMapStatus){
  const rows=sleepUnpositionedRows(status);
  if(!rows.length)return '';
  return `<section class="sleep-unpositioned"><div class="sleep-unpositioned-head"><b>Position fehlt</b><span>${rows.length}</span></div>${rows.map(({search,c})=>{const view=sleepCandidateView(c);return `<div class="sleep-unpositioned-row"><div><b>${esc(view.name)}</b><span>${esc([view.region||search.region,search.title,SLEEP_STATUSES[c.status]?.label].filter(Boolean).join(' · '))}</span></div><button class="btn ghost small" onclick="editSleepCandidate('${search.id}','${c.id}')">Position setzen</button></div>`;}).join('')}</section>`;
}
function destroySleepDetailMap(){
  sleepDetailGeneration++;
  clearTimeout(sleepDetailLoadTimer);sleepDetailLoadTimer=null;
  if(sleepDetailMap){try{sleepDetailMap.remove();}catch(e){}sleepDetailMap=null;}
}
function sleepDetailFallback(token){
  if(token!==sleepDetailGeneration||sleepMapLayer!=='detail')return;
  destroySleepDetailMap();sleepMapLayer='offline';
  if(activeTab==='sleep'&&sleepView==='map'){renderSleep();toast('Detailkarte nicht erreichbar · Offlinekarte aktiv');}
}
function initSleepDetailMap(){
  if(activeTab!=='sleep'||sleepView!=='map'||sleepMapLayer!=='detail'||sleepDetailMap)return;
  const container=document.getElementById('sleepDetailMap');
  if(!container)return;
  if(!navigator.onLine||!window.maplibregl){sleepDetailFallback(sleepDetailGeneration);return;}
  const token=sleepDetailGeneration,features=sleepDetailRows.map(row=>{const c=sleepCandidateView(row.c);return {type:'Feature',geometry:{type:'Point',coordinates:[Number(c.lng),Number(c.lat)]},properties:{searchId:row.search.id,candidateId:row.c.id,name:c.name,status:c.status,color:SLEEP_MAP_COLORS[c.status]||'#b6bfcc'}};});
  try{
    const map=sleepDetailMap=new maplibregl.Map({container,style:SLEEP_DETAIL_STYLE,center:[5.5,45],zoom:4,maxZoom:20,attributionControl:true});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    sleepDetailLoadTimer=setTimeout(()=>sleepDetailFallback(token),12000);
    map.on('load',()=>{
      if(token!==sleepDetailGeneration||map!==sleepDetailMap)return;
      clearTimeout(sleepDetailLoadTimer);sleepDetailLoadTimer=null;
      const status=document.getElementById('sleepDetailMapStatus');if(status)status.remove();
      const zfe=window.ZFE_DATA;
      if(sleepZfeVisible&&zfe?.areas?.features?.length){
        map.addSource('fr-zfe-areas',{type:'geojson',data:zfe.areas});
        map.addLayer({id:'fr-zfe-fill',type:'fill',source:'fr-zfe-areas',paint:{'fill-color':'#ff6f61','fill-opacity':.19}});
        map.addLayer({id:'fr-zfe-outline',type:'line',source:'fr-zfe-areas',paint:{'line-color':'#ff7b6d','line-width':['interpolate',['linear'],['zoom'],5,1.4,12,3]}});
        map.addLayer({id:'fr-zfe-label',type:'symbol',source:'fr-zfe-areas',minzoom:7,layout:{'text-field':['concat',['get','shortName'],' · ZFE'],'text-size':12,'text-allow-overlap':false},paint:{'text-color':'#8b241d','text-halo-color':'rgba(255,255,255,.9)','text-halo-width':1.5}});
        if(zfe.transitRoads?.features?.length){
          map.addSource('fr-zfe-transit',{type:'geojson',data:zfe.transitRoads});
          map.addLayer({id:'fr-zfe-transit-casing',type:'line',source:'fr-zfe-transit',paint:{'line-color':'rgba(12,28,25,.72)','line-width':['interpolate',['linear'],['zoom'],5,2.8,13,7]}});
          map.addLayer({id:'fr-zfe-transit',type:'line',source:'fr-zfe-transit',paint:{'line-color':'#42d6a4','line-width':['interpolate',['linear'],['zoom'],5,1.4,13,4],'line-dasharray':[1.4,1]}});
        }
        map.on('mouseenter','fr-zfe-fill',()=>{map.getCanvas().style.cursor='pointer';});
        map.on('mouseleave','fr-zfe-fill',()=>{map.getCanvas().style.cursor='';});
        map.on('click','fr-zfe-fill',e=>{if(map.queryRenderedFeatures(e.point,{layers:['sleep-campsites']}).length)return;const p=e.features?.[0]?.properties;if(p?.id)openZfeInfo(p.id);});
      }
      map.addSource('sleep-campsites',{type:'geojson',data:{type:'FeatureCollection',features}});
      map.addLayer({id:'sleep-campsite-halo',type:'circle',source:'sleep-campsites',paint:{'circle-radius':11,'circle-color':'rgba(255,255,255,.78)','circle-blur':.15}});
      map.addLayer({id:'sleep-campsites',type:'circle',source:'sleep-campsites',paint:{'circle-radius':7,'circle-color':['get','color'],'circle-stroke-color':'#101522','circle-stroke-width':2}});
      map.on('mouseenter','sleep-campsites',()=>{map.getCanvas().style.cursor='pointer';});
      map.on('mouseleave','sleep-campsites',()=>{map.getCanvas().style.cursor='';});
      map.on('click','sleep-campsites',e=>{const p=e.features?.[0]?.properties;if(p)openSleepMapInfo(p.searchId,p.candidateId);});
      if(features.length===1)map.jumpTo({center:features[0].geometry.coordinates,zoom:13});
      else if(features.length>1){const bounds=new maplibregl.LngLatBounds();features.forEach(f=>bounds.extend(f.geometry.coordinates));map.fitBounds(bounds,{padding:42,maxZoom:11,duration:0});}
      setTimeout(()=>map.resize(),0);
    });
  }catch(e){sleepDetailFallback(token);}
}
function openZfeInfo(zoneId){
  const data=window.ZFE_DATA,zone=data?.areas?.features?.find(x=>x.properties.id===zoneId)?.properties;if(!zone)return;
  const box=document.getElementById('modalBox');
  box.innerHTML=`<h3>${esc(zone.name)} · ZFE</h3><div class="zfe-modal"><div class="zfe-modal-rule">${esc(zone.threshold)}</div><p>${esc(zone.rule)}</p><dl><dt>Zeiten</dt><dd>${esc(zone.hours)}</dd><dt>Ausnahmen</dt><dd>${esc(zone.exceptions)}</dd><dt>Datenstand</dt><dd>${esc(zone.checkedAt)}</dd></dl><div class="zfe-warning">Die Fläche ist amtlich. Ob eure konkrete Zufahrt erlaubt ist, hängt trotzdem von Fahrzeugklasse, Plakette, Ausnahmeroute und möglichen temporären Luftreinhalte-Maßnahmen ab.</div><a class="btn primary" href="${esc(zone.sourceUrl)}" target="_blank" rel="noopener">Amtliche Regeln öffnen</a></div><div class="btnrow"><button class="btn ghost" onclick="closeModal()">Schließen</button></div>`;
  document.getElementById('modalBg').classList.add('open');
}
function zfeMapSummary(rows){
  if(!window.ZFE_DATA)return '';
  const assessed=rows.map(row=>zfeCandidateAssessment(row.c)).filter(Boolean),inside=assessed.filter(x=>x.status==='inside'),light=assessed.filter(x=>x.status==='inside-light-free'),near=assessed.filter(x=>x.status==='near');
  if(inside.length)return `<div class="zfe-map-summary danger"><b>${inside.length} Kartenpunkt${inside.length===1?' liegt':'e liegen'} in einer ZFE.</b><span>Ohne passende Plakette nicht anfahren; Zufahrt amtlich prüfen.</span></div>`;
  if(light.length||near.length)return `<div class="zfe-map-summary"><b>Campingplatz-Punkte geprüft.</b><span>${light.length?`${light.length} in Nice; leichte Fahrzeuge sind nicht vom Fahrverbot betroffen, die Plakettenpflicht muss trotzdem geprüft werden. `:''}${near.length?`${near.length} nahe einer ZFE; Zufahrt auf der Detailkarte prüfen.`:'Die übrigen liegen außerhalb der dargestellten Dauer-ZFEs.'}</span></div>`;
  if(assessed.length)return `<div class="zfe-map-summary clear"><b>${assessed.length} französische Kartenpunkte außerhalb der Dauer-ZFEs.</b><span>Das gilt für den Zielpunkt, nicht automatisch für jede vorgeschlagene Zufahrt.</span></div>`;
  return '';
}
function buildSleepMap(){
  const rows=sleepMapRows();
  const plotted=rows.filter(row=>sleepCandidatePositioned(row.c));
  sleepDetailRows=plotted;
  const counts=Object.fromEntries(Object.keys(SLEEP_MAP_STATUS_FILTERS).map(key=>[key,sleepMapRows(key).length]));
  const statusFilter=`<div class="sleep-map-filter-label">Kontaktstatus</div><div class="sleep-map-filters" id="sleepMapFilters" role="group" aria-label="Campingplätze nach Kontaktstatus filtern">${Object.entries(SLEEP_MAP_STATUS_FILTERS).map(([key,filter])=>`<button class="${sleepMapStatus===key?'active':''}" aria-pressed="${sleepMapStatus===key}" onclick="setSleepMapStatus('${key}')">${filter.label}<span>${counts[key]}</span></button>`).join('')}</div>`;
  const layerSwitch=`<div class="sleep-map-layer" role="group" aria-label="Kartendarstellung"><button class="${sleepMapLayer==='detail'?'active':''}" aria-pressed="${sleepMapLayer==='detail'}" onclick="setSleepMapLayer('detail')">Detailkarte <span>online</span></button><button class="${sleepMapLayer==='offline'?'active':''}" aria-pressed="${sleepMapLayer==='offline'}" onclick="setSleepMapLayer('offline')">Offlinekarte</button></div>${sleepMapLayer==='detail'&&window.ZFE_DATA?`<label class="sleep-zfe-toggle"><input type="checkbox" ${sleepZfeVisible?'checked':''} onchange="setSleepZfeVisible(this.checked)"><span>Französische ZFE</span><small>amtlich · Stand ${esc(window.ZFE_DATA.checkedAt)}</small></label>`:''}`;
  let mapHtml='';
  if(sleepMapLayer==='detail')mapHtml=`<div class="sleep-detail-wrap"><div class="sleep-detail-map" id="sleepDetailMap" aria-label="Interaktive Detailkarte mit ${plotted.length} ${plotted.length===1?'Campingplatz':'Campingplätzen'}"></div><div class="sleep-detail-status" id="sleepDetailMapStatus">Detailkarte wird geladen …</div></div>`;
  else{
  const v=mapView('sleep',renderSleep,defaultCorridorView()); MZ=v.z;
  const inner=plotted.map(row=>{const c=sleepCandidateView(row.c);return markerSvg({lat:Number(c.lat),lng:Number(c.lng)},{kind:'dot',color:SLEEP_MAP_COLORS[c.status]||'#b6bfcc',label:{type:'sleep',searchId:row.search.id,candidateId:row.c.id}});}).join('')+userPosMarker();
    mapHtml=`<div class="sleep-map">${baseMapSvg(inner,'sleep')}</div><div class="zfe-offline-note">Exakte ZFE-Grenzen sind auf der scharfen Detailkarte sichtbar.</div>`;
  }
  return `${statusFilter}${layerSwitch}${mapHtml}${sleepUnpositionedList()}<div class="sleep-legend"><span><i style="background:#8ea8ff"></i>gesichert</span><span><i style="background:#5fd4a8"></i>reservierbar</span><span><i style="background:#ffb257"></i>spontan</span><span><i style="background:#54c8ff"></i>Anfrage offen</span><span><i style="background:#ffd76b"></i>erneut fragen</span><span><i style="background:#737b8d"></i>nicht verfügbar</span>${sleepMapLayer==='detail'&&sleepZfeVisible&&window.ZFE_DATA?'<span><i class="zfe-area-key"></i>ZFE</span><span><i class="zfe-road-key"></i>offizielle Transitroute</span>':''}</div>${zfeMapSummary(plotted)}${sleepMapLayer==='detail'&&sleepZfeVisible&&window.ZFE_DATA?`<p class="zfe-source-note">Dauerhafte ZFE, Stand ${esc(window.ZFE_DATA.checkedAt)}. Flächen anklicken für Regeln. <a href="${esc(window.ZFE_DATA.nationalSource.url)}" target="_blank" rel="noopener">Amtliche Datenquelle</a> · <a href="${esc(window.ZFE_DATA.temporaryRestrictionsUrl)}" target="_blank" rel="noopener">temporäre Warnlage</a>.</p>`:''}`;
}
function sleepVenueContexts(candidate){
  const name=normalizeSleepQuery(sleepCandidateView(candidate).name),placeId=candidate.placeId;
  return (state.sleepSearches||[]).flatMap(search=>(search.candidates||[]).filter(c=>placeId?c.placeId===placeId:normalizeSleepQuery(sleepCandidateView(c).name)===name).map(c=>({search,c})));
}
function openSleepMapInfo(searchId,candidateId){
  const {s,c}=findSleep(searchId,candidateId);if(!c)return;const box=document.getElementById('modalBox'),contexts=sleepVenueContexts(c);
  box.innerHTML=`<h3>Schlafplatz</h3><div class="sleep-venue-contexts"><div class="sleep-venue-context-label">Reiseabschnitt${contexts.length>1?'e':''}</div>${contexts.map(row=>`<button class="${row.c.id===c.id?'active':''}" onclick="openSleepMapInfo('${row.search.id}','${row.c.id}')"><b>${esc(row.search.title)}</b><span>${esc([sleepSearchWindowLabel(row.search),row.search.region,SLEEP_STATUSES[row.c.status]?.label].filter(Boolean).join(' · '))}</span></button>`).join('')}<button class="sleep-context-edit" onclick="closeModal();editSleepSearch('${s.id}')">Abschnitt bearbeiten</button></div>${sleepCandidateCard(s,c)}<div class="btnrow"><button class="btn ghost" onclick="closeModal()">Schließen</button></div>`;document.getElementById('modalBg').classList.add('open');
}
function nextMailAssistantRun(a){if(a.nextRunAt&&new Date(a.nextRunAt)>new Date())return new Date(a.nextRunAt);const now=new Date(),hours=[8,14,20];for(const h of hours){const d=new Date(now);d.setHours(h,0,0,0);if(d>now)return d;}const d=new Date(now);d.setDate(d.getDate()+1);d.setHours(8,0,0,0);return d;}
function mailRunnerState(){const a=state.mailAssistant||{},mode=a.runnerMode||'local',key=mode==='cloud'?'cloud':'local';return {mode,key,runner:a.runners?.[key]||a};}
function renderMailAssistantStatus(){
  const a=state.mailAssistant||{},active=mailRunnerState(),r=active.runner,pending=(a.draftRequests||[]).filter(x=>['requested','ready','fallback'].includes(x.status)).length,reviews=(a.reviewQueue||[]).filter(x=>x.status==='pending').length,needsDimensions=!camperProfile().lengthM&&(state.sleepSearches||[]).some(s=>(s.candidates||[]).some(c=>/camperlänge|camper length|vehicle size/i.test((c.nextAction||'')+' '+(c.reply||'')))),last=r.lastSuccessAt?new Date(r.lastSuccessAt).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'noch nie',nextDate=nextMailAssistantRun(r),next=nextDate.toLocaleString('de-DE',{weekday:'short',hour:'2-digit',minute:'2-digit'}),overdue=!!(r.nextRunAt&&Date.now()>Date.parse(r.nextRunAt)+90*60*1000),label=active.mode==='cloud'?'Cloud':active.mode==='shadow'?'Mac · Cloud-Test':'Mac';
  if(!r.lastError&&!overdue&&!pending&&!reviews&&!needsDimensions)return '';
  return `<div class="mail-assistant${r.lastError||overdue?' error':''}"><span>✉️</span><div><b>Mail-Assistent · ${label}</b>${pending?' · '+pending+' Entwurf'+(pending===1?'':'e')+' prüfen':''}${reviews?' · '+reviews+' Antwort'+(reviews===1?'':'en')+' einordnen':''}${needsDimensions?' · Camperlänge ergänzen':''}${overdue?`<br>Letzter Check ${esc(last)} · nächster Versuch ${esc(next)}`:''}${r.lastError?`<br>${esc(r.lastError)}`:''}</div></div>`;
}
function mailReviewCandidate(q){const s=(state.sleepSearches||[]).find(x=>x.id===q.searchId),c=s?.candidates?.find(x=>x.id===q.candidateId);return {s,c};}
function copyMailReview(id){
  const q=(state.mailAssistant.reviewQueue||[]).find(x=>x.id===id);if(!q)return;
  const {s,c}=mailReviewCandidate(q),view=c?sleepCandidateView(c):null,name=view?.name||q.campsiteName||'Unbekannt',forwardedSent=q.source==='forwarded'&&q.forwardDirection==='sent';
  const txt=forwardedSent?`Bitte prüfe, ob diese weitergeleitete Nachricht belegt, dass die Crew den Campingplatz bereits kontaktiert hat. Ändere keine Verfügbarkeit.\n\nCampingplatz: ${name}\nZeitraum: ${s?.dateLabel||q.dateLabel||''}\nBetreff: ${q.subject||''}\nTextauszug:\n${q.excerpt||''}`:`Bitte ordne diese Campingplatz-Antwort ein. Wähle genau einen Status: reservierbar, spontan anrufen/ankommen, später nachfragen, Anzahlung nötig, bestätigt, nicht verfügbar oder unklar. Gib danach eine kurze deutsche Zusammenfassung und den nächsten sinnvollen Schritt.\n\nCampingplatz: ${name}\nZeitraum: ${s?.dateLabel||q.dateLabel||''}\nBetreff: ${q.subject||''}\nNeuester Antwortteil:\n${q.excerpt||''}`;
  const done=()=>toast('Für Codex kopiert');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done));else fallbackCopy(txt,done);
}
function resolveMailReview(id,status){
  const q=(state.mailAssistant.reviewQueue||[]).find(x=>x.id===id);if(!q||q.status!=='pending')return;const {s,c}=mailReviewCandidate(q);if(!s||!c){toast('Zugehöriger Campingplatz nicht gefunden');return;}
  const allowed=['contacted','available','reservable','call','followup','deposit_required','booked','unavailable'];if(!allowed.includes(status))return;const undo=sleepUndo(),now=new Date().toISOString();
  if(status==='contacted'){
    c.status='awaiting';c.draftState='sent';c.contactedAt=c.contactedAt||q.receivedAt||now;c.nextAction='Auf Antwort warten';q.status='resolved';q.resolvedAt=now;q.resolvedBy=whoami()||null;syncSleepCandidate(s,c);logChange('hat den weitergeleiteten Versand an „'+sleepCandidateView(c).name+'“ bestätigt',undo);save();renderAll();return;
  }
  const target=status==='booked'?'reserving':status;c.status=target;c.repliedAt=c.repliedAt||q.receivedAt||now;if(status==='booked')c.nextAction='Bestätigung für Datum, Gruppe, Camper und Auto prüfen';if(!c.replyQuote&&q.excerpt)c.replyQuote=q.excerpt.split(/(?<=[.!?])\s+/)[0].slice(0,240);q.status='resolved';q.resolvedAt=now;q.resolvedBy=whoami()||null;syncSleepCandidate(s,c);logChange('hat die Antwort von „'+sleepCandidateView(c).name+'“ manuell als „'+(status==='booked'?'Bestätigung prüfen':SLEEP_STATUSES[target].label)+'“ eingeordnet',undo);save();renderAll();if(status==='booked')toast('Vor „Bestätigt“ bitte alle vier Buchungsangaben prüfen');
}
function renderMailReviewQueue(search){
  const rows=(state.mailAssistant?.reviewQueue||[]).filter(q=>q.status==='pending'&&(!search||q.searchId===search.id));if(!rows.length)return '';
  return `<div class="section-label">Manuell prüfen · ${rows.length}</div>${rows.map(q=>{const {c}=mailReviewCandidate(q),name=c?sleepCandidateView(c).name:q.campsiteName||'Unbekannter Platz',forwarded=q.source==='forwarded',forwardedSent=forwarded&&q.forwardDirection==='sent',label=forwardedSent?'Weitergeleiteten Versand prüfen':forwarded?'Weitergeleitete Antwort prüfen':'Antwort nicht eindeutig',actions=forwardedSent?`<button class="btn primary small" onclick="resolveMailReview('${q.id}','contacted')">Versand bestätigen</button>`:`<button class="btn ghost small" onclick="resolveMailReview('${q.id}','available')">Verfügbar</button><button class="btn ghost small" onclick="resolveMailReview('${q.id}','reservable')">Reservierung möglich</button><button class="btn ghost small" onclick="resolveMailReview('${q.id}','call')">Spontan</button><button class="btn ghost small" onclick="resolveMailReview('${q.id}','followup')">Später fragen</button><button class="btn ghost small" onclick="resolveMailReview('${q.id}','deposit_required')">Anzahlung</button><button class="btn ghost small" onclick="resolveMailReview('${q.id}','booked')">Bestätigung prüfen</button><button class="btn ghost small" onclick="resolveMailReview('${q.id}','unavailable')">Absage</button>`;return `<div class="mail-review"><div class="mail-review-head"><div><div class="mail-review-label">${label}</div><b>${esc(name)}</b><div class="mail-review-sub">${esc(q.subject||'Ohne Betreff')}</div></div></div><div class="mail-review-excerpt">${esc(q.excerpt||'Kein Textauszug gespeichert.')}</div><div class="mail-review-actions"><button class="btn ghost small" onclick="copyMailReview('${q.id}')">Für Codex kopieren</button>${actions}</div></div>`;}).join('')}`;
}
function openSleepSectionManager(){
  const searches=state.sleepSearches||[],box=document.getElementById('modalBox');
  box.innerHTML=`<h3>Reiseabschnitte</h3><p class="hint">Die Abschnitte ordnen Anfragen und Angebote einem Zeitraum zu. Auf der Übersicht bleiben trotzdem alle Unterkünfte gemeinsam sichtbar.</p><div class="sleep-section-manager">${searches.map(search=>`<button onclick="closeModal();editSleepSearch('${search.id}')"><b>${esc(search.title)}</b><span>${esc([sleepSearchWindowLabel(search),search.region].filter(Boolean).join(' · '))}</span><i>Bearbeiten</i></button>`).join('')||'<div class="sleep-empty"><b>Noch kein Reiseabschnitt</b></div>'}</div><div class="btnrow"><button class="btn primary" onclick="closeModal();addSleepSearch(false)">+ Reiseabschnitt</button><button class="btn ghost" onclick="closeModal()">Schließen</button></div>`;
  document.getElementById('modalBg').classList.add('open');
}
function renderSleep(){
  destroySleepDetailMap();
  const searches=state.sleepSearches||[],counts=sleepFilterCounts(),searchMode=!!sleepQuery.trim();
  document.getElementById('page-sleep').innerHTML=sectionBackButton()+`<div class="sleep-overview-head"><div><h2>Schlafplätze</h2><span>${searches.length} Reiseabschnitte · alle Unterkünfte im Überblick</span></div><div class="sleep-overview-actions"><button class="btn ghost small" onclick="openSleepSectionManager()">Abschnitte</button><button class="btn primary small" onclick="addSleepCandidate()">+ Unterkunft</button></div></div><div class="sleep-finder"><span aria-hidden="true">⌕</span><input id="sleepFinder" type="search" value="${esc(sleepQuery)}" placeholder="Unterkunft auf der Route suchen" aria-label="Unterkunft auf der Route suchen" oninput="setSleepQuery(this.value)">${sleepQuery?'<button onclick="clearSleepQuery()" aria-label="Suche löschen">×</button>':''}</div>
  ${searchMode?renderSleepSearchResults():`<div class="sleep-viewbar">${sleepView==='list'?`<div class="sleep-nav">${[['action','Nutzbar'],['waiting','Kontakt'],['closed','Absagen']].map(([v,l])=>`<button class="${sleepFilter===v?'active':''}" onclick="setSleepFilter('${v}')">${l}<span>${counts[v]}</span></button>`).join('')}</div>`:'<div class="sleep-view-context">Ganze Route</div>'}<div class="sleep-segment"><button class="${sleepView==='list'?'active':''}" onclick="setSleepView('list')">Liste</button><button class="${sleepView==='map'?'active':''}" onclick="setSleepView('map')">Karte</button></div></div>${searches.length?(sleepView==='map'?buildSleepMap():renderSleepCandidateList()):'<div class="card sleep-empty"><b>Noch keine Reiseabschnitte</b><span>Lege zuerst einen Abschnitt für eine Nacht oder einen flexiblen Korridor an.</span><button class="btn primary small" onclick="addSleepSearch(true)">Heute planen</button></div>'}${renderMailAssistantStatus()}${renderMailReviewQueue()}`}`;
  if(sleepView==='map')keepActiveSleepMapStatusVisible();
  if(activeTab==='sleep'&&sleepView==='map'&&sleepMapLayer==='detail')setTimeout(initSleepDetailMap,0);
}
// Camping-Kontakte: ältere Liste zum spontanen Anrufen, falls der geplante
// Platz voll ist. Bewusst schlank (Name, Ort, Telefon, Karten-Link, Notiz) —
// keine Priorisierung/Sortierlogik nötig für eine Handvoll Kontakte.
function addCampContact(){
  openModal('Camping-Kontakt hinzufügen', [
    {key:'name',label:'Name des Campingplatzes',value:''},
    {key:'region',label:'Region / Ort',value:''},
    {key:'phone',label:'Telefon',value:'',placeholder:'z. B. +34 123 456 789'},
    {key:'link',label:'Karten-Link (optional)',value:'',placeholder:'https://maps.google.com/…'},
    {key:'note',label:'Notizen',type:'textarea',value:'',placeholder:'z. B. Preis/Nacht, Verfügbarkeit, Ansprechpartner'},
  ], v=>{
    const name = v.name.trim();
    if(!name){ toast('Bitte einen Namen eintragen'); return; }
    const contact = {id:uid(), name, region:v.region.trim(), phone:v.phone.trim(), link:v.link.trim(), note:v.note.trim(), createdAt:new Date().toISOString()};
    state.campContacts.push(contact);
    logChange('hat Camping-Kontakt „'+name+'" hinzugefügt', {t:'campAdd', id:contact.id});
  });
}
function editCampContact(id){
  const c = state.campContacts.find(x=>x.id===id);
  if(!c) return;
  openModal('Camping-Kontakt bearbeiten', [
    {key:'name',label:'Name des Campingplatzes',value:c.name},
    {key:'region',label:'Region / Ort',value:c.region||''},
    {key:'phone',label:'Telefon',value:c.phone||'',placeholder:'z. B. +34 123 456 789'},
    {key:'link',label:'Karten-Link (optional)',value:c.link||'',placeholder:'https://maps.google.com/…'},
    {key:'note',label:'Notizen',type:'textarea',value:c.note||''},
  ], v=>{
    const name = v.name.trim();
    if(!name){ toast('Bitte einen Namen eintragen'); return; }
    const prev = {name:c.name, region:c.region, phone:c.phone, link:c.link, note:c.note};
    c.name = name; c.region = v.region.trim(); c.phone = v.phone.trim(); c.link = v.link.trim(); c.note = v.note.trim();
    logChange('hat Camping-Kontakt „'+c.name+'" bearbeitet', {t:'campEdit', id, prev});
  }, ()=>{
    const idx = state.campContacts.findIndex(x=>x.id===id);
    if(idx<0) return;
    const contact = copyData(c);
    logChange('hat Camping-Kontakt „'+c.name+'" gelöscht', {t:'campDel', contact, idx});
    state.campContacts.splice(idx,1);
  });
}
function campContactRow(c){
  const telHref = c.phone ? 'tel:'+c.phone.replace(/[^\d+]/g,'') : null;
  const mapsHref = c.link || 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(c.name+(c.region?', '+c.region:''));
  return `<div class="camp-card">
    <div class="camp-head">
      <b>${esc(c.name)}</b>
      <button class="btn ghost small" onclick="editCampContact('${c.id}')">✎</button>
    </div>
    ${c.region?`<div class="camp-region">${esc(c.region)}</div>`:''}
    ${c.phone?`<div class="camp-note">📞 ${esc(c.phone)}</div>`:''}
    ${c.note?`<div class="camp-note">${esc(c.note)}</div>`:''}
    <div class="camp-actions">
      ${telHref?`<a class="btn primary small" href="${esc(telHref)}">📞 Anrufen</a>`:''}
      <a class="btn ghost small" href="${esc(mapsHref)}" target="_blank" rel="noopener">🗺️ Karte</a>
    </div>
  </div>`;
}
// Die drei Orga-Sektionen sind unabhängig klappbar; mehrere dürfen gleichzeitig
// geöffnet sein. Der Set-Zustand überlebt renderAll()-Neuaufbauten.
let orgaOpenSections = new Set(['reminder-erinnerungen']);
let doneRemindersOpen = false;
function rememberOrgaSection(el, id){
  if(el.open) orgaOpenSections.add(id); else orgaOpenSections.delete(id);
}
function orgaSection(id, icon, title, meta, bodyHtml){
  return `
  <details class="orga-section"${orgaOpenSections.has(id)?' open':''} ontoggle="rememberOrgaSection(this,'${id}')">
    <summary>
      <span class="orga-section-icon" aria-hidden="true">${homeIconSvg(icon)}</span>
      <div class="orga-section-text">
        <h3>${esc(title)}</h3>
        <span class="orga-section-meta">${esc(meta)}</span>
      </div>
      <span class="orga-section-chevron" aria-hidden="true">${homeIconSvg('chevron')}</span>
    </summary>
    <div class="orga-section-body">${bodyHtml}</div>
  </details>`;
}
function renderReminder(){
  const reminders = [...(state.reminders||[])];
  const polls = [...(state.polls||[])].sort((a,b)=>(a.closed===b.closed ? new Date(b.createdAt)-new Date(a.createdAt) : (a.closed?1:-1)));
  const openReminderItems = reminders.filter(r=>!r.done);
  const doneReminderItems = reminders.filter(r=>r.done);
  const openReminders = openReminderItems.length;
  const openPolls = polls.filter(p=>!p.closed).length;
  document.getElementById('page-reminder').innerHTML = sectionBackButton() +
    orgaSection('reminder-erinnerungen', 'bell', 'Aufgaben', openReminders ? openReminders+' offen' : 'Alles erledigt',
      `<button class="btn small" onclick="addReminder()">+ Aufgabe</button>
      ${openReminderItems.length ? openReminderItems.map((r,i)=>reminderRow(r,i,openReminderItems.length)).join('') : '<p class="hint" style="margin:12px 0 0">Keine offenen Aufgaben.</p>'}
      ${doneReminderItems.length ? `<details class="done-reminders"${doneRemindersOpen?' open':''} ontoggle="doneRemindersOpen=this.open"><summary>Erledigt (${doneReminderItems.length})</summary>${doneReminderItems.map((r,i)=>reminderRow(r,i,doneReminderItems.length)).join('')}</details>` : ''}
      ${!reminders.length ? '<p class="hint" style="margin:12px 0 0">Lege Aufgaben hier an oder übernimm Punkte aus Packen, Einkauf, Checkliste und Fahrzeug-Dokumenten.</p>' : ''}`) +
    orgaSection('reminder-umfragen', 'poll', 'Umfragen', openPolls ? openPolls+' offen' : (polls.length?'Alle geschlossen':'Keine'),
      `<button class="btn small" onclick="addPoll()">+ Umfrage</button>
      ${polls.length ? `<p class="hint" style="margin:12px 0">Tippe eine Option an, um mit deinem eigenen Profil dafür zu stimmen (Mehrfachauswahl möglich).</p>${polls.map(pollRow).join('')}` : '<p class="hint" style="margin:12px 0 0">Noch keine Umfragen.</p>'}`);
}

/* ============================================================
   BUDGET — geteilte Ausgaben & Ausgleich
   ============================================================ */
// Salden (gezahlt minus Anteil) + Greedy-Ausgleichsvorschläge
function budgetCalc(){
  const ex = state.budget.expenses;
  const total = ex.reduce((s,e)=>s+e.amount,0);
  const bal = {};
  state.crew.forEach(c=>bal[c.id]=0);
  ex.forEach(e=>{
    if(bal[e.payer]!==undefined) bal[e.payer] += e.amount;
    const sharers = e.sharers.filter(id=>bal[id]!==undefined);
    if(sharers.length===0) return;
    const share = e.amount / sharers.length;
    sharers.forEach(id=>bal[id] -= share);
  });
  const debtors = [], creditors = [];
  state.crew.forEach(c=>{
    const b = Math.round(bal[c.id]*100)/100;
    if(b < -0.01) debtors.push({id:c.id, amt:-b});
    else if(b > 0.01) creditors.push({id:c.id, amt:b});
  });
  debtors.sort((a,b)=>b.amt-a.amt); creditors.sort((a,b)=>b.amt-a.amt);
  const settlements = [];
  let di=0, ci=0;
  while(di<debtors.length && ci<creditors.length){
    const pay = Math.min(debtors[di].amt, creditors[ci].amt);
    settlements.push({from:debtors[di].id, to:creditors[ci].id, amt:pay});
    debtors[di].amt -= pay; creditors[ci].amt -= pay;
    if(debtors[di].amt < 0.01) di++;
    if(creditors[ci].amt < 0.01) ci++;
  }
  return {total, bal, settlements};
}
// Ausgleich als Text teilen (z. B. WhatsApp) — Zwischenablage mit Fallback
function copySettlement(){
  const {settlements, total} = budgetCalc();
  if(!settlements.length){ toast('Nichts auszugleichen ✨'); return; }
  const txt = '💶 Roadtrip-Ausgleich (Gesamt: '+euro(total)+')\n' +
    settlements.map(s=>crewById(s.from).name+' → '+crewById(s.to).name+': '+euro(s.amt)).join('\n');
  const done = ()=>toast('Ausgleich kopiert — ab in die Gruppe 📋');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done, ()=>fallbackCopy(txt, done));
  } else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done){
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); done(); }catch(e){ toast('Kopieren nicht möglich'); }
  ta.remove();
}
function renderBudget(){
  const ex = state.budget.expenses;
  const {total, bal, settlements} = budgetCalc();

  document.getElementById('page-budget').innerHTML = sectionBackButton() + `
    <div class="card">
      <h2>💶 Neue Ausgabe</h2>
      <div class="formgrid">
        <input id="exDesc" class="full" placeholder="Was? (z. B. Tanken Brenner, Einkauf Lidl)">
        <input id="exAmount" type="number" step="0.01" inputmode="decimal" placeholder="Betrag €">
        <select id="exPayer">${state.crew.map(c=>`<option value="${c.id}"${c.id===whoami()?' selected':''}>${esc(c.name)} hat gezahlt</option>`).join('')}</select>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:7px;letter-spacing:.06em;text-transform:uppercase">Wird geteilt durch (antippen):</div>
      <div class="chips" id="exSharers">
        ${state.crew.map(c=>`<span class="chip on" style="--c:${c.color}" data-id="${c.id}" onclick="this.classList.toggle('on')"><span class="dot"></span>${esc(c.name)}</span>`).join('')}
      </div>
      <div style="margin-top:13px"><button class="btn primary" style="width:100%" onclick="addExpense()">Ausgabe hinzufügen</button></div>
    </div>

    <div class="grid2">
      <div class="card">
        <h2>⚖️ Salden ${total>0?`<span class="spacer"></span><span style="font-size:12px;color:var(--faint);letter-spacing:0;text-transform:none">Gesamt: ${euro(total)}</span>`:''}</h2>
        ${state.crew.map(c=>{
          const b = bal[c.id];
          return `<div class="balance"><span class="chip static" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span><span class="amt ${b>0.01?'pos':b<-0.01?'neg':''}">${b>0.01?'+':''}${euro(b)}</span></div>`;
        }).join('')}
        <div class="hint">Plus = bekommt Geld zurück · Minus = schuldet</div>
      </div>
      <div class="card">
        <h2>🤝 Ausgleich ${settlements.length?`<span class="spacer"></span><button class="btn small" onclick="copySettlement()">📋 Kopieren</button>`:''}</h2>
        ${settlements.length===0 ? '<p class="hint" style="margin:0">Alles ausgeglichen ✨</p>' :
          settlements.map(s=>`<div class="settle"><b>${esc(crewById(s.from).name)}</b> <span class="arrow">→</span> <b>${esc(crewById(s.to).name)}</b>: ${euro(s.amt)}</div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>🧾 Alle Ausgaben</h2>
      ${ex.length===0 ? '<p class="hint" style="margin:0">Noch keine Ausgaben erfasst.</p>' :
        [...ex].reverse().map(e=>{
          const payer = crewById(e.payer);
          return `
          <div class="expense">
            <div class="info">
              <div class="desc">${esc(e.desc)}</div>
              <div class="sub">${payer?esc(payer.name):'?'} · geteilt durch ${e.sharers.length} · ${new Date(e.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</div>
            </div>
            <span class="amt">${euro(e.amount)}</span>
            <button class="del" onclick="deleteExpense('${e.id}')" aria-label="löschen">✕</button>
          </div>`;
        }).join('')}
    </div>`;
}
function addExpense(){
  const desc = document.getElementById('exDesc').value.trim();
  const amount = parseFloat(String(document.getElementById('exAmount').value).replace(',','.'));
  const payer = document.getElementById('exPayer').value;
  const sharers = [...document.querySelectorAll('#exSharers .chip.on')].map(el=>el.dataset.id);
  if(!desc){ toast('Beschreibung fehlt'); return; }
  if(!amount || amount<=0){ toast('Gültigen Betrag eingeben'); return; }
  if(sharers.length===0){ toast('Mindestens eine Person auswählen'); return; }
  const exp = {id:uid(), date:new Date().toISOString(), desc, amount, payer, sharers};
  state.budget.expenses.push(exp);
  logChange('hat Ausgabe „'+desc+'" ('+euro(amount)+', gezahlt von '+(crewById(payer)?.name||'?')+') eingetragen', {t:'expAdd', id:exp.id});
  save(); renderAll();
  toast('Ausgabe gespeichert 💶');
}
function deleteExpense(id){
  const e = state.budget.expenses.find(x=>x.id===id);
  withUndo('Ausgabe gelöscht', ()=>{
    logChange('hat Ausgabe „'+e.desc+'" ('+euro(e.amount)+') gelöscht', {t:'expDel', expense:{...e}});
    state.budget.expenses = state.budget.expenses.filter(x=>x.id!==id);
  });
}

/* ============================================================
   FESTIVAL
   ============================================================ */
// Line-up nach Bühne — statische Referenzdaten (Stand 08.07.2026, offizielle
// Sizigia-Seite & FestivalMates), bewusst kein state (keine Nutzer-Edits/Sync
// nötig, hält den Cloud-Payload klein). Manche Acts spielen auf >1 Bühne,
// daher Gesamtzahl der Nennungen > Zahl eindeutiger Artists.
const LINEUP = {
  'Origen': {genre:'', color:'#ff8a5c', icon:'sun', artists:[
    "3LMT", "1200MIC by Riktam", "ACE VENTURA", "Ametrina", "Amplify", "Anny", "Anoebis", "Arjuna", "ASTRIX",
    "Atbloom", "Atmos", "Avalon", "Beyond b2b Danger", "Bumbling Loons", "Cesar Mimesis", "Chaac", "Cronocops",
    "Daksinamurti", "Dekel", "Dickster", "Digital Hippie", "Djantrix", "E-Clip", "Emok", "Etnica",
    "Farebi Jalebi", "Filteria", "Freedom Fighters", "Fungus Funk", "Giuseppe", "GMS", "Goa Jonas", "Gorovich",
    "Green Nuns Of The Revolution by Dick Trevor", "Hypnoise", "Hypnoxock", "IAMAI", "Ingrained Instincts",
    "Insane Creatures", "James Monro", "Khromata", "Killerwatts", "Kokmok", "Kulle", "Liquid Soul", "Lunatica",
    "Menog", "Originz", "Out Of Orbit", "Phaxe", "Pleiadians", "Prana", "Psygroo", "Psynonima", "Rajax",
    "Regan", "Render", "RISING DUST", "Ritmo", "Sator Arepo", "Shove", "Smkng Chkrs", "Starlab", "Swarup",
    "Tristan", "Tsuyoshi Suzuki", "Vegan Cake"
  ]},
  'Ombra Sonora': {genre:'', color:'#54c8ff', icon:'moon', artists:[
    "Aaron King", "Art Of Trance", "Axon", "Aynix.x", "Bioterranean", "Bitz Pliz", "BOUNDLESS", "Cajarana",
    "Captain Pastek", "CELLI", "Emiri", "Emok", "Evil Oil Man", "Extrawelt", "Fernanda Pistelli", "Golanski",
    "Hellquist", "Iamai", "Ivana", "Jedidiah", "JOSSIE TELCH", "Kozy", "Kromagon", "Krumelur", "Lara S",
    "L-Xir", "Marycroft", "Merkaba", "Michael Banel", "Miles From Mars", "Mngrm", "Ne Yam", "Okapi",
    "One Million Toys", "Ori", "raxon", "Sumiruna", "Tao Andra", "Technocalor", "TRIFORCE", "Tsu", "Union Jack",
    "Victor Ruiz"
  ]},
  'Lumina': {genre:'', color:'#b18cff', icon:'star', artists:[
    "AZALEH", "BAYAWAKA", "CIOZ", "CONSORZIO OCHIROSSI", "DEACON", "DEKEL", "DELA MOON", "DESERT DWELLERS",
    "FABIAN KROOSS", "FLAVE", "FRIDA DARKO B2B ATRIC", "GRIFFIN KLOUD", "IMAGO", "I.M.D", "JAMES MONRO",
    "JOSKO", "KALYA SCINTILLA", "KINO DOSCUN", "LO.RENZO", "MAIKY", "MENTAL", "NIXE", "NUEQ", "OLIVER KOLETZKI",
    "PSYGROO", "PULLI", "R3NATA", "RAFAEL ARAGON", "SAHRA BASS", "SOMETHING BLUE", "TRIBONE", "UREM",
    "YUSUF LEMONE", "WA JIMA TAPES"
  ]},
};
// Instagram-Links je Artist (nur "confirmed_profile"-Treffer aus der Recherche —
// unsichere/mehrdeutige Zuordnungen bewusst weggelassen). Manche Acts (b2b) haben 2 Links.
const LINEUP_IG = {
  'Origen': {
    '3LMT': ["https://www.instagram.com/element.3lmt/"],
    'ACE VENTURA': ["https://www.instagram.com/dj_aceventura/"],
    'Ametrina': ["https://www.instagram.com/ametrina.music/"],
    'Amplify': ["https://www.instagram.com/amplify_psy_official/"],
    'Anny': ["https://www.instagram.com/djanny_anna/"],
    'Anoebis': ["https://www.instagram.com/joske.anoebis.goa/"],
    'Arjuna': ["https://www.instagram.com/arjuna_parvati/"],
    'ASTRIX': ["https://www.instagram.com/astrixofficial/"],
    'Atbloom': ["https://www.instagram.com/atbloom_official/"],
    'Atmos': ["https://www.instagram.com/atmotech_recording_atmos/"],
    'Avalon': ["https://www.instagram.com/aval0nofficial/"],
    'Beyond b2b Danger': ["https://www.instagram.com/beyond_psytrance/"],
    'Chaac': ["https://www.instagram.com/dj_chaac/"],
    'Cronocops': ["https://www.instagram.com/cronocops/"],
    'Daksinamurti': ["https://www.instagram.com/daksinamurti_sangoma/"],
    'Dekel': ["https://www.instagram.com/dekel_official/"],
    'Dickster': ["https://www.instagram.com/dicksterofficial/"],
    'Digital Hippie': ["https://www.instagram.com/digitalhippieofficial/"],
    'Djantrix': ["https://www.instagram.com/djantrix_official/"],
    'E-Clip': ["https://www.instagram.com/eclipmusic/"],
    'Emok': ["https://www.instagram.com/dj.emok/"],
    'Etnica': ["https://www.instagram.com/etnica.pleiadians.official/"],
    'Farebi Jalebi': ["https://www.instagram.com/farebi.jalebi/"],
    'Filteria': ["https://www.instagram.com/filteriaofficial/"],
    'Freedom Fighters': ["https://www.instagram.com/djfreedomfighters/"],
    'Fungus Funk': ["https://www.instagram.com/fungusfunk/"],
    'Giuseppe': ["https://www.instagram.com/dj_giuseppe_parvatirecords/"],
    'GMS': ["https://www.instagram.com/this_is_gms_official/"],
    'Goa Jonas': ["https://www.instagram.com/goa_jonas/"],
    'Gorovich': ["https://www.instagram.com/gorovich_official/"],
    'Green Nuns Of The Revolution by Dick Trevor': ["https://www.instagram.com/greennunsoftherevolution/"],
    'Hypnoise': ["https://www.instagram.com/hypnoiseofficial/"],
    'Hypnoxock': ["https://www.instagram.com/hypnoxock_live/"],
    'IAMAI': ["https://www.instagram.com/iamai.ourminds/"],
    'Ingrained Instincts': ["https://www.instagram.com/ingrained_instincts/"],
    'James Monro': ["https://www.instagram.com/jimmytheplate/"],
    'Khromata': ["https://www.instagram.com/khromata/"],
    'Killerwatts': ["https://www.instagram.com/killerwatts_nanorecords/"],
    'Kokmok': ["https://www.instagram.com/didkokmok/"],
    'Kulle': ["https://www.instagram.com/kulle.mentalsessions/"],
    'Liquid Soul': ["https://www.instagram.com/liquidsoul_official/"],
    'Lunatica': ["https://www.instagram.com/lunatica_and_lupin/"],
    'Menog': ["https://www.instagram.com/menog_music/"],
    'Originz': ["https://www.instagram.com/originzsangoma/"],
    'Out Of Orbit': ["https://www.instagram.com/outoforbitofficial/"],
    'Phaxe': ["https://www.instagram.com/phaxe432/"],
    'Pleiadians': ["https://www.instagram.com/etnica.pleiadians.official/"],
    'Psygroo': ["https://www.instagram.com/psygroo_own_spirit/"],
    'Psynonima': ["https://www.instagram.com/djane_psynonima/"],
    'Rajax': ["https://www.instagram.com/rajax_outrance/"],
    'Regan': ["https://www.instagram.com/regan_nano/"],
    'Render': ["https://www.instagram.com/render_psytrance/"],
    'RISING DUST': ["https://www.instagram.com/rising_dust/"],
    'Ritmo': ["https://www.instagram.com/ritmomusic/"],
    'Sator Arepo': ["https://www.instagram.com/sator_arepo_deviantforce/"],
    'Shove': ["https://www.instagram.com/shove/"],
    'Starlab': ["https://www.instagram.com/starlabmusic/"],
    'Tristan': ["https://www.instagram.com/djtristanofficial/"],
    'Tsuyoshi Suzuki': ["https://www.instagram.com/tsuyoshi_suzuki_official/"],
    'Vegan Cake': ["https://www.instagram.com/vegancakemusic/"],
  },
  'Ombra Sonora': {
    'Aaron King': ["https://www.instagram.com/aaronking.music/"],
    'Aynix.x': ["https://www.instagram.com/aynix.x/"],
    'Bioterranean': ["https://www.instagram.com/bioterranean/"],
    'BOUNDLESS': ["https://www.instagram.com/boundlessgroove/"],
    'Cajarana': ["https://www.instagram.com/_andre_cajarana_/"],
    'Captain Pastek': ["https://www.instagram.com/captain.pastek/"],
    'Emiri': ["https://www.instagram.com/emirijyanaiyo/"],
    'Emok': ["https://www.instagram.com/dj.emok/"],
    'Evil Oil Man': ["https://www.instagram.com/evil_oil_man/"],
    'Extrawelt': ["https://www.instagram.com/extrawelt/"],
    'Fernanda Pistelli': ["https://www.instagram.com/fepistelli/"],
    'Golanski': ["https://www.instagram.com/bayawaka.golanski/"],
    'Hellquist': ["https://www.instagram.com/hellquistmusic/"],
    'Iamai': ["https://www.instagram.com/iamai.ourminds/"],
    'Ivana': ["https://www.instagram.com/ivana__music/"],
    'JOSSIE TELCH': ["https://www.instagram.com/jossietelch/"],
    'Kozy': ["https://www.instagram.com/kozy_alpaka/"],
    'Kromagon': ["https://www.instagram.com/nikroma.kromagon/"],
    'Krumelur': ["https://www.instagram.com/i_am_krumelur/"],
    'Lara S': ["https://www.instagram.com/lara_s.musik/"],
    'L-Xir': ["https://www.instagram.com/l_xir_music/"],
    'Marycroft': ["https://www.instagram.com/marycroft_macedo/"],
    'Merkaba': ["https://www.instagram.com/kalyascintilla.merkaba/"],
    'Michael Banel': ["https://www.instagram.com/michael.banel/"],
    'Miles From Mars': ["https://www.instagram.com/milesfromars/"],
    'Mngrm': ["https://www.instagram.com/mngrm_official/"],
    'Ne Yam': ["https://www.instagram.com/neyamproject/"],
    'One Million Toys': ["https://www.instagram.com/one_million_toys/"],
    'raxon': ["https://www.instagram.com/raxon/"],
    'Sumiruna': ["https://www.instagram.com/sumiruna_/"],
    'Tao Andra': ["https://www.instagram.com/taoandra/"],
    'Technocalor': ["https://www.instagram.com/technocalormusic/"],
    'TRIFORCE': ["https://www.instagram.com/triforcemusic/"],
    'Tsu': ["https://www.instagram.com/dj_tsu_/"],
    'Victor Ruiz': ["https://www.instagram.com/victorruizdj/"],
  },
  'Lumina': {
    'AZALEH': ["https://www.instagram.com/azalehmusic/"],
    'BAYAWAKA': ["https://www.instagram.com/bayawaka.golanski/"],
    'CIOZ': ["https://www.instagram.com/cioz_/"],
    'DEACON': ["https://www.instagram.com/deacon.za/"],
    'DEKEL': ["https://www.instagram.com/dekel_official/"],
    'DELA MOON': ["https://www.instagram.com/delamoonmusic/"],
    'DESERT DWELLERS': ["https://www.instagram.com/desert_dwellers_music/"],
    'FABIAN KROOSS': ["https://www.instagram.com/fabian.krooss/"],
    'FLAVE': ["https://www.instagram.com/flave.live/"],
    'FRIDA DARKO B2B ATRIC': ["https://www.instagram.com/frida.darko/", "https://www.instagram.com/at.ric/"],
    'I.M.D': ["https://www.instagram.com/i.m.d_music/"],
    'JAMES MONRO': ["https://www.instagram.com/jimmytheplate/"],
    'KALYA SCINTILLA': ["https://www.instagram.com/kalyascintilla.merkaba/"],
    'KINO DOSCUN': ["https://www.instagram.com/kinodoscun/"],
    'LO.RENZO': ["https://www.instagram.com/lo.renzo_music/"],
    'NIXE': ["https://www.instagram.com/nixe.music/"],
    'NUEQ': ["https://www.instagram.com/nueqmusic/"],
    'OLIVER KOLETZKI': ["https://www.instagram.com/oliverkoletzki/"],
    'PSYGROO': ["https://www.instagram.com/psygroo_own_spirit/"],
    'RAFAEL ARAGON': ["https://www.instagram.com/rafaelaragondj/"],
    'SAHRA BASS': ["https://www.instagram.com/sahrabass_music/"],
    'TRIBONE': ["https://www.instagram.com/tribone_akudra/"],
    'UREM': ["https://www.instagram.com/urem_music/"],
    'YUSUF LEMONE': ["https://www.instagram.com/yusuflemone/"],
    'WA JIMA TAPES': ["https://www.instagram.com/wajima_tapes/"],
  },
};
function igIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>';
}
function stageIconSvg(kind){
  const icons = {
    sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1"/></svg>',
    moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.3A8.4 8.4 0 1 1 9.7 4a6.9 6.9 0 0 0 10.3 10.3Z"/></svg>',
    star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.2l1.9 5.4 5.6 0.2-4.5 3.5 1.7 5.5L12 14.6l-4.7 3.2 1.7-5.5-4.5-3.5 5.6-0.2Z"/></svg>',
  };
  return icons[kind] || icons.star;
}
// Zeitpläne je Bühne — bislang nur für Origen veröffentlicht (offizielles Stage-Timetable).
// 'break' = reguläre Bühnenpause, 'eclipse' = Pause für die Sonnenfinsternis am 12.08.
const STAGE_SCHEDULES = {
  'Origen': [
    {day:'Montag', date:'10.08.', sets:[
      ['17:00','1200MIC by Riktam'],['18:00','GMS'],['19:00','Starlab'],['20:30','Avalon'],
      ['22:00','Killerwatts'],['23:00','Amplify f2f Hypnoise'],
    ]},
    {day:'Dienstag', date:'11.08.', sets:[
      ['00:30','Menog'],['02:00','Beyond b2b Danger'],['03:30','Anny'],['05:00','Psynonima'],['06:30','Ametrina'],
      ['08:00','break'],
      ['11:00','Chaac'],['13:00','3LMT'],['14:00','Cronocops'],['15:00','Gorovich'],['16:30','Dekel'],
      ['18:30','Freedom Fighters'],['20:30','Render'],['22:00','Djantrix'],['23:30','Fungus Funk'],
    ]},
    {day:'Mittwoch', date:'12.08. · Sonnenfinsternis', sets:[
      ['01:00','Ingrained Instincts'],['02:30','Digital Hippie'],['04:00','Shove'],['05:30','Goa Jonas'],
      ['08:00','break'],
      ['11:00','Kulle f2f Psygroo'],['13:00','E-Clip'],['14:30','Emok'],['15:30','Emok f2f Phaxe'],
      ['16:30','Phaxe'],['17:30','Bumbling Loons'],
      ['19:00','eclipse'],
      ['20:45','Astrix'],['22:30','Tristan'],
    ]},
    {day:'Donnerstag', date:'13.08.', sets:[
      ['00:00','Regan'],['01:00','Regan f2f Dickster'],['02:00','Dickster'],['03:00','IAMAI'],
      ['04:30','Daksinamurti'],['06:00','Originz & Rajax'],
      ['08:00','break'],
      ['11:00','Khromata'],['12:30','Kokmok'],['14:00','Ritmo'],['15:30','Liquid Soul'],
      ['16:30','Liquid Soul f2f Ace Ventura'],['17:30','Ace Ventura'],['18:30','Rising Dust'],
      ['20:00','Out Of Orbit'],['21:30','Swarup'],['23:00','Giuseppe'],
    ]},
    {day:'Freitag', date:'14.08.', sets:[
      ['00:00','Giuseppe f2f Farebi Jalebi'],['01:00','Farebi Jalebi'],['02:00','Arjuna'],['03:30','Sator Arepo'],
      ['05:00','Insane Creatures'],['06:30','Atbloom'],['08:00','Smkng Chkrs'],['09:30','Lunatica'],
      ['11:00','Vegan Cake'],['12:30','Atmos'],['14:00','James Monro'],['15:30','Hypnoxock'],
      ['17:00','Anoebis'],['18:30','Cesar Mimesis'],['19:30','Filteria'],
      ['20:30','Green Nuns Of The Revolution by Dick Trevor'],['22:00','Prana'],['23:00','Tsuyoshi Suzuki'],
      ['0:00','Celli'],
    ]},
    {day:'Abschluss', date:'15.08.', sets:[
      ['01:30','Etnica & Pleiadians'],
    ]},
  ],
  'Ombra Sonora': [
    {day:'Montag', date:'10.08.', sets:[
      ['21:00','Okapi'],['22:30','TRIFORCE'],['0:00','Captain Pastek'],
    ]},
    {day:'Dienstag', date:'11.08.', sets:[
      ['01:30','Krumelur'],['03:00','Sumiruna'],['04:30','Golanski'],['06:00','Ne Yam'],
      ['07:30','break'],
      ['11:00','Bitz Pliz'],['13:00','Ori'],['15:00','Aynix.x'],['16:30','JOSSIE TELCH'],
      ['18:30','Evil Oil Man'],['20:30','Mngrm'],['22:00','BOUNDLESS'],['00:00','Tsu'],
    ]},
    {day:'Mittwoch', date:'12.08. · Sonnenfinsternis', sets:[
      ['01:30','Hellquist'],['03:00','Kromagon'],['05:00','Emiri'],
      ['07:00','break'],
      ['11:00','Technocalor'],['13:00','L-Xir'],['14:30','raxon'],['16:30','Moonclipse'],
      ['18:30','eclipse'],
      ['21:00','Extrawelt'],['22:30','Eitan Reiter'],['00:00','Victor Ruiz'],
    ]},
    {day:'Donnerstag', date:'13.08.', sets:[
      ['01:30','Tao Andra'],['03:00','Bioterranean'],['05:00','Lara S'],
      ['07:00','break'],
      ['11:00','Axon'],['13:00','One Million Toys'],['14:30','Jedidiah'],['16:30','Miles From Mars'],
      ['18:00','Union Jack'],['19:00','Art Of Trance'],['20:00','Merkaba'],['21:30','Sleek'],
      ['23:00','Fernanda Pistelli'],
    ]},
    {day:'Freitag', date:'14.08.', sets:[
      ['00:30','Michael Banel'],['02:00','Aaron King'],['04:00','Kozy'],['06:00','Orgnz'],
      ['08:00','break'],
      ['13:00','Sorry 4 Tomorrow'],['15:00','Nanoplex'],['17:00','Ivana'],['19:00','Kasey Taylor'],
      ['22:00','closing'],
    ]},
  ],
  'Lumina': [
    {day:'Montag', date:'10.08.', sets:[
      ['11:00','WA JIMA TAPES'],['14:00','KINO DOSCUN'],['17:00','LO.RENZO'],['19:00','KALYA SCINTILLA'],
      ['21:00','TRIBONE'],['23:00','DARWIN'],
    ]},
    {day:'Dienstag', date:'11.08.', sets:[
      ['02:00','DELA MOON'],['05:00','MENTAL'],['08:00','SOMETHING BLUE'],['10:00','DEACON'],
      ['12:00','YUSUF LEMONE'],['14:00','PULLI'],['16:00','R3NATA'],['18:00','UREM'],
      ['20:00','JOSKO'],['23:00','NESS'],
    ]},
    {day:'Mittwoch', date:'12.08. · Sonnenfinsternis', sets:[
      ['02:00','CONSORZIO OCHIROSSI'],['05:00','MATILDOUTZ'],['08:00','IMAGO'],['11:00','MAIKY'],
      ['13:00','I.M.D'],['15:00','NIXE'],
      ['18:00','surprise'],
      ['19:00','eclipse'],
      ['21:30','DESERT DWELLERS'],['0:00','BAYAWAKA'],
    ]},
    {day:'Donnerstag', date:'13.08.', sets:[
      ['02:00','NUEQ'],['04:00','VALLOU'],['07:00','TIKAL'],['10:00','RAFAEL ARAGON'],
      ['12:00','FLAVE'],['14:00','SAHRA BASS'],['16:00','FRIDA DARKO B2B ATRIC'],['18:00','FABIAN KROOSS'],
      ['20:00','OLIVER KOLETZKI'],['22:00','CIOZ'],['0:00','JORKE'],
    ]},
    {day:'Freitag', date:'14.08.', sets:[
      ['02:00','LORIKEET'],['04:00','SÚLFUR'],['08:00','PSYGROO'],['10:00','AZALEH'],
      ['13:00','EITAN REITER & GOROVICH (Downtempo)'],['14:30','DEKEL (Downtempo)'],
      ['16:00','JAMES MONRO (Downtempo)'],['17:30','GRIFFIN KLOUD'],
      ['19:00','closing'],
    ]},
  ],
};
// Ein flacher Name→Instagram-Lookup über alle Bühnen (manche Acts spielen mehrfach,
// z. B. Emok auf Origen und Ombra Sonora — case-insensitive, damit beide Schreibweisen greifen).
const ALL_STAGE_IG = {};
Object.values(LINEUP_IG).forEach(stageMap=>{
  Object.entries(stageMap).forEach(([name,urls])=>{
    const k = name.trim().toLowerCase();
    const set = ALL_STAGE_IG[k] || (ALL_STAGE_IG[k] = new Set());
    urls.forEach(u=>set.add(u));
  });
});
Object.keys(ALL_STAGE_IG).forEach(k=>{ ALL_STAGE_IG[k] = [...ALL_STAGE_IG[k]]; });
// Instagram-Link(s) für eine Timetable-Zeile ermitteln: erst als Ganzes probieren
// (deckt gespeicherte b2b/f2f-Kombis ab), sonst in "X f2f Y"/"X b2b Y"/"X & Y" auftrennen
// und jeden Namen einzeln nachschlagen. Anhänge wie "(Downtempo)" fürs Matching ignorieren.
function scheduleActLinks(actText){
  const clean = actText.replace(/\s*\([^)]*\)\s*$/,'').trim();
  const whole = ALL_STAGE_IG[clean.toLowerCase()];
  if(whole) return whole;
  const parts = clean.split(/\s+(?:f2f|b2b|&)\s+/i).map(p=>p.trim()).filter(Boolean);
  if(parts.length<2) return [];
  const out=[];
  parts.forEach(p=>{ const u=ALL_STAGE_IG[p.toLowerCase()]; if(u) out.push(...u); });
  return out;
}
// Sonder-Einträge im Zeitplan (Pausen etc.) — Wert = Anzeigetext, 'eclipse' bekommt eigenes Styling
const SCHEDULE_MARKERS = {
  break:'Bühnenpause',
  surprise:'🎁 Surprise Set',
  eclipse:'🌑 Sonnenfinsternis-Pause',
  closing:'🏁 Abschluss der Bühne',
};
function renderStageTimetable(days){
  return `<div class="tt-list">${days.map(d=>`
    <div class="tt-day">
      <div class="tt-day-head">${esc(d.day)} <span>${esc(d.date)}</span></div>
      ${d.sets.map(([time,val])=>{
        if(SCHEDULE_MARKERS[val]){
          return `<div class="${val==='eclipse'?'tt-eclipse':'tt-break'}">${SCHEDULE_MARKERS[val]}</div>`;
        }
        const igs = scheduleActLinks(val).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener" class="ig-link" aria-label="Instagram">${igIcon()}</a>`).join('');
        return `<div class="tt-row"><span class="tt-time">${esc(time)}</span><span class="tt-act">${esc(val)}${igs}</span></div>`;
      }).join('')}
    </div>`).join('')}
  </div>`;
}
// Chronologische Liste aller Zeitpunkte einer Bühne (Jahr fix auf 2026 laut Festival-Termin)
function parseScheduleDateTime(dateStr, timeStr){
  const m = dateStr.match(/(\d{1,2})\.(\d{1,2})\./);
  const [hh,mm] = timeStr.split(':').map(Number);
  return new Date(2026, +m[2]-1, +m[1], hh, mm||0, 0, 0);
}
function stageTimeline(days){
  const out=[];
  days.forEach(d=>d.sets.forEach(([time,val])=>out.push({dt:parseScheduleDateTime(d.date,time), val})));
  return out.sort((a,b)=>a.dt-b.dt);
}
// Aktueller Live-Status einer Bühne: vor Festivalstart die ersten zwei Einträge als Vorschau,
// während der Laufzeit "jetzt"/"als Nächstes", danach (>20 Std. nach letztem Slot) nichts mehr.
function stageNowNext(name){
  const days = STAGE_SCHEDULES[name];
  if(!days) return null;
  const timeline = stageTimeline(days);
  if(!timeline.length) return null;
  const now = new Date();
  if(now < timeline[0].dt) return {state:'upcoming', first:timeline[0], second:timeline[1]};
  const last = timeline[timeline.length-1];
  if((now - last.dt)/36e5 > 20) return {state:'ended'};
  let current=timeline[0], next=null;
  for(const entry of timeline){
    if(entry.dt <= now) current = entry; else { next = entry; break; }
  }
  return {state:'live', current, next};
}
function fmtScheduleTime(dt){
  return String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
}
function lineupLiveHtml(name){
  const info = stageNowNext(name);
  if(!info || info.state==='ended') return '';
  const label = v => esc(SCHEDULE_MARKERS[v] || v);
  const row = (tag, entry, cls) => entry
    ? `<span class="lineup-live-row ${cls}"><i>${tag}</i><span class="lineup-live-time">${fmtScheduleTime(entry.dt)}</span><b>${label(entry.val)}</b></span>`
    : '';
  if(info.state==='upcoming'){
    return `<div class="lineup-live">${row('Startet mit', info.first, '')}${row('danach', info.second, 'next')}</div>`;
  }
  return `<div class="lineup-live">${row('🔴 Jetzt', info.current, 'now')}${row('danach', info.next, 'next')}</div>`;
}
function lineupCard(){
  const stages = Object.entries(LINEUP);
  return `<div class="card lineup-card">
    <h2 class="lineup-title">Line-up</h2>
    ${stages.map(([name,v])=>{
      const days = STAGE_SCHEDULES[name];
      const setCount = days ? days.reduce((n,d)=>n+d.sets.filter(([,val])=>!SCHEDULE_MARKERS[val]).length,0) : 0;
      const live = days ? lineupLiveHtml(name) : '';
      return `
      <details class="lineup-stage" style="--accent:${v.color}">
        <summary>
          <span class="lineup-stage-icon" aria-hidden="true">${stageIconSvg(v.icon)}</span>
          <div class="lineup-stage-text">
            <h3>${esc(name)}</h3>
            ${v.genre?`<div class="genre">${esc(v.genre)}</div>`:''}
            ${live || `<div class="lineup-stage-meta">${days?`${setCount} Sets · ${days.length} Tage`:`${v.artists.length} Artists`}</div>`}
          </div>
          <span class="lineup-stage-chevron" aria-hidden="true">▾</span>
        </summary>
        ${days ? renderStageTimetable(days) : `<p class="hint" style="margin:0 14px 14px">Zeitplan für diese Bühne noch nicht veröffentlicht.</p>`}
      </details>`;
    }).join('')}
  </div>`;
}
function renderFestival(){
  document.getElementById('page-festival').innerHTML = sectionBackButton() + lineupCard() +
    state.festival.map(f=>`
      <div class="card">
        <h2>${esc(f.title)} <span class="spacer"></span><button class="btn ghost small" onclick="editFestival('${f.id}')">✎</button></h2>
        <p style="font-size:14.5px;color:var(--muted);white-space:pre-wrap">${esc(f.text)}</p>
      </div>`).join('') +
    `<button class="btn" style="width:100%" onclick="addFestival()">+ Info-Block hinzufügen</button>`;
}
function editFestival(id){
  const f = state.festival.find(x=>x.id===id);
  openModal('Info bearbeiten', [
    {key:'title',label:'Titel',value:f.title},
    {key:'text',label:'Text',type:'textarea',value:f.text},
  ], v=>{
    const prev = {title:f.title, text:f.text};
    Object.assign(f,v);
    logChange('hat Festival-Info „'+f.title+'" bearbeitet', {t:'festEdit', id, prev});
  }, ()=>{
    const idx = state.festival.findIndex(x=>x.id===id);
    logChange('hat Festival-Info „'+f.title+'" gelöscht', {t:'festDel', f:{...f}, idx});
    state.festival = state.festival.filter(x=>x.id!==id);
  });
}
function addFestival(){
  openModal('Neuer Info-Block', [
    {key:'title',label:'Titel',value:''},
    {key:'text',label:'Text',type:'textarea',value:''},
  ], v=>{
    if(!v.title.trim()) return;
    const f = {id:uid(), title:v.title.trim(), text:v.text};
    state.festival.push(f);
    logChange('hat Festival-Info „'+f.title+'" hinzugefügt', {t:'festAdd', id:f.id});
  });
}

/* ============================================================
   VERLAUF (Changelog)
   ============================================================ */
function fmtLogTs(ts){
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  if(d.toDateString() === now.toDateString()) return 'Heute ' + time;
  if(d.toDateString() === new Date(now - 86400000).toDateString()) return 'Gestern ' + time;
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) + ' ' + time;
}
function logRow(e){
  const c = e.who ? crewById(e.who) : null;
  return `<div class="logrow${e.undone?' undone':''}">
    <span class="chip static" style="--c:${c?c.color:'#666'}"><span class="dot"></span>${c?esc(c.name):'—'}</span>
    <div class="loginfo">
      <div class="logdesc">${esc(e.desc)}</div>
      <div class="logts">${fmtLogTs(e.ts)}${e.undone?' · rückgängig gemacht':''}</div>
    </div>
    ${e.undo && !e.undone ? `<button class="btn ghost small" onclick="revertEntry('${e.id}')" title="Diesen Schritt rückgängig machen">↩︎</button>` : ''}
  </div>`;
}
function renderBackupTools(){
  const snaps = getSnapshots();
  return `
    <div class="card backup-card">
      <h2>Datensicherung</h2>
      <p class="hint" style="margin-top:0">Export, Import und automatische Sicherungen bleiben lokal, bis du bewusst speicherst oder synchronisierst. Alte Sicherungen werden beim Öffnen zuerst nur auf diesem Gerät geladen.</p>
      <div class="backup-actions">
        <button class="btn primary" onclick="exportData()">Export</button>
        <button class="btn" onclick="document.getElementById('importFile').click()">Import</button>
        ${snaps.length ? '<button class="btn ghost" onclick="toggleSnapshots()">Sicherungen</button>' : ''}
      </div>
      <input type="file" id="importFile" accept=".json,application/json" style="display:none" onchange="importData(event)">
    </div>
    <div id="snapshotList" style="display:none">
      ${snaps.length ? `
        <div class="card">
          <h2>Automatische Sicherungen</h2>
          ${snaps.map((s,i)=>({s,i})).reverse().map(({s,i})=>`
            <div class="backup-snapshot">
              <span class="k">${new Date(s.ts).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})} ${new Date(s.ts).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span>
              <span class="v">${esc(s.reason)} <button class="btn ghost small" onclick="restoreSnapshot(${i})">Lokal öffnen</button></span>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}
function renderLog(){
  pruneLog();
  const entries = [...(state.log||[])].reverse();
  const me = whoami();
  document.getElementById('page-verlauf').innerHTML = sectionBackButton() + `
    <div class="card">
      <h2>Profil</h2>
      <div class="chips">${state.crew.map(c=>`<span class="chip${me===c.id?' on':''}" style="--c:${c.color}" onclick="setWhoami('${c.id}')"><span class="dot"></span>${esc(c.name)}</span>`).join('')}</div>
      <div class="hint">Wird nur auf diesem Gerät gespeichert — damit der Verlauf weiß, wer was ändert.</div>
    </div>
    ${renderBackupTools()}
    <div class="card">
      <h2>Verlauf</h2>
      ${entries.length===0 ? '<p class="hint" style="margin:0">Noch keine Änderungen protokolliert — ab jetzt wird alles hier festgehalten.</p>' : entries.map(logRow).join('')}
      <div class="hint">Gespeichert werden die letzten ${LOG_MAX} Einträge. Rückgängig ist nur für die letzten ${UNDO_MAX} reversiblen Schritte aktiv — für größere Sprünge: Sicherungen in diesem Bereich.</div>
    </div>`;
}

/* ============================================================
   RENDER-ROOT
   ============================================================ */
function renderAll(){
  mapInfoItems.length = 0;
  // Halb getippte Eingaben (Add-Felder, Budget-Formular) über Re-Renders retten
  const keepVals = {}, offChips = [];
  document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el=>{
    if(el.closest('#modalBox') || el.type==='file' || el.type==='hidden') return;
    if(el.tagName==='SELECT' || el.value) keepVals[el.id] = el.value;
  });
  document.querySelectorAll('#exSharers .chip:not(.on)').forEach(el=>offChips.push(el.dataset.id));
  renderNav();
  renderOverview();
  renderRoute();
  renderSpots();
  renderLogistics();
  renderPacking();
  renderShopping();
  renderBudget();
  renderSleep();
  renderFestival();
  renderReminder();
  renderLog();
  updateSaveInfo();
  // Gerettete Eingaben wiederherstellen
  for(const id in keepVals){
    const el = document.getElementById(id);
    if(el && (el.tagName==='SELECT' || !el.value)) el.value = keepVals[id];
  }
  offChips.forEach(id=>{
    const el = document.querySelector('#exSharers .chip[data-id="'+id+'"]');
    if(el) el.classList.remove('on');
  });
}
renderAll();
// Erstbesuch: Standarddaten direkt persistieren
if(!state.meta.lastSaved) save();
// Erste Nutzung auf diesem Gerät: fragen, wer da tippt (für den Verlauf)
if(!whoami()) setTimeout(askWho, 600);
// Offline-Start ermöglichen: Service Worker cached die App (nur gehostet, nicht file://)
if('serviceWorker' in navigator && location.protocol === 'https:'){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
// Die Detailkarte ist ein optionales Online-Extra. Bei Verbindungsabbruch
// bleibt die eingebettete Karte sofort nutzbar; eine bewusst gewählte
// Offlinekarte wird beim Wiederverbinden nicht ungefragt umgeschaltet.
window.addEventListener('offline',()=>{
  if(sleepMapLayer!=='detail')return;
  sleepMapLayer='offline';
  if(activeTab==='sleep'&&sleepView==='map'){renderSleep();toast('Offline · eingebettete Karte aktiv');}
});
window.addEventListener('online',()=>{
  let preferred='detail';try{preferred=localStorage.getItem(SLEEP_MAP_LAYER_KEY)||'detail';}catch(e){}
  if(preferred!=='detail'||sleepMapLayer==='detail')return;
  sleepMapLayer='detail';
  if(activeTab==='sleep'&&sleepView==='map')renderSleep();
});
// Mehrere offene Tabs synchron halten: schreibt ein anderer Tab, hier nachziehen
// (das storage-Event feuert nur in den JEWEILS ANDEREN Tabs — keine Schleife)
window.addEventListener('storage', e=>{
  if(e.key === LOCAL_ONLY_KEY){
    _localOnlyRestore = e.newValue === '1';
    setSyncStatus(_localOnlyRestore ? 'localOnly' : 'ok');
    return;
  }
  if(e.key === STORAGE_KEY && e.newValue){
    try{
      state = migrate(JSON.parse(e.newValue));
      renderAll();
      if(_localOnlyRestore){
        setSyncStatus('localOnly');
        toast('Lokale Sicherung aus anderem Tab übernommen — nicht synchronisiert');
      } else {
        toast('Daten aus anderem Tab übernommen');
      }
    }catch(err){ console.warn('Tab-Sync fehlgeschlagen', err); }
  }
});
// Cloud-Sync starten (falls konfiguriert): sofort, alle 25 s, bei Fokus & online
if(CLOUD_URL){
  syncNow();
  setInterval(syncNow, 25000);
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) syncNow(); });
}
