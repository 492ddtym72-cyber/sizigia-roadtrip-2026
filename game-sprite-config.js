(() => {
  'use strict';

  window.playRoadtripGame = function playRoadtripGameWithArtwork(){
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

    window.openRoadtripGame({
      player: { id: person.id, name: person.name },
      crew: crew.map(c => ({ id: c.id, name: c.name })),
      backgrounds: ['./assets/game-eclipse-background.webp'],
      birdSprite: './game-assets/production/sprites/psy-bird.svg',
      pipeSprite: './game-assets/production/sprites/psy-pillar.svg'
    });
  };
})();