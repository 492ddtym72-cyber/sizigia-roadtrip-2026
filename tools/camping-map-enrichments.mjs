export const FIRST_NIGHT_REJECTED_ENRICHMENTS=[
  {name:'Camping Piccolo',region:'Domaso · Comer See',email:'info@piccolocamping.com',phone:'+39 0344 96247',lat:46.15306,lng:9.33429,officialUrl:'https://www.piccolocamping.com/',link:'https://www.google.com/maps/search/?api=1&query=Piccolo+Camping+Domaso',address:'Via Case Sparse 176, 22013 Domaso CO'},
  {name:'Spiaggia Camping',region:'Abbadia Lariana · Comer See',email:'info@campingspiaggia.com',phone:'+39 0341 731621',lat:45.897778,lng:9.331667,officialUrl:'https://www.campingspiaggia.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Spiaggia+Abbadia+Lariana',address:'Via al Campeggio 5, 23821 Abbadia Lariana LC'},
  {name:'Camping Riviera',region:'Calceranica al Lago · Caldonazzosee',email:'info@camping-riviera.net',phone:'+39 0461 724464',lat:46.00394,lng:11.25858,officialUrl:'https://camping-riviera.net/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Riviera+Calceranica+al+Lago',address:'Viale Venezia 10, 38050 Calceranica al Lago TN'},
  {name:'Camping Brione',region:'Riva del Garda',email:'info@campingbrione.com',phone:'+39 0464 520885',lat:45.88129,lng:10.86201,officialUrl:'https://www.campingbrione.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Brione+Riva+del+Garda',address:'Via Brione 32, 38066 Riva del Garda TN'},
  {name:'Camping Maroadi',region:'Torbole sul Garda',email:'info@campingmaroadi.it',phone:'+39 0464 505175',lat:45.87563,lng:10.86882,officialUrl:'https://www.campingmaroadi.it/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Maroadi+Torbole',address:'Via Gardesana 13, 38069 Torbole sul Garda TN'},
  {name:'Camping Al Porto',region:'Torbole sul Garda',email:'info@campingalporto.it',phone:'+39 0464 505891',lat:45.87243,lng:10.87353,officialUrl:'https://www.campingalporto.it/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Al+Porto+Torbole',address:'Via al Cor 3, 38069 Torbole sul Garda TN'},
  {name:'Camping Zoo',region:'Arco · Prabi',email:'info@campingzoo.it',phone:'+39 0464 516232',lat:45.93308,lng:10.89341,officialUrl:'https://campingzoo.it/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Zoo+Arco',address:'Via Legionari Cecoslovacchi 24, 38062 Arco TN'},
  {name:'Camping Al Lago',region:'Riva del Garda',email:'info@campingallago.com',phone:'+39 0464 553186',lat:45.87961,lng:10.85597,officialUrl:'https://www.campingallago.com/en/',link:'https://www.google.com/maps/search/?api=1&query=Camping+Al+Lago+Riva+del+Garda',address:'Viale Rovereto 112, 38066 Riva del Garda TN'},
  {name:'Agricampeggio Ai Prati',region:'Caldonazzo · Caldonazzosee',email:'info@agricampeggioaiprati.it',phone:'+39 353 4680469',lat:46.00051,lng:11.26896,officialUrl:'https://agricampeggioaiprati.it/en/',link:'https://www.google.com/maps/search/?api=1&query=Agricampeggio+Ai+Prati+Caldonazzo',address:'Via Brenta 59, 38052 Caldonazzo TN'},
  {name:'Camping Moosbauer',region:'Bozen',email:'info@moosbauer.com',phone:'+39 0471 918492',lat:46.503289,lng:11.29853,officialUrl:'https://moosbauer.com/en',link:'https://www.google.com/maps/search/?api=1&query=Camping+Moosbauer+Bolzano',address:'Via San Maurizio 83, 39100 Bolzano BZ'},
  {name:'Camping Löwenhof',region:'Vahrn · Brixen',email:'info@loewenhof.it',phone:'+39 0472 836216',lat:46.73444,lng:11.64722,officialUrl:'https://www.loewenhof.it/en',link:'https://www.google.com/maps/search/?api=1&query=Camping+Loewenhof+Vahrn',address:'Brennerstraße 60, 39040 Vahrn BZ'},
  {name:'Schlosshof Resort',region:'Lana · Meran',email:'info@schlosshof.it',phone:'+39 0473 561469',lat:46.611916,lng:11.168366,officialUrl:'https://www.schlosshof.it/en/',link:'https://www.google.com/maps/search/?api=1&query=Schlosshof+Resort+Lana',address:'Feldgatterweg 14, 39011 Lana BZ'}
];

const IDENTITY_KEYS=['region','email','phone','lat','lng','officialUrl','link'];
const norm=value=>String(value||'').trim().toLocaleLowerCase('de');

export function applyPlaceEnrichments(state,entries=FIRST_NIGHT_REJECTED_ENRICHMENTS,now=new Date().toISOString()){
  state.sleepPlaces=Array.isArray(state.sleepPlaces)?state.sleepPlaces:[];
  const result={changed:0,skippedVerified:0,missing:[]};
  for(const entry of entries){
    const place=state.sleepPlaces.find(p=>norm(p.name)===norm(entry.name));
    if(!place){result.missing.push(entry.name);continue;}
    const alreadyExact=IDENTITY_KEYS.every(key=>place[key]===entry[key])&&place.contactVerified===true;
    if(alreadyExact)continue;
    if(place.contactVerified===true){result.skippedVerified++;continue;}
    for(const key of IDENTITY_KEYS)place[key]=entry[key];
    place.contactVerified=true;
    if(!place.notes)place.notes=`Offizielle Kontaktdaten und Kartenposition geprüft (${now.slice(0,10).split('-').reverse().join('.')}). Adresse: ${entry.address}.`;
    result.changed++;
  }
  if(result.changed){
    state.meta=state.meta||{};
    state.meta.rejectedCampingMapEnriched=now;
    state.log=Array.isArray(state.log)?state.log:[];
    state.log.push({id:`camp-map-${now.replace(/\D/g,'').slice(0,17)}`,ts:now,who:'Codex',desc:`hat ${result.changed} archivierte Campingplätze mit geprüften Kartenpositionen und Kontakten ergänzt`,undo:null});
    state.log=state.log.slice(-150);
  }
  return result;
}
