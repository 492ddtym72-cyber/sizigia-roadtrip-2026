/* Weighted expense splits
   Loaded after app.js so existing data and equal-split behavior stay compatible.
   An expense may optionally contain `weights: { [crewId]: number }`.
   Missing weights are treated as 1, so all historic expenses remain unchanged. */
(function(){
  'use strict';

  const MIN_WEIGHT = 0.25;
  const MAX_WEIGHT = 10;

  function validWeight(value){
    const n = Number(value);
    if(!Number.isFinite(n)) return 1;
    return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(n * 100) / 100));
  }

  function expenseWeights(expense, sharers){
    const stored = expense && expense.weights && typeof expense.weights === 'object' ? expense.weights : {};
    const out = {};
    sharers.forEach(id=>{ out[id] = validWeight(stored[id] == null ? 1 : stored[id]); });
    return out;
  }

  function expenseShares(expense){
    const sharers = (expense.sharers || []).filter(id=>state.crew.some(c=>c.id===id));
    if(!sharers.length) return {};
    const weights = expenseWeights(expense, sharers);
    const totalWeight = sharers.reduce((sum,id)=>sum+weights[id],0);
    const shares = {};
    sharers.forEach(id=>{ shares[id] = expense.amount * weights[id] / totalWeight; });
    return shares;
  }

  window.expenseShares = expenseShares;

  window.budgetCalc = function budgetCalc(){
    const ex = state.budget.expenses;
    const total = ex.reduce((s,e)=>s+e.amount,0);
    const bal = {};
    state.crew.forEach(c=>bal[c.id]=0);
    ex.forEach(e=>{
      if(bal[e.payer]!==undefined) bal[e.payer] += e.amount;
      const shares = expenseShares(e);
      Object.entries(shares).forEach(([id,share])=>{ if(bal[id]!==undefined) bal[id] -= share; });
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
    const totalWeight = active.reduce((sum,id)=>sum+weights[id],0) || 1;
    state.crew.forEach(c=>{
      const row = document.querySelector('.expense-weight-row[data-id="'+c.id+'"]');
      if(!row) return;
      row.hidden = !active.includes(c.id);
      const preview = row.querySelector('.expense-weight-preview');
      if(preview) preview.textContent = amount>0 ? euro(amount * weights[c.id] / totalWeight) : '—';
    });
  };

  function splitLabel(e){
    const sharers=(e.sharers||[]).filter(id=>crewById(id));
    const weights=expenseWeights(e,sharers);
    const custom=sharers.some(id=>Math.abs(weights[id]-1)>0.001);
    if(!custom) return 'gleichmäßig durch '+sharers.length;
    return sharers.map(id=>(crewById(id)?.name||'?')+' '+weights[id]+'×').join(' · ');
  }

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
        <details class="expense-weight-details">
          <summary>Anteile anpassen <span class="hint">optional · Standard 1×</span></summary>
          <div class="expense-weight-list">
            ${state.crew.map(c=>`<div class="expense-weight-row" data-id="${c.id}">
              <span class="chip static" style="--c:${c.color}"><span class="dot"></span>${esc(c.name)}</span>
              <div class="expense-weight-control">
                <button type="button" class="btn ghost small" onclick="changeExpenseWeight('${c.id}',-0.25)" aria-label="Anteil verringern">−</button>
                <input class="expense-weight-input" data-id="${c.id}" type="number" min="${MIN_WEIGHT}" max="${MAX_WEIGHT}" step="0.25" value="1" oninput="updateWeightPreview()" aria-label="Anteil von ${esc(c.name)}">
                <span>×</span>
                <button type="button" class="btn ghost small" onclick="changeExpenseWeight('${c.id}',0.25)" aria-label="Anteil erhöhen">+</button>
              </div>
              <b class="expense-weight-preview">—</b>
            </div>`).join('')}
          </div>
          <p class="hint">Beispiel: Max 2×, alle anderen 1× — Max übernimmt damit doppelt so viel wie jede andere Person.</p>
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
        ${ex.length===0?'<p class="hint" style="margin:0">Noch keine Ausgaben erfasst.</p>':[...ex].reverse().map(e=>{ const payer=crewById(e.payer); return `<div class="expense"><div class="info"><div class="desc">${esc(e.desc)}</div><div class="sub">${payer?esc(payer.name):'?'} · ${esc(splitLabel(e))} · ${new Date(e.date).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</div></div><span class="amt">${euro(e.amount)}</span><button class="del" onclick="deleteExpense('${e.id}')" aria-label="löschen">✕</button></div>`; }).join('')}
      </div>`;
    updateWeightPreview();
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
    const exp = {id:uid(), date:new Date().toISOString(), desc, amount, payer, sharers};
    if(sharers.some(id=>Math.abs(weights[id]-1)>0.001)) exp.weights=weights;
    state.budget.expenses.push(exp);
    logChange('hat Ausgabe „'+desc+'" ('+euro(amount)+', gezahlt von '+(crewById(payer)?.name||'?')+') eingetragen', {t:'expAdd', id:exp.id});
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
    @media(max-width:520px){.expense-split-head{display:block}.expense-split-head .hint{display:block;margin-top:3px}.expense-weight-row{grid-template-columns:minmax(0,1fr) auto}.expense-weight-preview{grid-column:2}.expense-weight-control{grid-row:1 / span 2;grid-column:2}.expense-weight-preview{display:none}}
  `;
  document.head.appendChild(style);

  // Re-render once after replacing the budget functions. Other sections are untouched.
  if(document.getElementById('page-budget')) renderBudget();
})();
