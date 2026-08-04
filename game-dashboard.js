(() => {
  'use strict';

  const HIRES_ART = Object.freeze({
    background: './game-assets/production/hires/game-background.webp',
    bird: './game-assets/production/hires/psy-bird.webp',
    pillar: './game-assets/production/hires/psy-pillar.webp'
  });

  const GAME_CATALOG = [
    {
      id: 'flappy-line',
      title: 'Flappy Line',
      eyebrow: 'Route Runner',
      description: 'Flieg durch die psychedelischen Tore und knack den Crew-Highscore.',
      status: 'playable',
      accent: '#e66bd3',
      art: HIRES_ART,
      action: () => typeof window.playRoadtripGame === 'function' && window.playRoadtripGame()
    }
  ];

  function escapeHtml(value){
    if(typeof window.esc === 'function') return window.esc(String(value ?? ''));
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function leaderboard(){
    const crew = typeof state !== 'undefined' && Array.isArray(state.crew) ? state.crew : [];
    const scores = typeof state !== 'undefined' && state.gameLeaderboard && typeof state.gameLeaderboard === 'object' ? state.gameLeaderboard : {};
    return crew.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color || '#e66bd3',
      best: Math.max(0, Math.floor(Number(scores[c.id]?.best || 0)))
    })).sort((a,b) => b.best - a.best || a.name.localeCompare(b.name));
  }

  function medal(index){
    return ['1','2','3'][index] || String(index + 1);
  }

  function gameCard(game){
    const art = game.art || {};
    return `<article class="arcade-game-card" style="--game-accent:${game.accent}">
      <div class="arcade-game-art" aria-hidden="true">
        <img class="arcade-game-bg" src="${escapeHtml(art.background || '')}" alt="" decoding="async">
        <img class="arcade-game-pillar" src="${escapeHtml(art.pillar || '')}" alt="" decoding="async">
        <img class="arcade-game-bird" src="${escapeHtml(art.bird || '')}" alt="" decoding="async">
      </div>
      <div class="arcade-game-copy">
        <div class="arcade-game-topline"><span>${escapeHtml(game.eyebrow)}</span><i>SPIELBAR</i></div>
        <h2>${escapeHtml(game.title)}</h2>
        <p>${escapeHtml(game.description)}</p>
      </div>
      <button class="arcade-play-button" data-game-id="${escapeHtml(game.id)}" type="button"><span>▶</span> Spielen</button>
    </article>`;
  }

  function render(){
    const page = document.getElementById('page-games');
    if(!page) return;

    const leaders = leaderboard();
    const leader = leaders.find(x => x.best > 0);
    const personalId = typeof whoami === 'function' ? whoami() : '';
    const personal = leaders.find(x => x.id === personalId);
    const back = typeof sectionBackButton === 'function' ? sectionBackButton() : '';

    page.innerHTML = `${back}<div class="rt-section-shell arcade-dashboard">
      <header class="arcade-head">
        <div>
          <div class="arcade-kicker">ROADTRIP ARCADE</div>
          <h1>Games</h1>
          <p>Kleine Games für unterwegs. Highscores bleiben bei der Crew.</p>
        </div>
        <div class="arcade-head-badge" aria-label="${GAME_CATALOG.length} Spiel verfügbar"><b>${GAME_CATALOG.length}</b><span>Game</span></div>
      </header>

      <section class="arcade-stats" aria-label="Arcade Übersicht">
        <div><span>Dein Bestwert</span><strong>${personal?.best || '—'}</strong></div>
        <div><span>Crew-Rekord</span><strong>${leader ? leader.best : '—'}</strong><small>${leader ? escapeHtml(leader.name) : 'Noch offen'}</small></div>
        <div><span>Modus</span><strong>∞</strong><small>Endlos</small></div>
      </section>

      <section class="arcade-section">
        <div class="arcade-section-title"><div><span>SPIELE</span><h2>Arcade</h2></div><small>Mehr folgen später</small></div>
        <div class="arcade-game-grid">${GAME_CATALOG.map(gameCard).join('')}</div>
      </section>

      <section class="arcade-section arcade-leaderboard-section">
        <div class="arcade-section-title"><div><span>CREW</span><h2>Leaderboard</h2></div><small>Persönliche Bestwerte</small></div>
        <div class="arcade-leaderboard">
          ${leaders.slice(0,6).map((entry,index) => `<div class="arcade-rank${entry.id===personalId?' is-me':''}">
            <span class="arcade-rank-number">${medal(index)}</span>
            <span class="arcade-rank-avatar" style="--player-color:${entry.color}">${escapeHtml(entry.name.slice(0,1).toUpperCase())}</span>
            <span class="arcade-rank-name"><b>${escapeHtml(entry.name)}</b>${entry.id===personalId?'<small>Du</small>':''}</span>
            <strong class="arcade-rank-score">${entry.best || '—'}</strong>
          </div>`).join('')}
        </div>
      </section>
    </div>`;

    page.querySelectorAll('[data-game-id]').forEach(button => {
      button.addEventListener('click', () => {
        const game = GAME_CATALOG.find(g => g.id === button.dataset.gameId);
        game?.action();
      });
    });
  }

  function install(){
    const page = document.getElementById('page-games');
    if(!page) return;

    const observer = new MutationObserver(() => {
      if(document.body?.dataset?.activeTab === 'games' && !page.querySelector('.arcade-dashboard')){
        queueMicrotask(render);
      }
    });
    observer.observe(page,{childList:true});

    document.addEventListener('click', event => {
      const tab = event.target.closest?.("button.tab[onclick*='games'], .rt-main-card[onclick*='games']");
      if(tab) setTimeout(render,0);
    });

    window.RoadtripGameAssets?.preload?.();
    if(document.body?.dataset?.activeTab === 'games') render();
    window.renderArcadeDashboard = render;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
