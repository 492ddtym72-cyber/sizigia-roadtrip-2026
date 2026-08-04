(() => {
  'use strict';

  const rasterParts = [0, 1, 2, 3, 4].map(index =>
    `./game-assets/production/raster/background.${String(index).padStart(3, '0')}.txt`
  );
  let backgroundPromise;

  async function generatedBackground(){
    if(!backgroundPromise){
      backgroundPromise = Promise.all(rasterParts.map(async path => {
        const response = await fetch(path);
        if(!response.ok) throw new Error(`Missing raster asset: ${path}`);
        return (await response.text()).trim();
      })).then(parts => `data:image/png;base64,${parts.join('')}`);
    }
    return backgroundPromise;
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

    try {
      const background = await generatedBackground();
      window.openRoadtripGame({
        player: { id: person.id, name: person.name },
        crew: crew.map(c => ({ id: c.id, name: c.name })),
        backgrounds: [background],
        birdSprite: './game-assets/production/sprites/psy-bird.png',
        pipeSprite: './game-assets/production/sprites/psy-pillar.png'
      });
    } catch(error){
      console.error('Generated game artwork failed to load', error);
      if(typeof toast === 'function') toast('Game-Art konnte nicht geladen werden');
    }
  };
})();