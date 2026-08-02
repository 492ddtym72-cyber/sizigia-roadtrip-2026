/* Weighted expense splits
   Loaded after app.js so existing data and equal-split behavior stay compatible.
   An expense may optionally contain `weights: { [crewId]: number }`.
   Missing weights are treated as 1, so all historic expenses remain unchanged. */
(function(){
  'use strict';

  const MIN_WEIGHT = 0.25;
  const MAX_WEIGHT = 10;
  let weightDetailsOpen = false;

  function validWeight(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return 1;
    return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(n * 100) / 100));
  }

  function expenseSharers(expense){
    return [...new Set((expense?.sharers || []).filter(id=>state.crew.some(c=>c.id===id)))];
  }

  function legacyTricountCentWeights(expense, sharers){
    if(expense?.syncSource !== 'tricount' || !expense.weights || typeof expense.weights !== 'object') return null;
    const values = sharers.map(id=>Number(expense.weights[id]));
    if(!values.length || values.some(value=>!Number.isFinite(value) || value<=0)) return null;
    const amountCents = Math.round((Number(expense.amount) || 0) * 100);
    const weightSum = Math.round(values.reduce((sum,value)=>sum+value,0));
    if(amountCents<=0 || weightSum!==amountCents) return null;
    return Object.fromEntries(sharers.map((id,index)=>[id,values[index]]));
  }

  function expenseWeights(expense, sharers){
    // Older Tricount imports stored each person's allocated cents directly as
    // weights (e.g. 2394/2393). Keep those raw ratios for the calculation so
    // the imported cent allocation remains exact; do not clamp them to 10x.
    const legacy = legacyTricountCentWeights(expense, sharers);
    if(legacy) return legacy;

    const stored = expense && expense.weights && typeof expense.weights === 'object' ? expense.weights : {};
    const out = {};
    sharers.forEach(id=>{ out[id] = validWeight(stored[id] == null ? 1 : stored[id]); });
    return out;
  }

  function displayWeights(expense, sharers){
    const legacy = legacyTricountCentWeights(expense, sharers);
    if(!legacy) return expenseWeights(expense, sharers);

    const values = sharers.map(id=>legacy[id]);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // A one-cent spread is the unavoidable remainder of an equal split, not a
    // meaningful custom factor. Show the intended equal 1x split.
    if(max-min<=1) return Object.fromEntries(sharers.map(id=>[id,1]));

    // For genuine custom Tricount allocations, show readable relative factors
    // while the calculation above continues using the exact cent ratios.
    const ratios = Object.fromEntries(sharers.map(id=>[id,legacy[id]/min]));
    const maxRatio = Math.max(...Object.values(ratios));
    const scale = maxRatio>MAX_WEIGHT ? MAX_WEIGHT/maxRatio : 1;
    return Object.fromEntries(sharers.map(id=>[
      id,
      Math.round(Math.max(MIN_WEIGHT, ratios[id]*scale)*100)/100
    ]));
  }

  function isCustomSplit(expense, sharers){
    const shown = displayWeights(expense, sharers);
    return sharers.some(id=>Math.abs(shown[id]-1)>0.001);
  }

  // Centgenaue proportionale Verteilung nach dem Largest-Remainder-Verfahren.
  // Dadurch addieren sich angezeigte Anteile immer exakt zum Ausgabenbetrag.
  function expenseShares(expense){
    const sharers = expenseSharers(expense);
    if(!sharers.length) return {};
    const weights = expenseWeights(expense, sharers);
    const totalWeight = sharers.reduce((sum,id)=>sum+weights[id],0);
    const amountCents = Math.round((Number(expense.amount) || 0) * 100);
    const rows = sharers.map((id,index)=>{
      const raw = amountCents * weights[id] / totalWeight;
      const cents = Math.floor(raw);
      return {id,index,cents,remainder:raw-cents};
    });
    let left = amountCents - rows.reduce((sum,row)=>sum+row.cents,0);
    [...rows]
      .sort((a,b)=>b.remainder-a.remainder || a.index-b.index)
      .forEach(row=>{ if(left>0){ row.cents++; left--; } });
    return Object.fromEntries(rows.map(row=>[row.id,row.cents/100]));
  }

  window.expenseShares = expenseShares;

  window.budgetCalc = function budgetCalc(){
    const ex = state.budget.expenses;
    const total = ex.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const bal = {};
    state.crew.forEach(c=>bal[c.id]=0);
    ex.forEach(e=>{
      const amount = Math.round((Number(e.amount)||0)*100)/100;
      if(bal[e.payer]!==undefined) bal[e.payer] += amount;
      const shares = expenseShares(e);
      Object.entries(shares).forEach(([id,share])=>{ if(bal[id]!==undefined) bal[id] -= share; });
    });
    const debtors = [], creditors = [];
    state.crew.forEach(c=>{
      const b = Math.round(bal[c.id]*100)/100;
      bal[c.id] = b;
      if(b < -0.01) debtors.push({id:c.id, amt:-b});
      else if(b > 0.01) creditors.push({id:c.id, amt:b});
    });
    debtors.sort((a,b)=>b.amt-a.amt); creditors.sort((a,b)=>b.amt-a.amt);
    const settlements = [];
    let di=0, ci=0;
    while(di<debtors.length && ci<creditors.length){
      const pay = Math.round(Math.min(debtors[di].amt, creditors[ci].amt)*100)/100;
      settlements.push({from:debtors[di].id, to:creditors[ci].id, amt:pay});
      debtors[di].amt = Math.round((debtors[di].amt-pay)*100)/100;
      creditors[ci].amt = Math.round((creditors[ci].amt-pay)*100)/100;
      if(debtors[di].amt < 0.01) di++;
      if(creditors[ci].amt < 0.01) ci++;
    }
    return {total:Math.round(total*100)/100, bal, settlements};
  };

  window.rememberWeightDetails = function rememberWeightDetails(open){
    weightDetailsOpen = !!open;
  };

  window.toggleExpenseSharer = function toggleExpenseSharer(id){
    const chip = document.querySelector('#exSharers .chip[data-id="'+id+'"]');
    if(!chip) return;
    chip.classList.toggle('on');
    const row = document.querySelector('.expense-weight-row[data-id="'+id+'"]');
    if(row) row.hidden = !chip.classList.contains('on');
    updateWeightPreview();
  };

  window.changeExpenseWeight = function changeExpenseWeight(id, delta){
    const input = document.querySelector('.expense-weight-input[data-id="'+id+'"]');
    if(!input) return;
    input.value = String(validWeight(Number(input.value || 1) + delta));
    updateWeightPreview();
  };

  window.updateWeightPreview = function updateWeightPreview(){
    const amount = parseFloat(String(document.getElementById('exAmount')?.value || '').replace(',','.')) || 0;
    const active = [...document.querySelectorAll('#exSharers .chip.on')].map(el=>el.dataset.id);
    const weights = {};
    active.forEach(id=>{
      const input = document.querySelector('.expense-weight-input[data-id="'+id+'"]');
      weights[id] = validWeight(input ? input.value : 1);
    });
    const previewExpense = {amount, sharers:active, weights};
    const shares = expenseShares(previewExpense);
    state.crew.forEach(c=>{
      const row = document.querySelector('.expense-weight-row[data-id="'+c.id+'"]');
      if(!row) return;
      row.hidden = !active.includes(c.id);
      const preview = row.querySelector('.expense-weight-preview');
      if(preview) preview.textContent = amount>0 && shares[c.id]!=null ? euro(shares[c.id]) : '—';
    });
  };

  function splitLabel(e){
    const sharers=expenseSharers(e);
    const shown=displayWeights(e,sharers);
    const custom=isCustomSplit(e,sharers);
    if(!custom) return 'gleichmäßig durch '+sharers.length;
    return sharers.map(id=>(crewById(id)?.name||'?')+' '+shown[id]+'×').join(' · ');
  }

  function expenseDate(e){
    const d = new Date(e.date);
    return Number.isNaN(d.getTime()) ? 'Datum unbekannt' : d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
  }

  window.openExpenseDetails = function openExpenseDetails(id){
    const e = state.budget.expenses.find(x=>x.id===id);
    if(!e){ toast('Ausgabe nicht mehr gefunden'); return; }
    const payer = crewById(e.payer);
    const sharers = expenseSharers(e);
    const shownWeights = displayWeights(e,sharers);
    const shares = expenseShares(e);
    const custom = isCustomSplit(e,sharers);
    const sum = sharers.reduce((total,cid)=>total+(shares[cid]||0),0);
    modalCtx = null;
    document.getElementById('modalBox').innerHTML = `
      <h3>💶 ${esc(e.desc)}</h3>
      <div class="expense-detail-meta">${expenseDate(e)}</div>
      <div class="expense-detail-summary">
        <div><span>Gesamtbetrag</span><b>${euro(Number(e.amount)||0)}</b></div>
        <div><span>Bezahlt von</span><b>${payer?esc(payer.name):'Unbekannt'}</b></div>
      </div>
      <div class="expense-detail-heading">Anteile</div>
      <div class="expense-detail-list">
        ${sharers.length ? sharers.map(cid=>{
          const c=crewById(cid);
          const isPayer=cid===e.payer;
          return `<div class="expense-detail-row">
            <span class="chip static" style="--c:${c?.color||'#777'}"><span class="dot"></span>${esc(c?.name||'?')}${isPayer?' · Zahler':''}</span>
            <span class="expense-detail-weight">${shownWeights[cid]}×</span>
            <b>${euro(shares[cid]||0)}</b>
          </div>`;
        }).join('') : '<p class="hint" style="margin:0">Keine gültigen Teilnehmer hinterlegt.</p>'}
      </div>
      <div class="expense-detail-total"><span>Summe der Anteile</span><b>${euro(sum)}</b></div>
      <p class="hint expense-detail-note">${custom?'Die Faktoren bestimmen das Verhältnis der Anteile.':'Diese Ausgabe wurde gleichmäßig verteilt.'} Rundungen werden centgenau verteilt, sodass die Summe immer dem Gesamtbetrag entspricht.</p>
      <div class="btnrow"><button class="btn primary" onclick="closeModal()">Schließen</button></div>`;
    document.getElementById('modalBg').classList.add('open');
  };

  window.renderBudget = function renderBudget(){
    const ex = state.budget.expenses;
    const {total, bal, settlements} = budgetCalc();
    document.getElementById('page-budget').innerHTML = sectionBackButton() + `
      <div class="card">
        <h2>💶 Neue Ausgabe</h2>
        <div class="formgrid">
          <input id="exDesc" class="full" placeholder="Was? (z. B. Tanken Brenner, Einkauf Lidl)">
          <input id="exAmount" type="number" step="0.01" inputmode="decimal" placeholder="Betrag €" oninput="updateWeightPreview()">
          <select id="exPayer">${state.crew.map(c=>`<option value="${c.id}"${c.id===whoami()?' selected':''}>${esc(c.name)} hat gezahlt</option>`).join('')}</select>
        </div>
        <div class="expense-split-head"><span>Wird geteilt durch:</span><span class="hint">Person antippen zum Ein-/Ausschließen</span></div>
        <div class="chips" id="exSharers">
          ${state.crew.map(c=>`<span class="chip on" style="--c:${c.color}" data-id="${c.id}" onclick="toggleExpenseSharer('${c.id}')"><span class="dot"></span>${esc(c.name)}</span>`).join('')}
        </div>
        <details id="exWeightDetails" class="expense-weight-details"${weightDetailsOpen?' open':''} ontoggle="rememberWeightDetails(this.open)">
          <summary>Anteile anpassen <span class="hint">optional · Standard 1×</span></summary>
          <div class="expense-weight-list">
            ${state.crew.map(c=>`<div class="expense-weight-row" data-id="${c.id}">
              <span class="chip static" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span>
              <div class="expense-weight-control">
                <button type="button" class="btn ghost small" onclick="changeExpenseWeight('${c.id}',-0.25)" aria-label="Anteil verringern">−</button>
                <input id="exWeight-${c.id}" class="expense-weight-input" data-id="${c.id}" type="number" min="${MIN_WEIGHT}" max="${MAX_WEIGHT}" step="0.25" value="1" oninput="updateWeightPreview()" aria-label="Anteil von ${esc(c.name)}">
                <span>×</span>
                <button type="button" class="btn ghost small" onclick="changeExpenseWeight('${c.id}',0.25)" aria-label="Anteil erhöhen">+</button>
              </div>
              <b class="expense-weight-preview">—</b>
            </div>`).join('')}
          </div>
          <p class="hint">Beispiel: Max 2×, alle anderen 1× — Max übernimmt damit ungefähr doppelt so viel wie jede andere Person; unvermeidbare Rundungscent werden transparent verteilt.</p>
        </details>
        <div style="margin-top:13px"><button class="btn primary" style="width:100%" onclick="addExpense()">Ausgabe hinzufügen</button></div>
      </div>

      <div class="grid2">
        <div class="card">
          <h2>⚖️ Salden ${total>0?`<span class="spacer"></span><span style="font-size:12px;color:var(--faint);letter-spacing:0;text-transform:none">Gesamt: ${euro(total)}</span>`:''}</h2>
          ${state.crew.map(c=>{ const b=bal[c.id]; return `<div class="balance"><span class="chip static" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span><span class="amt ${b>0.01?'pos':b<-0.01?'neg':''}">${b>0.01?'+':''}${euro(b)}</span></div>`; }).join('')}
          <div class="hint">Plus = bekommt Geld zurück · Minus = schuldet</div>
        </div>
        <div class="card">
          <h2>🤝 Ausgleich ${settlements.length?`<span class="spacer"></span><button class="btn small" onclick="copySettlement()">📋 Kopieren</button>`:''}</h2>
          ${settlements.length===0?'<p class="hint" style="margin:0">Alles ausgeglichen ✨</p>':settlements.map(s=>`<div class="settle"><b>${esc(crewById(s.from).name)}</b> <span class="arrow">→</span> <b>${esc(crewById(s.to).name)}</b>: ${euro(s.amt)}</div>`).join('')}
        </div>
      </div>

      <div class="card">
        <h2>🧾 Alle Ausgaben</h2>
        ${ex.length===0?'<p class="hint" style="margin:0">Noch keine Ausgaben erfasst.</p>':[...ex].reverse().map(e=>{
          const payer=crewById(e.payer);
          return `<div class="expense expense-open" role="button" tabindex="0" aria-label="Details zu ${esc(e.desc)} öffnen" onclick="openExpenseDetails('${e.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openExpenseDetails('${e.id}')}">
            <div class="info"><div class="desc">${esc(e.desc)}</div><div class="sub">${payer?esc(payer.name):'?'} · ${esc(splitLabel(e))} · ${expenseDate(e)}</div></div>
            <span class="amt">${euro(e.amount)}</span>
            <span class="expense-open-icon" aria-hidden="true">›</span>
            <button class="del" onclick="event.stopPropagation();deleteExpense('${e.id}')" aria-label="löschen">✕</button>
          </div>`;
        }).join('')}
      </div>`;
    // renderAll() stellt Formwerte erst nach renderBudget() wieder her.
    // Der verzögerte Aufruf aktualisiert danach Vorschau und ausgeblendete Zeilen.
    setTimeout(updateWeightPreview,0);
  };

  window.addExpense = function addExpense(){
    const desc = document.getElementById('exDesc').value.trim();
    const amount = parseFloat(String(document.getElementById('exAmount').value).replace(',','.'));
    const payer = document.getElementById('exPayer').value;
    const sharers = [...document.querySelectorAll('#exSharers .chip.on')].map(el=>el.dataset.id);
    if(!desc){ toast('Beschreibung fehlt'); return; }
    if(!amount || amount<=0){ toast('Gültigen Betrag eingeben'); return; }
    if(sharers.length===0){ toast('Mindestens eine Person auswählen'); return; }
    const weights = {};
    sharers.forEach(id=>{
      const input=document.querySelector('.expense-weight-input[data-id="'+id+'"]');
      weights[id]=validWeight(input ? input.value : 1);
    });
    const exp = {id:uid(), date:new Date().toISOString(), desc, amount:Math.round(amount*100)/100, payer, sharers};
    if(sharers.some(id=>Math.abs(weights[id]-1)>0.001)) exp.weights=weights;
    state.budget.expenses.push(exp);
    logChange('hat Ausgabe „'+desc+'" ('+euro(exp.amount)+', gezahlt von '+(crewById(payer)?.name||'?')+') eingetragen', {t:'expAdd', id:exp.id});
    save(); renderAll();
    toast('Ausgabe gespeichert 💶');
  };

  const style=document.createElement('style');
  style.textContent=`
    .expense-split-head{display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin:12px 0 7px;font-size:12px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
    .expense-split-head .hint{text-transform:none;letter-spacing:0;margin:0}
    .expense-weight-details{margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:0 12px;background:rgba(255,255,255,.018)}
    .expense-weight-details summary{cursor:pointer;padding:12px 0;font-weight:700;list-style:none}
    .expense-weight-details summary::-webkit-details-marker{display:none}
    .expense-weight-details summary:after{content:'›';float:right;transform:rotate(90deg);color:var(--muted)}
    .expense-weight-details[open] summary:after{transform:rotate(-90deg)}
    .expense-weight-list{display:grid;gap:8px;padding:0 0 10px}
    .expense-weight-row{display:grid;grid-template-columns:minmax(0,1fr) auto 70px;align-items:center;gap:10px}
    .expense-weight-control{display:flex;align-items:center;gap:5px}
    .expense-weight-input{width:54px;text-align:center;padding:7px 5px}
    .expense-weight-preview{text-align:right;font-size:13px}
    .expense-open{cursor:pointer;position:relative;transition:border-color .16s ease,background .16s ease}
    .expense-open:hover,.expense-open:focus-visible{background:rgba(255,255,255,.035);outline:none}
    .expense-open:focus-visible{box-shadow:0 0 0 2px var(--sun)}
    .expense-open-icon{font-size:24px;color:var(--faint);line-height:1}
    .expense-detail-meta{font-size:12px;color:var(--muted);margin:-10px 0 14px}
    .expense-detail-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}
    .expense-detail-summary>div{padding:12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02);display:flex;flex-direction:column;gap:5px}
    .expense-detail-summary span,.expense-detail-heading{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
    .expense-detail-summary b{font-size:16px}
    .expense-detail-heading{margin-bottom:7px}
    .expense-detail-list{display:grid;gap:7px}
    .expense-detail-row{display:grid;grid-template-columns:minmax(0,1fr) 46px 82px;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}
    .expense-detail-row:last-child{border-bottom:0}
    .expense-detail-row b{text-align:right}
    .expense-detail-weight{text-align:center;color:var(--muted);font-size:12px}
    .expense-detail-total{display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:4px;border-top:1px solid var(--line)}
    .expense-detail-note{margin:12px 0 0}
    @media(max-width:520px){.expense-split-head{display:block}.expense-split-head .hint{display:block;margin-top:3px}.expense-weight-row{grid-template-columns:minmax(0,1fr) auto}.expense-weight-preview{grid-column:2}.expense-weight-control{grid-row:1 / span 2;grid-column:2}.expense-weight-preview{display:none}.expense-detail-summary{grid-template-columns:1fr}.expense-detail-row{grid-template-columns:minmax(0,1fr) 38px 72px}}
    @media print{.expense-weight-details,.expense-open-icon{display:none!important}.expense-open{cursor:default}}
  `;
  document.head.appendChild(style);

  // Re-render once after replacing the budget functions. Other sections are untouched.
  if(document.getElementById('page-budget')) renderBudget();
})();
