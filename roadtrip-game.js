(() => {
  'use strict';

  if (window.openRoadtripGame) return;

  const SCRIPT_SRC = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const BASE = new URL('.', SCRIPT_SRC);
  const TARGET_SCORE = 15;

  function ensureStyles() {
    if (document.querySelector('link[data-roadtrip-game-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('roadtrip-game.css', BASE).href;
    link.dataset.roadtripGameStyle = '1';
    document.head.appendChild(link);
  }

  function createOverlay() {
    const root = document.createElement('div');
    root.className = 'rt-game';
    root.hidden = true;
    root.innerHTML = `
      <canvas class="rt-game__canvas" aria-label="Roadtrip psychedelic arcade game"></canvas>
      <div class="rt-game__score">0</div>
      <button class="rt-game__close" type="button" aria-label="Game schließen">×</button>
      <div class="rt-game__start">
        <div class="rt-game__eyebrow">ROADTRIP ARCADE</div>
        <div class="rt-game__title">TAP TO START</div>
        <div class="rt-game__hint">Tap anywhere to fly · reach ${TARGET_SCORE}</div>
      </div>
      <div class="rt-game__panel rt-game__lost" hidden>
        <div class="rt-game__panel-title rt-game__panel-title--lost">ROUTE LOST</div>
        <div class="rt-game__panel-score">Score <b>0</b></div>
        <button class="rt-game__retry" type="button">↻ &nbsp; TRY AGAIN</button>
        <button class="rt-game__exit" type="button">⌂ &nbsp; BACK</button>
      </div>
      <div class="rt-game__panel rt-game__victory" hidden>
        <div class="rt-game__victory-score">${TARGET_SCORE} / ${TARGET_SCORE}</div>
        <div class="rt-game__panel-title rt-game__panel-title--win">ROUTE VERIFIED</div>
        <div class="rt-game__mandala">◉</div>
        <button class="rt-game__retry rt-game__retry--win" type="button">PLAY AGAIN</button>
        <button class="rt-game__exit rt-game__exit--win" type="button">BACK</button>
      </div>`;
    document.body.appendChild(root);
    return root;
  }

  ensureStyles();
  const root = createOverlay();
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreEl = root.querySelector('.rt-game__score');
  const startEl = root.querySelector('.rt-game__start');
  const lostEl = root.querySelector('.rt-game__lost');
  const lostScoreEl = lostEl.querySelector('b');
  const victoryEl = root.querySelector('.rt-game__victory');

  const images = {};
  const imageDefs = ['landscape', 'bird', 'pipe'];
  let readyPromise = null;

  function loadAssets() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise(resolveAssets => {
      const startImages = () => {
        const source = window.__ROADTRIP_GAME_ASSETS__ || {};
        Promise.all(imageDefs.map(key => new Promise(resolve => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => { images[key] = img; resolve(); };
          img.onerror = () => resolve();
          img.src = source[key] || '';
        }))).then(resolveAssets);
      };
      if (window.__ROADTRIP_GAME_ASSETS__) { startImages(); return; }
      const script = document.createElement('script');
      script.src = new URL('roadtrip-game-assets.js', BASE).href;
      script.onload = startImages;
      script.onerror = resolveAssets;
      document.head.appendChild(script);
    });
    return readyPromise;
  }

  let raf = 0;
  let last = 0;
  let W = 390;
  let H = 844;
  let dpr = 1;
  let state = 'idle';
  let score = 0;
  let pipes = [];
  let spawnTimer = 1.1;
  let worldTime = 0;
  let flash = 0;
  let shake = 0;
  let backgroundOffset = 0;
  const bird = { x: 96, y: 350, vy: 0, rot: 0, radius: 21 };

  function resize() {
    const rect = root.getBoundingClientRect();
    W = Math.max(320, rect.width || innerWidth);
    H = Math.max(520, rect.height || innerHeight);
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bird.x = Math.max(82, W * 0.24);
  }

  function reset() {
    score = 0;
    pipes = [];
    spawnTimer = 0.9;
    worldTime = 0;
    flash = 0;
    shake = 0;
    backgroundOffset = 0;
    bird.y = H * 0.43;
    bird.vy = 0;
    bird.rot = 0;
    state = 'idle';
    scoreEl.textContent = '0';
    scoreEl.hidden = false;
    startEl.hidden = false;
    lostEl.hidden = true;
    victoryEl.hidden = true;
    last = performance.now();
  }

  function flap() {
    if (state === 'idle') {
      state = 'playing';
      startEl.hidden = true;
    }
    if (state !== 'playing') return;
    bird.vy = -Math.max(340, H * 0.43);
    bird.rot = -0.45;
  }

  function spawnPipe() {
    const difficulty = Math.min(1, score / TARGET_SCORE);
    const gap = Math.max(H * 0.225, H * (0.31 - difficulty * 0.07));
    const margin = Math.max(105, H * 0.12);
    const minCenter = margin + gap / 2;
    const maxCenter = H - margin - gap / 2;
    const previous = pipes.length ? pipes[pipes.length - 1].gapY : H * 0.5;
    const maxDelta = H * 0.21;
    let center = minCenter + Math.random() * Math.max(1, maxCenter - minCenter);
    center = Math.max(minCenter, Math.min(maxCenter, previous + Math.max(-maxDelta, Math.min(maxDelta, center - previous))));
    pipes.push({ x: W + 30, w: Math.max(72, W * 0.19), gapY: center, gap, scored: false });
  }

  function collides(p) {
    const r = bird.radius * 0.72;
    if (bird.x + r < p.x || bird.x - r > p.x + p.w) return false;
    return bird.y - r < p.gapY - p.gap / 2 || bird.y + r > p.gapY + p.gap / 2;
  }

  function fail() {
    if (state !== 'playing') return;
    state = 'dead';
    shake = 12;
    lostScoreEl.textContent = score;
    setTimeout(() => { if (state === 'dead') lostEl.hidden = false; }, 180);
  }

  function win() {
    state = 'victory';
    scoreEl.hidden = true;
    flash = 1;
    victoryEl.hidden = false;
  }

  function update(dt) {
    worldTime += dt;
    backgroundOffset += dt * (state === 'playing' ? 8 : 2.5);
    if (state === 'idle') {
      bird.y = H * 0.43 + Math.sin(worldTime * 3.2) * 8;
      return;
    }
    if (state !== 'playing') return;

    const speed = W * (0.34 + Math.min(0.11, score * 0.006));
    bird.vy += Math.max(930, H * 1.12) * dt;
    bird.y += bird.vy * dt;
    bird.rot = Math.min(1.12, bird.rot + dt * 2.5);

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPipe();
      spawnTimer = Math.max(1.08, 1.48 - score * 0.012);
    }

    for (const p of pipes) {
      p.x -= speed * dt;
      if (!p.scored && p.x + p.w < bird.x) {
        p.scored = true;
        score += 1;
        scoreEl.textContent = String(score);
        flash = 0.25;
        if (score >= TARGET_SCORE) {
          win();
          break;
        }
      }
      if (collides(p)) {
        fail();
        break;
      }
    }
    pipes = pipes.filter(p => p.x + p.w > -50);
    if (bird.y - bird.radius < 0 || bird.y + bird.radius > H) fail();
    flash = Math.max(0, flash - dt * 2.2);
    shake *= Math.pow(0.03, dt);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, '#24105a');
    g.addColorStop(0.28, '#7d1f82');
    g.addColorStop(0.58, '#ef4f83');
    g.addColorStop(1, '#ff9c48');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const ex = W * 0.52;
    const ey = H * 0.24;
    const er = Math.min(W, H) * 0.105;
    const halo = ctx.createRadialGradient(ex, ey, er * 0.86, ex, ey, er * 1.85);
    halo.addColorStop(0, 'rgba(255,105,45,.95)');
    halo.addColorStop(0.32, 'rgba(255,221,92,.52)');
    halo.addColorStop(1, 'rgba(255,81,47,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ex, ey, er * 1.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241043';
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffba4c';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 36; i++) {
      const x = (i * 83 + backgroundOffset * (i % 3 + 1)) % W;
      const y = (i * 139) % (H * 0.46);
      ctx.fillStyle = i % 4 === 0 ? '#80ffdb' : '#ffd5ff';
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  function drawLandscape() {
    if (!images.landscape) return;
    const img = images.landscape;
    const targetH = H * 0.67;
    const scale = Math.max(W / img.width, targetH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const y = H - dh;
    const drift = Math.sin(backgroundOffset * 0.012) * 10;
    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.drawImage(img, (W - dw) / 2 + drift, y, dw, dh);
    const blend = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.62);
    blend.addColorStop(0, 'rgba(255,108,89,0)');
    blend.addColorStop(1, 'rgba(9,20,38,.08)');
    ctx.fillStyle = blend;
    ctx.fillRect(0, H * 0.35, W, H * 0.65);
    ctx.restore();
  }

  function drawPipeSegment(p, top) {
    const topH = p.gapY - p.gap / 2;
    const bottomY = p.gapY + p.gap / 2;
    const y = top ? 0 : bottomY;
    const h = top ? topH : H - bottomY;
    if (h <= 2) return;

    if (!images.pipe) {
      ctx.fillStyle = '#b75579';
      ctx.fillRect(p.x, y, p.w, h);
      return;
    }

    const sprite = images.pipe;
    const cap = Math.min(28, p.w * 0.26);
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x - 4, y, p.w + 8, h);
    ctx.clip();

    const tileH = p.w * (sprite.height / sprite.width);
    for (let yy = top ? h - tileH : 0; top ? yy > -tileH : yy < h; yy += top ? -tileH : tileH) {
      ctx.save();
      if (top) {
        ctx.translate(p.x + p.w, y + yy + tileH);
        ctx.rotate(Math.PI);
        ctx.drawImage(sprite, 0, 0, p.w, tileH);
      } else {
        ctx.drawImage(sprite, p.x, y + yy, p.w, tileH);
      }
      ctx.restore();
    }
    ctx.restore();

    const capY = top ? topH - cap : bottomY;
    const cg = ctx.createLinearGradient(p.x - 7, capY, p.x + p.w + 7, capY + cap);
    cg.addColorStop(0, '#f5a827');
    cg.addColorStop(0.35, '#e5576f');
    cg.addColorStop(0.7, '#1ab998');
    cg.addColorStop(1, '#f1af2c');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#1d1731';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(p.x - 7, capY, p.w + 14, cap, 7);
    ctx.fill();
    ctx.stroke();
  }

  function drawBird() {
    const img = images.bird;
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    const bob = state === 'idle' ? Math.sin(worldTime * 6) * 0.04 : 0;
    ctx.rotate(bob);
    if (img) {
      const w = Math.max(68, W * 0.18);
      const h = w * (img.height / img.width);
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 12;
      ctx.drawImage(img, -w * 0.48, -h * 0.5, w, h);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#d653a5';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawSky();
    drawLandscape();
    for (const p of pipes) {
      drawPipeSegment(p, true);
      drawPipeSegment(p, false);
    }
    drawBird();
    if (state === 'idle') {
      ctx.fillStyle = 'rgba(18,7,43,.08)';
      ctx.fillRect(0, 0, W, H);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(134,255,183,${flash * 0.32})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000 || 0));
    last = now;
    update(dt);
    draw();
    if (!root.hidden) raf = requestAnimationFrame(loop);
  }

  async function open() {
    await loadAssets();
    root.hidden = false;
    document.documentElement.classList.add('rt-game-open');
    resize();
    reset();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    root.hidden = true;
    document.documentElement.classList.remove('rt-game-open');
    cancelAnimationFrame(raf);
  }

  root.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    event.preventDefault();
    flap();
  }, { passive: false });
  root.querySelector('.rt-game__close').addEventListener('click', close);
  root.querySelectorAll('.rt-game__exit').forEach(btn => btn.addEventListener('click', close));
  root.querySelectorAll('.rt-game__retry').forEach(btn => btn.addEventListener('click', reset));
  window.addEventListener('resize', () => { if (!root.hidden) resize(); });

  window.openRoadtripGame = open;
  window.closeRoadtripGame = close;
})();
