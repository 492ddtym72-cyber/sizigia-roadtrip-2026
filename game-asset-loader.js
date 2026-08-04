(() => {
  'use strict';

  const assets = Object.freeze({
    background: './game-assets/production/hires/game-background.webp',
    bird: './game-assets/production/hires/psy-bird.webp',
    pillar: './game-assets/production/hires/psy-pillar.webp'
  });

  let loadPromise = null;

  function verify(url){
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(url);
      image.onerror = () => reject(new Error(`Game artwork failed to load: ${url}`));
      image.src = url;
    });
  }

  function load(){
    if(!loadPromise){
      loadPromise = Promise.all(Object.values(assets).map(verify))
        .then(() => ({ ...assets }));
    }
    return loadPromise;
  }

  window.RoadtripGameAssets = {
    ...assets,
    load,
    preload(){ return load().catch(error => { console.warn(error); return null; }); }
  };
})();
