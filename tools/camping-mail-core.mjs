import crypto from 'node:crypto';

const RX={
  confirmed:/\b(?:booking|reservation)\s+(?:is\s+)?confirmed\b|\bconferma(?:ta|to|zione)\b|\b(?:buchung|reservierung)\s+(?:ist\s+)?bestätigt\b|\bréservation confirmée\b|\breserva confirmada\b/i,
  deposit:/\bdeposit\b|\bdown payment\b|\banzahlung\b|\bcaparra\b|\bacconto\b|\bacompte\b|\barrhes\b|\bseñal\b|\bpaga y señal\b/i,
  call:/\b(?:welcome|feel free) to call\b|\bcall us\b|\bphone us\b|\banrufen\b|\btelefonisch\b|\bchiam(?:are|ate|arci)\b|\barrive without (?:a )?reservation\b|\bwithout reservation\b|\bohne reservierung\b|\bsenza prenotazione\b|\bwalk[ -]?in\b|\b(?:appeler|appelez|nous appeler|rappeler)\b|\bsans réservation\b|\b(?:llamar|llámenos|pueden llamar)\b|\bsin reserva\b/i,
  followup:/\b(?:ask|check|contact|email|write) again\b|\ba few days before\b|\bcloser to (?:the )?date\b|\bkurz vor(?:her| der reise)?\b|\bnoch einmal (?:anfragen|nachfragen|melden)\b|\bricontatt(?:are|ate|arci)\b|\bqualche giorno prima\b|\brecontactez-nous\b|\bquelques jours avant\b|\bvuelva[n]? a (?:consultar|contactar|escribir)\b|\bunos días antes\b/i,
  available:/\b(?:we |still )?have (?:a few |some )?(?:pitches|places|availability)\b|\b(?:pitch|place) (?:is )?available\b|\bcan offer\b|\bverfügbar\b|\bfrei(?:e|en|er)? (?:stellplätze?|plätze?)\b|\bposto disponibile\b|\bdisponibilità\b|\babbiamo (?:alcune?|un) piazzol|\b(?:emplacement|place)s? disponible?s?\b|\bnous avons (?:encore )?(?:des )?disponibilités\b|\b(?:parcela|plaza)s? disponible?s?\b|\btenemos disponibilidad\b/i,
  reservable:/\b(?:accept|take|offer) (?:advance )?reservations?\b|\bone[- ]night (?:stays?|bookings?|reservations?)\b|\bshort stays? (?:are )?(?:accepted|possible|bookable)\b|\breservations? (?:are )?possible\b|\bkurzaufenthalt\b|\bein[- ]nacht[- ](?:aufenthalt|buchung)\b|\bprenotazioni? (?:sono )?(?:possibili|accettate)\b|\bréservations? (?:sont )?(?:possibles|acceptées)\b|\bune nuit\b|\breservas? (?:son )?(?:posibles|aceptadas)\b|\buna noche\b/i,
  unavailable:/\bfully booked\b|\bno (?:pitches?|places?|availability)\b|\bnot available\b|\bkeine (?:stellplätze?|plätze?|verfügbarkeit)\b|\bausgebucht\b|\bcompletamente prenotat[oi]\b|\bnessuna disponibilità\b|\bnon (?:abbiamo|c['’]è) disponibilità\b|\besaurit[oi]\b|\b(?:complet|complète|complets|complètes)\b|\baucune disponibilité\b|\bpas de disponibilité\b|\b(?:completo|completa|completos|completas)\b|\bno hay disponibilidad\b/i,
  parking:/\b(?:small )?car\b|\bparking\b|\bpark(?:ed|ing)?\b|\bkleinwagen\b|\bparkplatz\b|\bauto\b|\bparcheggio\b/i
};

export function normalizeSubject(value=''){
  return String(value).replace(/^(?:(?:re|aw|wg|r|fw|fwd):\s*)+/i,'').replace(/\s+/g,' ').trim().toLowerCase();
}

export function newestReply(value=''){
  const lines=String(value).replace(/\r/g,'').split('\n'),kept=[];
  const quoteStart=/^(?:>+\s*|on .+ wrote:|am .+ schrieb .+:|le .+ a écrit\s*:|el .+ escribió\s*:|il .+ ha scritto\s*:|from\s*:|von\s*:|de\s*:|da\s*:|-{2,}\s*(?:original message|ursprüngliche nachricht|message d['’]origine|mensaje original|messaggio originale)\s*-{2,})/i;
  const signature=/^(?:kind regards|best regards|regards|cordiali saluti|distinti saluti|mit freundlichen grüßen|sent from my iphone)\s*[,.!]*$/i;
  for(const line of lines){
    if(quoteStart.test(line.trim()))break;
    if(signature.test(line.trim()))break;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

export function safeExcerpt(value='',limit=600){
  const clean=newestReply(value).replace(/[ \t]+/g,' ').replace(/\n{2,}/g,'\n').trim();
  if(clean.length<=limit)return clean;
  const cut=clean.slice(0,limit+1),at=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? '),cut.lastIndexOf(' '));
  return clean.slice(0,at>limit*.65?at:limit).trim()+'…';
}

export function messageFingerprint(messageId=''){
  return crypto.createHash('sha256').update(String(messageId).trim().toLowerCase()).digest('hex').slice(0,24);
}

function firstEvidenceSentence(text,rx){
  return text.split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).find(x=>rx.test(x))?.slice(0,240)||'';
}

export function classifyReply(value=''){
  const ownTemplate=/\b(?:I would like to ask if you have availability|Could you please also let me know|If advance reservations are not available|We are 6 adults travelling with one camper and one small car)\b/i;
  const text=safeExcerpt(value,1200).split('\n').filter(line=>!ownTemplate.test(line)).join('\n').trim(),hits=Object.fromEntries(Object.entries(RX).map(([k,rx])=>[k,rx.test(text)]));
  let status='',summary='',nextAction='';
  if(hits.confirmed){status='booked';summary='Der Campingplatz bestätigt die Reservierung ausdrücklich.';nextAction='Buchungsdaten und Zahlungsbedingungen prüfen';}
  else if(hits.deposit){status='deposit_required';summary='Der Platz ist grundsätzlich möglich; für die Buchung wird eine Anzahlung verlangt.';nextAction='Anzahlung, Frist und Zahlungsreferenz prüfen';}
  else if(hits.call){status='call';summary=hits.unavailable?'Aktuell ist kein fester Platz frei, aber ein spontaner Anruf oder eine Anreise ohne Reservierung wurde ausdrücklich angeboten.':'Der Campingplatz erlaubt eine spontane telefonische Anfrage oder Anreise ohne Reservierung.';nextAction='Am Reisetag im angegebenen Zeitfenster anrufen';}
  else if(hits.available&&!hits.unavailable){status='available';summary='Der Campingplatz meldet einen verfügbaren Stellplatz oder eine reservierbare Möglichkeit.';nextAction='Angebot und Reservierungsbedingungen prüfen';}
  else if(hits.reservable&&!hits.unavailable){status='reservable';summary='Der Campingplatz akzeptiert grundsätzlich Reservierungen für einen kurzen Aufenthalt; die konkrete Nacht ist noch nicht bestätigt.';nextAction='Sobald die Route feststeht, konkrete Nacht anfragen';}
  else if(hits.followup){status='followup';summary=hits.unavailable?'Aktuell ist kein Platz frei; der Campingplatz bittet um eine erneute Anfrage kurz vor der Reise.':'Der Campingplatz empfiehlt, kurz vor der Reise erneut nachzufragen.';nextAction='Kurz vor der Reise erneut anfragen';}
  else if(hits.unavailable&&!hits.available){status='unavailable';summary='Der Campingplatz hat für den angefragten Zeitraum keinen nutzbaren Stellplatz.';nextAction='Keine weitere Aktion';}
  if(!status||hits.available&&hits.unavailable&&!hits.call&&!hits.followup)return {status:'review',confidence:'low',summary:'Die Antwort ist nicht eindeutig und muss manuell geprüft werden.',nextAction:'Mit Codex oder direkt in der App prüfen',excerpt:safeExcerpt(text),replyQuote:''};
  const evidenceRx=status==='booked'?RX.confirmed:status==='deposit_required'?RX.deposit:status==='call'?RX.call:status==='followup'?RX.followup:status==='available'?RX.available:status==='reservable'?RX.reservable:RX.unavailable;
  return {status,confidence:'high',summary,nextAction,excerpt:safeExcerpt(text),replyQuote:firstEvidenceSentence(text,evidenceRx),mentionsParking:hits.parking};
}

function domain(address=''){return String(address).toLowerCase().split('@')[1]||'';}
function norm(value=''){return String(value).toLowerCase().replace(/[^a-z0-9à-ž]+/gi,' ').trim();}

export function matchCandidate({from='',subject=''},candidates=[]){
  const sender=String(from).toLowerCase().trim(),sub=normalizeSubject(subject),senderDomain=domain(sender),scored=[];
  for(const c of candidates){
    const email=String(c.email||'').toLowerCase().trim(),name=norm(c.name),candidateSubject=normalizeSubject(c.threadSubject||'');let score=0;
    let senderEvidence=false;
    if(email&&sender===email){score+=100;senderEvidence=true;}
    else if(email&&senderDomain&&senderDomain===domain(email)&&!['gmail.com','icloud.com','outlook.com','hotmail.com'].includes(senderDomain)){score+=35;senderEvidence=true;}
    if(candidateSubject&&sub===candidateSubject)score+=80;
    if(name&&sub.includes(name))score+=30;
    if(score&&senderEvidence)scored.push({candidate:c,score});
  }
  scored.sort((a,b)=>b.score-a.score);
  if(!scored.length||scored[0].score<30||scored[1]?.score===scored[0].score)return null;
  return scored[0].candidate;
}
