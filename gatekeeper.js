(() => {
  'use strict';

  const ACCESS_PASSWORD = 'sizigia26';
  const LEGACY_UNLOCK_KEY = 'sizigia-roadtrip-2026-gate-unlocked';
  const TARGET_SCORE = 15;

  function clearLegacyUnlock() {
    try { localStorage.removeItem(LEGACY_UNLOCK_KEY); } catch (_) {}
  }

  function setAppLocked(locked) {
    const app = document.querySelector('.wrap');
    if (!app) return;
    if (locked) {
      app.setAttribute('inert', '');
      app.setAttribute('aria-hidden', 'true');
    } else {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
    }
  }

  function buildGate() {
    const gate = document.createElement('div');
    gate.className = 'roadtrip-gate';
    gate.id = 'roadtripGate';
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.innerHTML = `
      <main class="roadtrip-gate-shell">
        <div class="roadtrip-gate-status"><span class="roadtrip-gate-status-dot"></span>PRIVATE ENDPOINT</div>
        <div class="roadtrip-gate-eclipse" aria-hidden="true"></div>
        <div class="roadtrip-gate-code">403</div>
        <h1 class="roadtrip-gate-title">Hier geht's nicht weiter.</h1>
        <p class="roadtrip-gate-subtitle">This route could not be verified.<br>Access to the roadtrip database is restricted.</p>

        <section class="roadtrip-recovery-card">
          <div class="roadtrip-recovery-kicker">ROUTE INTEGRITY CHECK</div>
          <p>To recover access, complete the integrity check procedure.<br>Stay on track. Stay in flow.</p>
          <button class="roadtrip-recovery-start" id="roadtripRecoveryStart" type="button"><span>▷</span> RUN RECOVERY</button>
          <div class="roadtrip-recovery-note">Authorized travelers only.</div>
        </section>

        <details class="roadtrip-gate-feedback">
          <summary>ⓘ &nbsp; Problem melden</summary>
          <form class="roadtrip-gate-form" id="roadtripGateForm" autocomplete="off">
            <label class="roadtrip-gate-label" for="roadtripGatePassword">Technische Rückmeldung</label>
            <div class="roadtrip-gate-access-row">
              <input class="roadtrip-gate-input" id="roadtripGatePassword" name="report" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Fehlerbeschreibung oder Referenz" required>
              <button class="roadtrip-gate-button" type="submit">Absenden</button>
            </div>
            <div class="roadtrip-gate-error" id="roadtripGateError" role="status" aria-live="polite"></div>
          </form>
        </details>
      </main>

      <div class="psy-game" id="psyGame" hidden>
        <canvas id="psyGameCanvas"></canvas>
        <div class="psy-game-hud" id="psyGameScore">0</div>
        <div class="psy-game-start" id="psyGameStart">TAP TO START</div>
        <button class="psy-game-close" id="psyGameClose" type="button" aria-label="Zurück">×</button>

        <div class="psy-game-panel psy-game-over" id="psyGameOver" hidden>
          <div class="psy-game-panel-title danger">ROUTE LOST</div>
          <div class="psy-game-panel-score">Score: <b id="psyGameFinalScore">0</b></div>
          <button type="button" id="psyGameRetry">↻ &nbsp; TRY AGAIN</button>
          <button type="button" class="secondary" id="psyGameBack">⌂ &nbsp; BACK TO GATE</button>
        </div>

        <div class="psy-game-panel psy-game-victory" id="psyGameVictory" hidden>
          <div class="psy-game-panel-title success"><span>${TARGET_SCORE} / ${TARGET_SCORE}</span><br>ROUTE VERIFIED</div>
          <div class="psy-victory-mandala" aria-hidden="true">◉</div>
        </div>

        <div class="psy-access" id="psyAccess" hidden>
          <div class="psy-access-sigil">△<span>◉</span></div>
          <div class="psy-access-title">ACCESS GRANTED</div>
          <div class="psy-access-copy">AUTHORIZATION TOKEN ACCEPTED<br>WELCOME, TRAVELER.</div>
          <div class="psy-access-copy small">Redirecting to roadtrip system...</div>
          <div class="psy-access-bar"><i></i></div>
        </div>
      </div>
    `;
    return gate;
  }

  function unlock(gate) {
    setAppLocked(false);
    gate.hidden = true;
    document.documentElement.classList.remove('psy-game-open');
  }

  function createGame(gate) {
    const overlay = gate.querySelector('#psyGame');
    const canvas = gate.querySelector('#psyGameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = gate.querySelector('#psyGameScore');
    const startEl = gate.querySelector('#psyGameStart');
    const overEl = gate.querySelector('#psyGameOver');
    const finalScoreEl = gate.querySelector('#psyGameFinalScore');
    const victoryEl = gate.querySelector('#psyGameVictory');
    const accessEl = gate.querySelector('#psyAccess');
    let raf = 0;
    let last = 0;
    let state = 'idle';
    let score = 0;
    let pipes = [];
    let spawnTimer = 0;
    let worldTime = 0;
    let shake = 0;
    let flash = 0;
    let W = 390, H = 844, dpr = 1;
    const bird = { x: 94, y: 350, vy: 0, r: 22, rot: 0 };

    function resize() {
      const rect = overlay.getBoundingClientRect();
      W = Math.max(320, rect.width || innerWidth);
      H = Math.max(540, rect.height || innerHeight);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bird.x = Math.max(82, W * .24);
    }

    function reset() {
      score = 0;
      pipes = [];
      spawnTimer = .9;
      worldTime = 0;
      shake = 0;
      flash = 0;
      bird.y = H * .43;
      bird.vy = 0;
      bird.rot = 0;
      scoreEl.textContent = '0';
      scoreEl.hidden = false;
      startEl.hidden = false;
      overEl.hidden = true;
      victoryEl.hidden = true;
      accessEl.hidden = true;
      state = 'idle';
      last = performance.now();
    }

    function open() {
      overlay.hidden = false;
      document.documentElement.classList.add('psy-game-open');
      resize();
      reset();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
    }

    function close() {
      overlay.hidden = true;
      document.documentElement.classList.remove('psy-game-open');
      cancelAnimationFrame(raf);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }

    function flap() {
      if (state === 'idle') {
        state = 'playing';
        startEl.hidden = true;
      }
      if (state !== 'playing') return;
      bird.vy = -Math.max(330, H * .43);
      bird.rot = -.45;
    }

    function spawnPipe() {
      const difficulty = Math.min(1, score / TARGET_SCORE);
      const gap = Math.max(H * .235, H * (.31 - difficulty * .065));
      const margin = Math.max(105, H * .13);
      const minCenter = margin + gap / 2;
      const maxCenter = H - margin - gap / 2;
      const previous = pipes.length ? pipes[pipes.length - 1].gapY : H * .5;
      const maxDelta = H * .22;
      let center = minCenter + Math.random() * Math.max(1, maxCenter - minCenter);
      center = Math.max(minCenter, Math.min(maxCenter, previous + Math.max(-maxDelta, Math.min(maxDelta, center - previous))));
      pipes.push({ x: W + 42, w: Math.max(68, W * .18), gapY: center, gap, scored: false, phase: Math.random() * 10 });
    }

    function fail() {
      if (state !== 'playing') return;
      state = 'dead';
      shake = 12;
      finalScoreEl.textContent = score;
      setTimeout(() => { overEl.hidden = false; }, 220);
    }

    function win() {
      state = 'victory';
      scoreEl.hidden = true;
      victoryEl.hidden = false;
      flash = 1;
      setTimeout(() => {
        victoryEl.hidden = true;
        accessEl.hidden = false;
      }, 1500);
      setTimeout(() => unlock(gate), 3300);
    }

    function hitPipe(p) {
      const bx = bird.x, by = bird.y, br = bird.r * .72;
      if (bx + br < p.x || bx - br > p.x + p.w) return false;
      return by - br < p.gapY - p.gap / 2 || by + br > p.gapY + p.gap / 2;
    }

    function update(dt) {
      worldTime += dt;
      if (state !== 'playing') return;
      const speed = W * (.34 + Math.min(.1, score * .006));
      bird.vy += Math.max(930, H * 1.12) * dt;
      bird.y += bird.vy * dt;
      bird.rot = Math.min(1.15, bird.rot + dt * 2.4);
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnPipe();
        spawnTimer = Math.max(1.15, 1.5 - score * .012);
      }
      pipes.forEach(p => {
        p.x -= speed * dt;
        if (!p.scored && p.x + p.w < bird.x) {
          p.scored = true;
          score += 1;
          scoreEl.textContent = score;
          flash = .32;
          if (score >= TARGET_SCORE) win();
        }
        if (hitPipe(p)) fail();
      });
      pipes = pipes.filter(p => p.x + p.w > -40);
      if (bird.y - bird.r < 0 || bird.y + bird.r > H) fail();
      shake *= Math.pow(.03, dt);
      flash = Math.max(0, flash - dt * 2.2);
    }

    function roundRect(x,y,w,h,r,fill,stroke) {
      ctx.beginPath(); ctx.roundRect(x,y,w,h,r);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    }

    function drawBackground() {
      const g = ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#2a0a61'); g.addColorStop(.2,'#72136f'); g.addColorStop(.44,'#ef476f'); g.addColorStop(.66,'#ff9f43'); g.addColorStop(1,'#10253a');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

      ctx.globalAlpha = .75;
      for (let i=0;i<42;i++) {
        const x=(i*83 + worldTime*8*(i%3+1))%W, y=(i*137)%Math.max(150,H*.45);
        ctx.fillStyle = i%4===0?'#80ffdb':'#ffd6ff'; ctx.fillRect(x,y,1.5,1.5);
      }
      ctx.globalAlpha = 1;

      const ex=W*.52, ey=H*.26, er=Math.min(W,H)*.115;
      const halo=ctx.createRadialGradient(ex,ey,er*.85,ex,ey,er*1.8);
      halo.addColorStop(0,'rgba(255,90,35,.95)'); halo.addColorStop(.28,'rgba(255,209,79,.58)'); halo.addColorStop(1,'rgba(255,90,35,0)');
      ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(ex,ey,er*1.8,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#241044'; ctx.beginPath(); ctx.arc(ex,ey,er,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ffb84c'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(ex,ey,er+2,0,Math.PI*2); ctx.stroke();

      const horizon=H*.66;
      const layers=[['#5b2c83',.34,52],['#29356d',.45,70],['#163b4f',.62,92]];
      layers.forEach((l,li)=>{
        ctx.fillStyle=l[0]; ctx.beginPath(); ctx.moveTo(0,H);
        for(let x=0;x<=W+20;x+=20){
          const y=horizon + li*28 - Math.sin((x+worldTime*l[1]*25)/l[2])*38 - Math.sin(x/37+li)*18;
          ctx.lineTo(x,y);
        }
        ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
      });

      const river=ctx.createLinearGradient(0,horizon,0,H);
      river.addColorStop(0,'rgba(63,230,223,.88)'); river.addColorStop(1,'rgba(16,79,104,.14)');
      ctx.fillStyle=river; ctx.beginPath(); ctx.moveTo(W*.42,horizon); ctx.lineTo(W*.59,horizon); ctx.lineTo(W*.8,H); ctx.lineTo(W*.12,H); ctx.closePath(); ctx.fill();

      for(let i=0;i<11;i++){
        const x=(i*97-worldTime*20)% (W+120)-40, y=H-(i%3)*22-22, r=7+(i%4)*3;
        ctx.fillStyle=i%2?'#ff4fd8':'#ff8a3d'; ctx.beginPath(); ctx.arc(x,y,r,Math.PI,0); ctx.fill();
        ctx.fillStyle='#e9d7b8'; ctx.fillRect(x-2,y,4,10);
      }
    }

    function drawPatternPipe(p, top) {
      const capH=28, topH=p.gapY-p.gap/2, bottomY=p.gapY+p.gap/2;
      const y=top?0:bottomY, h=top?topH:H-bottomY;
      if(h<=0)return;
      const pg=ctx.createLinearGradient(p.x,y,p.x+p.w,y+h);
      pg.addColorStop(0,'#ffb21d'); pg.addColorStop(.25,'#de3c96'); pg.addColorStop(.5,'#5e3ba7'); pg.addColorStop(.76,'#10bfa3'); pg.addColorStop(1,'#f2b72b');
      roundRect(p.x,y,p.w,h,8,pg,'#1b1830');
      ctx.save(); ctx.beginPath(); ctx.rect(p.x,y,p.w,h); ctx.clip();
      ctx.lineWidth=2;
      for(let yy=y+10; yy<y+h; yy+=24){
        ctx.strokeStyle=((Math.floor((yy+p.phase*20)/24)%2)?'#f8e34d':'#40e0d0');
        ctx.beginPath();
        for(let xx=p.x; xx<=p.x+p.w; xx+=9) ctx.lineTo(xx,yy+Math.sin((xx+p.phase*30)/12)*8);
        ctx.stroke();
      }
      for(let yy=y+15; yy<y+h; yy+=46){
        ctx.fillStyle='rgba(31,22,69,.52)';
        ctx.beginPath(); ctx.arc(p.x+p.w/2,yy,Math.min(11,p.w*.15),0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ffdd54'; ctx.beginPath(); ctx.arc(p.x+p.w/2,yy,3,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      const cy=top?topH-capH:bottomY;
      roundRect(p.x-6,cy,p.w+12,capH,8,'#d78d2b','#17162a');
      ctx.strokeStyle='#ffed59'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x,cy+8);ctx.lineTo(p.x+p.w,cy+20);ctx.stroke();
    }

    function drawBird() {
      ctx.save(); ctx.translate(bird.x,bird.y); ctx.rotate(bird.rot);
      const s=Math.max(.9,Math.min(1.25,W/390));
      ctx.scale(s,s);
      ctx.shadowColor='#ff4fd8'; ctx.shadowBlur=14;
      for(let i=0;i<9;i++){
        ctx.fillStyle=i%3===0?'#ff4f8b':i%3===1?'#6d38a4':'#22b7a7';
        ctx.beginPath(); ctx.ellipse(-24-i*2,(i-4)*4,17,5,-.2,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;
      ctx.fillStyle='#4a235e';ctx.beginPath();ctx.ellipse(0,0,28,24,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffb13c';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#8b3fb1';ctx.beginPath();ctx.ellipse(-8,8,18,12,.4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffb13c';ctx.beginPath();ctx.moveTo(22,-2);ctx.lineTo(42,5);ctx.lineTo(22,12);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#231638';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#2dd4bf';ctx.beginPath();ctx.arc(8,-7,13,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffdf6e';ctx.lineWidth=4;ctx.stroke();
      ctx.fillStyle='#161323';ctx.beginPath();ctx.arc(9,-7,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(11,-10,2.3,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ff3ea5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(7,-7,18,-2.2,2.2);ctx.stroke();
      ctx.fillStyle='#ffcf42';ctx.beginPath();ctx.arc(-12,-13,3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#3ce4c5';ctx.beginPath();ctx.arc(-18,-4,2.5,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.save();
      if(shake>0) ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
      drawBackground();
      pipes.forEach(p=>{drawPatternPipe(p,true);drawPatternPipe(p,false);});
      drawBird();
      if(state==='idle'){
        ctx.fillStyle='rgba(20,5,42,.18)';ctx.fillRect(0,0,W,H);
      }
      if(flash>0){ctx.fillStyle=`rgba(143,255,180,${flash*.32})`;ctx.fillRect(0,0,W,H);}
      ctx.restore();
    }

    function loop(now) {
      const dt=Math.min(.033,Math.max(0,(now-last)/1000||0));last=now;
      update(dt);draw();
      if(!overlay.hidden) raf=requestAnimationFrame(loop);
    }

    overlay.addEventListener('pointerdown', e=>{
      if(e.target.closest('button')) return;
      e.preventDefault(); flap();
    }, {passive:false});
    window.addEventListener('resize', resize);
    gate.querySelector('#roadtripRecoveryStart').addEventListener('click', open);
    gate.querySelector('#psyGameClose').addEventListener('click', close);
    gate.querySelector('#psyGameBack').addEventListener('click', close);
    gate.querySelector('#psyGameRetry').addEventListener('click', reset);
    return { open, close };
  }

  function init() {
    clearLegacyUnlock();
    setAppLocked(true);
    const gate = buildGate();
    document.body.appendChild(gate);
    createGame(gate);

    const form = gate.querySelector('#roadtripGateForm');
    const input = gate.querySelector('#roadtripGatePassword');
    const error = gate.querySelector('#roadtripGateError');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.value === ACCESS_PASSWORD) {
        error.textContent = '';
        unlock(gate);
        return;
      }
      input.value = '';
      error.textContent = 'Der Bericht konnte derzeit nicht übermittelt werden.';
      input.focus();
    });
  }

  window.lockRoadtripApp = function lockRoadtripApp() {
    clearLegacyUnlock();
    window.location.reload();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
