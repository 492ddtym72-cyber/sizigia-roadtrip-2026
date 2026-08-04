(() => {
  'use strict';

  const FALLBACK = {
    background: './assets/game-eclipse-background.webp',
    bird: './game-assets/production/sprites/psy-bird.svg',
    pillar: './game-assets/production/sprites/psy-pillar.svg'
  };

  async function artwork(){
    try {
      if(window.RoadtripGameAssets?.load){
        const loaded = await window.RoadtripGameAssets.load();
        if(loaded?.background && loaded?.bird && loaded?.pillar) return loaded;
      }
    } catch(error){
      console.warn('High-resolution game artwork failed to preload; using fallback.', error);
    }
    return FALLBACK;
  }

  window.playRoadtripGame = async function playRoadtripGameWithArtwork(){
    const id = typeof whoami === 'function' ? whoami() : '';
    const crew = typeof state !== 'undefined' && Array.isArray(state.crew) ? state.crew : [];
    const person = crew.find(c => c.id === id);

    if(!person){
      if(typeof toast === 'function') toast('Bitte zuerst dein Profil auswählen');
      if(typeof askWho === 'function') askWho();
      return;
    }
    if(typeof window.openRoadtripGame !== 'function'){
      if(typeof toast === 'function') toast('Game-Modul konnte nicht geladen werden');
      return;
    }

    const art = await artwork();
    window.openRoadtripGame({
      player: { id: person.id, name: person.name },
      crew: crew.map(c => ({ id: c.id, name: c.name })),
      backgrounds: [art.background],
      birdSprite: art.bird,
      pipeSprite: art.pillar
    });
  };

  window.RoadtripGameAssets?.preload?.();
})();
