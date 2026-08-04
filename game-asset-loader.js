(() => {
  'use strict';

  const ROOT = './game-assets/production/hires';
  const SPECS = {
    background: { prefix: 'background', chunks: 6, mime: 'image/webp' },
    bird: { prefix: 'bird', chunks: 3, mime: 'image/webp' },
    pillar: { prefix: 'pillar', chunks: 4, mime: 'image/webp' }
  };

  let bundlePromise = null;
  const objectUrls = [];

  function chunkPath(spec, index){
    return `${ROOT}/${spec.prefix}.${String(index).padStart(3, '0')}.b64`;
  }

  function base64ToBlobUrl(base64, mime){
    const binary = atob(base64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    objectUrls.push(url);
    return url;
  }

  function verifyImage(url){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('Decoded game artwork is invalid'));
      img.src = url;
    });
  }

  async function loadOne(spec){
    const parts = await Promise.all(Array.from({ length: spec.chunks }, async (_, index) => {
      const response = await fetch(chunkPath(spec, index));
      if(!response.ok) throw new Error(`Missing game artwork chunk ${spec.prefix}.${index}`);
      return (await response.text()).trim();
    }));
    return verifyImage(base64ToBlobUrl(parts.join(''), spec.mime));
  }

  async function load(){
    if(!bundlePromise){
      bundlePromise = Promise.all([
        loadOne(SPECS.background),
        loadOne(SPECS.bird),
        loadOne(SPECS.pillar)
      ]).then(([background, bird, pillar]) => ({ background, bird, pillar }));
    }
    return bundlePromise;
  }

  window.RoadtripGameAssets = {
    load,
    preload(){ return load().catch(() => null); }
  };
})();
