(() => {
  const NAV_TABS = [
    {id:'uebersicht',label:'Start'},
    {id:'route',label:'Route'},
    {id:'spots',label:'Stopps'},
    {id:'budget',label:'Ausgaben'},
    {id:'sleep',label:'Schlafen'},
    {id:'festival',label:'Festival'},
    {id:'games',label:'Game'},
    {id:'crew',label:'Crew'},
  ];
  const ALL_PAGE_IDS = ['uebersicht','route','spots','logistik','packen','einkauf','budget','sleep','festival','reminder','verlauf','crew','games','settings'];
  const REMOVED_FROM_NAV = new Set(['logistik']);

  function ensurePage(id, title){
    if(document.getElementById('page-'+id)) return;
    const page = document.createElement('section');
    page.className = 'page rt-modern-section';
    page.id = 'page-'+id;
    page.dataset.title = title;
    document.querySelector('.wrap').appendChild(page);
  }

  function ensureModernPages(){
    ensurePage('crew','Teilnehmer');
    ensurePage('games','Game');
    ensurePage('settings','Einstellungen');
  }

  function icon(kind){
    const icons={
      people:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M14 14.5a4.5 4.5 0 0 1 6.5 4.5"/></svg>',
      game:'<svg viewBox="0 0 24 24"><path d="M7 8h10a4 4 0 0 1 3.7 5.5l-1.2 3a2.4 2.4 0 0 1-4 1l-1.2-1.2H9.7l-1.2 1.2a2.4 2.4 0 0 1-4-1l-1.2-3A4 4 0 0 1 7 8Z"/><path d="M8 11v4M6 13h4M16.5 12h.01M18.5 14h.01"/></svg>',
      settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
      money:'<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M17 7H9.5a3 3 0 0 0 0 6H14a3 3 0 0 1 0 6H6"/></svg>'
    };
    return icons[kind]||icons.settings;
  }

  function me(){
    const id = typeof whoami==='function' ? whoami() : '';
    return state.crew.find(c=>c.id===id) || null;
  }

  function mainCard({id,title,subtitle,kind,accent}){
    return `<button class="rt-main-card" style="--accent:${accent}" onclick="switchTab('${id}')">
      <span class="rt-main-icon">${icon(kind)}</span>
      <span class="rt-main-copy"><b>${esc(title)}</b><span>${esc(subtitle)}</span></span>
      <span class="rt-main-arrow">›</span>
    </button>`;
  }

  function renderModernHome(){
    const person=me();
    const calc=typeof budgetCalc==='function' ? budgetCalc() : {total:0};
    const route=state.routes.find(r=>r.id===state.selectedRoute)||state.routes[0];
    const trip=typeof tripDayContext==='function' ? tripDayContext() : null;
    const syncText=(document.getElementById('syncBadge')?.textContent||'Cloud-Sync aktiv').trim();
    const initials=(person?.name||'RT').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('page-uebersicht').innerHTML = `
      <div class="rt-home">
        <section class="rt-hero">
          <div class="rt-hero-top">
            <div class="rt-brand"><strong>Roadtrip</strong><span>ADVENTURES</span></div>
            <button class="rt-avatar" onclick="switchTab('crew')" aria-label="Teilnehmer und Profil">${esc(initials)}</button>
          </div>
          <div class="rt-greeting">
            <h1>Hey ${esc(person?.name||'Roadtripper')}! 👋</h1>
            <p>${esc(trip?.timing||'Bereit für das nächste Abenteuer?')}</p>
          </div>
        </section>
        <div class="rt-home-body">
          <div class="rt-primary-grid">
            ${mainCard({id:'budget',title:'Ausgaben',subtitle:'Behalte alle Kosten im Blick',kind:'money',accent:'#ff9f43'})}
            ${mainCard({id:'crew',title:'Teilnehmer',subtitle:'Sieh, wer alles mit dabei ist',kind:'people',accent:'#47dcc9'})}
            ${mainCard({id:'games',title:'Game',subtitle:'Spiele unser Flappy Line Game',kind:'game',accent:'#e66bd3'})}
            ${mainCard({id:'settings',title:'Einstellungen',subtitle:'Profil, Zugang & App-Optionen',kind:'settings',accent:'#f2c84b'})}
          </div>
          <div class="rt-secondary-title">Reise &amp; Planung</div>
          <div class="rt-journey-grid">
            <button class="rt-journey-card" onclick="switchTab('route')"><i>🧭</i>Route</button>
            <button class="rt-journey-card" onclick="switchTab('spots')"><i>📍</i>Stopps</button>
            <button class="rt-journey-card" onclick="switchTab('packen')"><i>🎒</i>Packen</button>
            <button class="rt-journey-card" onclick="switchTab('einkauf')"><i>🛒</i>Einkaufen</button>
            <button class="rt-journey-card" onclick="switchTab('sleep')"><i>⛺</i>Schlafplätze</button>
            <button class="rt-journey-card" onclick="switchTab('festival')"><i>🌒</i>Festival</button>
            <button class="rt-journey-card" onclick="switchTab('reminder')"><i>🔔</i>Orga</button>
            <button class="rt-journey-card" onclick="switchTab('verlauf')"><i>✦</i>Verlauf</button>
          </div>
          <div class="rt-trip-status"><span>${esc(route?.name||'Roadtrip')} · ${euro(calc.total||0)} Ausgaben</span><b>● ${esc(syncText||'bereit')}</b></div>
        </div>
      </div>`;
  }

  function renderCrewPage(){
    const page=document.getElementById('page-crew');
    if(!page) return;
    const balances=typeof budgetCalc==='function'?budgetCalc().bal:{};
    const selected=me()?.id;
    page.innerHTML=sectionBackButton()+`<div class="rt-section-shell">
      <div class="rt-page-head"><div class="kicker">Roadtrip Crew</div><h1>Teilnehmer</h1><p>Alle Mitreisenden und ihr aktueller Ausgaben-Saldo. Tippe auf „Als Profil“, um dieses Gerät zuzuordnen.</p></div>
      <div class="rt-section-art rt-section-art-crew" role="img" aria-label="Roadtrip-Crew am Lagerfeuer vor einer Berglandschaft"></div>
      <div class="rt-crew-grid">${state.crew.map(c=>{
        const b=Math.round((balances[c.id]||0)*100)/100,cls=b>0.01?'pos':b<-0.01?'neg':'';
        const initials=c.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
        return `<div class="rt-person" style="--person:${c.color}"><div class="rt-person-avatar">${esc(initials)}</div><div><strong>${esc(c.name)}${selected===c.id?' · Du':''}</strong><span><button class="btn ghost small" onclick="setWhoami('${c.id}');renderAll()">Als Profil</button></span></div><div class="rt-person-balance ${cls}">${b>0.01?'+':''}${euro(b)}</div></div>`;
      }).join('')}</div>
    </div>`;
  }

  function gameLeaderboardRows(){
    const scores=state.gameLeaderboard&&typeof state.gameLeaderboard==='object'?state.gameLeaderboard:{};
    return state.crew.map(c=>({playerId:c.id,name:c.name,best:Math.max(0,Math.floor(Number(scores[c.id]?.best||0)))}));
  }

  function installGameLeaderboardAdapter(){
    if(!window.RoadtripGame) return;
    window.RoadtripGame.setLeaderboardAdapter({
      async load(){ return gameLeaderboardRows(); },
      async submit({playerId,name,score}){
        if(!state.gameLeaderboard||typeof state.gameLeaderboard!=='object') state.gameLeaderboard={};
        const old=state.gameLeaderboard[playerId];
        const best=Math.max(0,Math.floor(Number(score)||0));
        if(!old||best>Number(old.best||0)){
          state.gameLeaderboard[playerId]={best,name:String(name||crewById(playerId)?.name||playerId),updatedAt:new Date().toISOString()};
          if(typeof save==='function') save();
        }
        return gameLeaderboardRows();
      }
    });
  }

  function renderGamesPage(){
    const page=document.getElementById('page-games');
    if(!page) return;
    const leaders=gameLeaderboardRows().sort((a,b)=>b.best-a.best||a.name.localeCompare(b.name));
    const top=leaders[0]?.best?`${leaders[0].name} · ${leaders[0].best}`:'Noch kein Highscore';
    page.innerHTML=sectionBackButton()+`<div class="rt-section-shell">
      <div class="rt-page-head"><div class="kicker">Arcade</div><h1>Game</h1><p>Flappy Line ist ein endloses Roadtrip-Game. Jeder Run zählt für den persönlichen Crew-Highscore.</p></div>
      <div class="rt-game-hero"><div class="rt-game-panel"><div class="rt-game-kicker">ROUTE RUNNER</div><h2>Flappy Line</h2><p>Bleib im Flow, flieg durch die psychedelischen Tore und schlag den Crew-Highscore.</p><button class="rt-play" onclick="playRoadtripGame()">▶ &nbsp; Spielen</button><div class="rt-scoreline"><span>Crew-Bestwert</span><b>${esc(top)}</b></div></div></div>
    </div>`;
  }

  function renderSettingsPage(){
    const page=document.getElementById('page-settings');
    if(!page) return;
    const current=me();
    const syncText=(document.getElementById('syncBadge')?.textContent||'Cloud-Sync').trim();
    page.innerHTML=sectionBackButton()+`<div class="rt-section-shell">
      <div class="rt-page-head"><div class="kicker">Roadtrip System</div><h1>Einstellungen</h1><p>Geräteprofil und Zugangsoptionen. Die Reisedaten selbst bleiben im bestehenden gemeinsamen Datenspeicher.</p></div>
      <div class="rt-section-art rt-section-art-settings" role="img" aria-label="Camper auf einer tropischen Küstenstraße bei Sonnenuntergang"></div>
      <div class="rt-setting-list">
        <div class="rt-setting"><div><b>Aktuelles Profil</b><span>${esc(current?.name||'Noch nicht gewählt')}</span></div><button onclick="askWho()">Ändern</button></div>
        <div class="rt-setting"><div><b>Cloud-Sync</b><span>${esc(syncText||'Status wird geprüft')}</span></div><button onclick="typeof syncNow==='function'&&syncNow()">Prüfen</button></div>
        <div class="rt-setting"><div><b>Game</b><span>Flappy Line direkt starten</span></div><button onclick="playRoadtripGame()">Spielen</button></div>
      </div>
      <button class="rt-lock" onclick="lockRoadtripApp()">App wieder sperren</button>
    </div>`;
  }

  function renderSupplementalPages(){
    renderCrewPage();
    renderGamesPage();
    renderSettingsPage();
  }

  function modernRenderNav(){
    if(REMOVED_FROM_NAV.has(activeTab)) activeTab='uebersicht';
    document.body.dataset.activeTab=activeTab;
    const nav=document.getElementById('nav');
    nav.innerHTML=NAV_TABS.map(t=>`<button class="tab${t.id===activeTab?' active':''}" onclick="switchTab('${t.id}')">${esc(t.label)}</button>`).join('');
    ALL_PAGE_IDS.forEach(id=>{
      const page=document.getElementById('page-'+id);
      if(page) page.classList.toggle('active',id===activeTab);
    });
    renderSupplementalPages();
  }

  window.playRoadtripGame=function playRoadtripGame(){
    const person=me();
    if(!person){
      if(typeof toast==='function') toast('Bitte zuerst dein Profil auswählen');
      if(typeof askWho==='function') askWho();
      return;
    }
    if(typeof window.openRoadtripGame!=='function'){
      if(typeof toast==='function') toast('Game-Modul konnte nicht geladen werden');
      return;
    }
    installGameLeaderboardAdapter();
    window.openRoadtripGame({
      player:{id:person.id,name:person.name},
      crew:state.crew.map(c=>({id:c.id,name:c.name})),
      backgrounds:[
        './assets/home-roadtrip-sunset-v2.webp',
        './assets/home-crew-campfire-v2.webp',
        './assets/home-settings-van-v2.webp'
      ],
      birdSprite:'./game-assets/psy-bird.png',
      pipeSprite:'./game-assets/psy-pillar.png'
    });
  };

  ensureModernPages();
  document.body.classList.add('modern-roadtrip');
  renderNav=modernRenderNav;
  renderOverview=renderModernHome;
  installGameLeaderboardAdapter();
  renderAll();
})();