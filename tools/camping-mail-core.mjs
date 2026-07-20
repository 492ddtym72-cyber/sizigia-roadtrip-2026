import crypto from 'node:crypto';

const RX={
  confirmed:/\b(?:booking|reservation)\s+(?:is\s+)?confirmed\b|\bconferma(?:ta|to|zione)\b|\b(?:buchung|reservierung)\s+(?:ist\s+)?bestätigt\b|\bréservation confirmée\b|\breserva confirmada\b/i,
  deposit:/\bdeposit\b|\bdown payment\b|\banzahlung\b|\bcaparra\b|\bacconto\b|\bacompte\b|\barrhes\b|\bseñal\b|\bpaga y señal\b/i,
  call:/\b(?:welcome|feel free) to call\b|\bcall us\b|\bphone us\b|\banrufen\b|\btelefonisch\b|\bchiam(?:are|ate|arci)\b|\barrive without (?:a )?reservation\b|\bwithout reservation\b|\bohne reservierung\b|\bsenza prenotazione\b|\bwalk[ -]?in\b|\b(?:appeler|appelez|nous appeler|rappeler)\b|\bsans réservation\b|\b(?:llamar|llámenos|pueden llamar)\b|\bsin reserva\b/i,
  followup:/\b(?:ask|check|contact|email|write) again\b|\ba few days before\b|\bcloser to (?:the )?date\b|\bkurz vor(?:her| der reise)?\b|\bnoch einmal (?:anfragen|nachfragen|melden)\b|\bricontatt(?:are|ate|arci)\b|\bqualche giorno prima\b|\brecontactez-nous\b|\bquelques jours avant\b|\bvuelva[n]? a (?:consultar|contactar|escribir)\b|\bunos días antes\b/i,
  available:/\b(?:we |still )?have (?:a few |some )?(?:pitches|places|availability)\b|\b(?:pitch|place) (?:is )?available\b|\bcan offer\b|\bverfügbar\b|\bfrei(?:e|en|er)? (?:stellplätze?|plätze?)\b|\bposto disponibile\b|\bdisponibilità\b|\babbiamo (?:alcune?|un) piazzol|\b(?:emplacement|place)s? disponible?s?\b|\bnous avons (?:(?:effectivement|actuellement) )?(?:encore )?(?:(?:des|quelques) )?disponibilit(?:é|és)(?![\p{L}\p{N}])|\b(?:parcela|plaza)s? disponible?s?\b|\btenemos disponibilidad\b/iu,
  reservable:/\b(?:accept|take|offer) (?:advance )?reservations?\b|\bone[- ]night (?:stays?|bookings?|reservations?)\b|\bshort stays? (?:are )?(?:accepted|possible|bookable)\b|\breservations? (?:are )?possible\b|\bkurzaufenthalt\b|\bein[- ]nacht[- ](?:aufenthalt|buchung)\b|\bprenotazioni? (?:sono )?(?:possibili|accettate)\b|\bréservations? (?:sont )?(?:possibles|acceptées)\b|\bune nuit\b|\breservas? (?:son )?(?:posibles|aceptadas)\b|\buna noche\b/i,
  unavailable:/\bfully booked\b|\bno (?:pitches?|places?|availability)\b|\bnot available\b|\bkeine (?:stellplätze?|plätze?|verfügbarkeit)\b|\bausgebucht\b|\bcompletamente prenotat[oi]\b|\bnessuna disponibilità\b|\bnon (?:abbiamo|c['’]è) disponibilità\b|\besaurit[oi]\b|\b(?:complet|complète|complets|complètes)\b|\baucune disponibilité(?![\p{L}\p{N}])|\bpas de disponibilité(?![\p{L}\p{N}])|\b(?:completo|completa|completos|completas)\b|\bno hay disponibilidad\b|\bno puc acceptar\b|\b(?:camping|càmping)\s+(?:està|es)\s+ple\b/iu,
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
  else if(hits.available&&!hits.unavailable){status='available';summary='Der Campingplatz meldet einen verfügbaren Stellplatz oder eine reservierbare Möglichkeit.';nextAction='Angebot und Reservierungsbedingungen prüfen';}
  else if(hits.call){status='call';summary=hits.unavailable?'Aktuell ist kein fester Platz frei, aber ein spontaner Anruf oder eine Anreise ohne Reservierung wurde ausdrücklich angeboten.':'Der Campingplatz erlaubt eine spontane telefonische Anfrage oder Anreise ohne Reservierung.';nextAction='Am Reisetag im angegebenen Zeitfenster anrufen';}
  else if(hits.reservable&&!hits.unavailable){status='reservable';summary='Der Campingplatz akzeptiert grundsätzlich Reservierungen für einen kurzen Aufenthalt; die konkrete Nacht ist noch nicht bestätigt.';nextAction='Sobald die Route feststeht, konkrete Nacht anfragen';}
  else if(hits.followup){status='followup';summary=hits.unavailable?'Aktuell ist kein Platz frei; der Campingplatz bittet um eine erneute Anfrage kurz vor der Reise.':'Der Campingplatz empfiehlt, kurz vor der Reise erneut nachzufragen.';nextAction='Kurz vor der Reise erneut anfragen';}
  else if(hits.unavailable&&!hits.available){status='unavailable';summary='Der Campingplatz hat für den angefragten Zeitraum keinen nutzbaren Stellplatz.';nextAction='Keine weitere Aktion';}
  if(!status||hits.available&&hits.unavailable&&!hits.call&&!hits.followup)return {status:'review',confidence:'low',summary:'Die Antwort ist nicht eindeutig und muss manuell geprüft werden.',nextAction:'Mit Codex oder direkt in der App prüfen',excerpt:safeExcerpt(text),replyQuote:''};
  const evidenceRx=status==='booked'?RX.confirmed:status==='deposit_required'?RX.deposit:status==='call'?RX.call:status==='followup'?RX.followup:status==='available'?RX.available:status==='reservable'?RX.reservable:RX.unavailable;
  return {status,confidence:'high',summary,nextAction,excerpt:safeExcerpt(text),replyQuote:firstEvidenceSentence(text,evidenceRx),mentionsParking:hits.parking};
}

function domain(address=''){return String(address).toLowerCase().split('@')[1]||'';}
function norm(value=''){return String(value).toLowerCase().replace(/[^a-z0-9à-ž]+/gi,' ').trim();}
function addresses(value=''){return [...String(value).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(x=>x[0].toLowerCase());}

export function parseForwardedMessage(value='',{allowHeaderBlock=false}={}){
  const text=String(value).replace(/\r/g,''),marker=/(?:^-{2,}\s*(?:forwarded message|weitergeleitete nachricht|message transféré|mensaje reenviado|messaggio inoltrato)\s*-{2,}$|^(?:begin forwarded message|anfang der weitergeleiteten nachricht|début du message transféré|inicio del mensaje reenviado|inizio messaggio inoltrato)\s*:?$)/im,hit=marker.exec(text);
  if(!hit&&!allowHeaderBlock)return null;
  const tail=hit?text.slice(hit.index+hit[0].length).replace(/^\s+/,''):text,allLines=tail.split('\n');let from='',to='',subject='',bodyAt=-1;
  const fields={from:/^(?:from|von|de|da|expéditeur)\s*:\s*(.+)$/i,to:/^(?:to|an|à|para|a)\s*:\s*(.+)$/i,subject:/^(?:subject|betreff|objet|asunto|oggetto)\s*:\s*(.+)$/i};
  const normalized=line=>line.replace(/^>+\s*/,'').trim(),headerStart=hit?0:allLines.findIndex((line,i)=>i<40&&fields.from.test(normalized(line)));
  if(headerStart<0)return null;
  const lines=allLines.slice(headerStart);
  for(let i=0;i<Math.min(lines.length,40);i++){
    const line=normalized(lines[i]),complete=!!(from&&to&&subject);
    if(!line){if(complete){bodyAt=i+1;break;}continue;}
    let matched=false;
    for(const [key,rx] of Object.entries(fields)){const m=line.match(rx);if(!m)continue;if(key==='from')from=m[1].trim();if(key==='to')to=m[1].trim();if(key==='subject')subject=m[1].trim();matched=true;break;}
    if(matched)continue;
    if(/^(?:date|datum|sent|gesendet|envoyé|fecha|data)\s*:/i.test(line))continue;
    if(complete){bodyAt=i;break;}
  }
  if(!addresses(from).length||!addresses(to).length||!subject)return null;
  const body=lines.slice(bodyAt<0?lines.length:bodyAt).map(line=>line.replace(/^>+\s?/,'')).join('\n').trim();
  return {from,to,subject,body};
}

export function matchForwardedCandidate(forwarded,candidates=[]){
  if(!forwarded)return null;
  const reply=matchCandidate({from:addresses(forwarded.from)[0]||'',subject:forwarded.subject||''},candidates);
  if(reply)return {candidate:reply,direction:'reply'};
  const recipients=new Set(addresses(forwarded.to)),sent=candidates.filter(c=>c.email&&recipients.has(String(c.email).toLowerCase().trim()));
  return sent.length===1?{candidate:sent[0],direction:'sent'}:null;
}

export function forwardedReviewResult(forwarded,direction){
  if(direction==='sent')return {status:'review',suggestedStatus:'contacted',confidence:'manual',summary:'Eine weitergeleitete Nachricht kann eine von der Crew gesendete Camping-Anfrage belegen.',nextAction:'Originalempfänger prüfen und Versand manuell bestätigen',excerpt:safeExcerpt(forwarded?.body||forwarded?.subject||'',600),replyQuote:''};
  const classified=classifyReply(forwarded?.body||'');
  return {...classified,status:'review',suggestedStatus:classified.status==='review'?'':classified.status,confidence:'manual',summary:'Weitergeleitete Campingplatz-Antwort: '+classified.summary,nextAction:'Originalabsender und Einordnung manuell bestätigen'};
}

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
