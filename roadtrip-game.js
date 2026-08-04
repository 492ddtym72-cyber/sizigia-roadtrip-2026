(() => {
  'use strict';

  const STORAGE_KEY = 'roadtrip-game-leaderboard-v2';
  const DEFAULT_BACKGROUNDS = ['./game-assets/production/backgrounds/game-background.svg'];

  const runtime = { root:null, api:null, adapter:null, player:null, crew:[], options:{} };

  function ensureStyles(){
    if(document.querySelector('link[data-roadtrip-game-style]')) return;
    const script=document.currentScript;
    const base=script&&script.src?new URL('.',script.src):new URL('.',location.href);
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=new URL('roadtrip-game.css',base).href;
    link.dataset.roadtripGameStyle='1';
    document.head.appendChild(link);
  }

  function escapeHtml(value){
    const div=document.createElement('div');
    div.textContent=String(value);
    return div.innerHTML;
  }

  function normalizePlayer(value,fallback='Roadtripper'){
    const p=value||{};
    const name=String(p.name||fallback);
    return {playerId:String(p.playerId||p.id||name),name};
  }

  function normalizeRows(rows){
    if(!Array.isArray(rows)) return [];
    const map=new Map();
    rows.forEach(raw=>{
      if(!raw) return;
      const player=normalizePlayer(raw,String(raw.name||'Roadtripper'));
      const best=Math.max(0,Math.floor(Number(raw.best??raw.score??0)||0));
      const old=map.get(player.playerId);
      if(!old||best>old.best) map.set(player.playerId,{...player,best});
    });
    return [...map.values()].sort((a,b)=>b.best-a.best||a.name.localeCompare(b.name));
  }

  function mergeCrew(rows,crew){
    const map=new Map(normalizeRows(rows).map(row=>[row.playerId,row]));
    (crew||[]).forEach(raw=>{
      const p=normalizePlayer(raw);
      if(!map.has(p.playerId)) map.set(p.playerId,{...p,best:0});
      else map.get(p.playerId).name=p.name;
    });
    return [...map.values()].sort((a,b)=>b.best-a.best||a.name.localeCompare(b.name));
  }

  function localAdapter(){
    function read(){
      try{
        const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
        return parsed&&typeof parsed==='object'?parsed:{};
      }catch(_){return {};}
    }
    function write(v){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(v));}catch(_){}}
    return {
      async load(){return Object.values(read());},
      async submit(entry){
        const map=read();
        const old=map[entry.playerId];
        if(!old||entry.score>Number(old.best||0)){
          map[entry.playerId]={playerId:entry.playerId,name:entry.name,best:entry.score,updatedAt:new Date().toISOString()};
          write(map);
        }
        return Object.values(map);
      }
    };
  }

  function image(src){
    if(!src) return null;
    const i=new Image();
    i.decoding='async';
    i.src=src;
    return i;
  }

  function buildRoot(){
    const root=document.createElement('div');
    root.className='rtg-root';
    root.hidden=true;
    root.innerHTML=`
      <canvas aria-label="Roadtrip Flappy Game"></canvas>
      <div class="rtg-vignette"></div>
      <div class="rtg-score">0</div>
      <button class="rtg-close" type="button" aria-label="Game schließen">×</button>
      <div class="rtg-start"><strong>TAP TO START</strong><span>FLY · FLOW · SURVIVE</span></div>
      <div class="rtg-milestone"></div>
      <div class="rtg-newbest-burst"><span>NEW PERSONAL BEST</span></div>
      <section class="rtg-panel" hidden>
        <div class="rtg-panel-kicker">ROADTRIP ARCADE</div>
        <h2>RUN OVER</h2>
        <div class="rtg-run-score">Score <b>0</b></div>
        <div class="rtg-leaderboard">
          <div class="rtg-leaderboard-title">Crew leaderboard <span>personal bests</span></div>
          <div class="rtg-board"><div class="rtg-loading">Loading scores…</div></div>
        </div>
        <div class="rtg-actions">
          <button type="button" data-retry>↻ TRY AGAIN</button>
          <button type="button" class="secondary" data-close>BACK TO APP</button>
        </div>
      </section>`;
    document.body.appendChild(root);
    return root;
  }

  function createGame(root){
    const canvas=root.querySelector('canvas');
    const ctx=canvas.getContext('2d',{alpha:false});
    const scoreEl=root.querySelector('.rtg-score');
    const startEl=root.querySelector('.rtg-start');
    const milestoneEl=root.querySelector('.rtg-milestone');
    const panel=root.querySelector('.rtg-panel');
    const panelTitle=panel.querySelector('h2');
    const runScore=panel.querySelector('.rtg-run-score b');
    const board=panel.querySelector('.rtg-board');
    const burst=root.querySelector('.rtg-newbest-burst');

    let W=390,H=844,dpr=1,raf=0,last=0,state='idle',score=0,time=0;
    let pipes=[],particles=[],shake=0,flash=0,spawnTimer=.85,rowsBefore=[];
    let backgrounds=DEFAULT_BACKGROUNDS.map(image).filter(Boolean);
    let birdSprite=null,pipeSprite=null;
    const bird={x:92,y:350,vy:0,rot:0,r:22,wing:0};

    const pipeTexture=document.createElement('canvas');
    pipeTexture.width=220;pipeTexture.height=700;
    const pt=pipeTexture.getContext('2d');

    function makePipeTexture(){
      const g=pt.createLinearGradient(0,0,220,700);
      g.addColorStop(0,'#f8a72c');g.addColorStop(.18,'#e84e8c');g.addColorStop(.43,'#733d9d');g.addColorStop(.68,'#167d80');g.addColorStop(1,'#ed8a2a');
      pt.fillStyle=g;pt.fillRect(0,0,220,700);
      pt.fillStyle='rgba(20,12,39,.38)';
      for(let y=18;y<700;y+=56) for(let x=12;x<220;x+=44){pt.save();pt.translate(x,y);pt.rotate(Math.PI/4);pt.fillRect(-13,-13,26,26);pt.restore();}
      pt.lineWidth=5;
      for(let y=12;y<700;y+=34){pt.strokeStyle=(Math.floor(y/34)%2)?'#ffd84a':'#3fe3c3';pt.beginPath();for(let x=0;x<=220;x+=11)pt.lineTo(x,y+Math.sin((x+y)/17)*9);pt.stroke();}
      pt.strokeStyle='rgba(23,13,36,.72)';pt.lineWidth=12;pt.strokeRect(4,4,212,692);
    }
    makePipeTexture();

    function resize(){
      const r=root.getBoundingClientRect();
      W=Math.max(320,r.width||innerWidth);H=Math.max(540,r.height||innerHeight);dpr=Math.min(2,devicePixelRatio||1);
      canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
      bird.x=Math.max(82,W*.235);
    }

    function reset(){
      score=0;time=0;pipes=[];particles=[];shake=0;flash=0;spawnTimer=.85;
      bird.y=H*.43;bird.vy=0;bird.rot=0;bird.wing=0;
      state='idle';scoreEl.textContent='0';scoreEl.hidden=false;startEl.hidden=false;panel.hidden=true;root.classList.remove('rtg-paused');last=performance.now();
    }

    function leaderboardRows(rows){return mergeCrew(rows,runtime.crew);}

    async function renderLeaderboard(rows){
      const normalized=leaderboardRows(rows);
      board.innerHTML=normalized.length?normalized.slice(0,12).map((r,i)=>`<div class="rtg-board-row${r.playerId===runtime.player.playerId?' me':''}"><span class="rtg-rank">${i+1}</span><span class="rtg-board-name">${escapeHtml(r.name)}</span><span class="rtg-board-score">${r.best}</span></div>`).join(''):'<div class="rtg-empty">No scores yet.</div>';
    }

    async function loadRows(){
      try{rowsBefore=leaderboardRows(await runtime.adapter.load());}catch(_){rowsBefore=leaderboardRows([]);}
      return rowsBefore;
    }

    async function finish(){
      if(state!=='playing') return;
      state='dead';shake=13;root.classList.add('rtg-paused');
      const id=runtime.player.playerId;
      const oldBest=rowsBefore.find(r=>r.playerId===id)?.best||0;
      let rows=rowsBefore;
      try{rows=leaderboardRows(await runtime.adapter.submit({playerId:id,name:runtime.player.name,score}));}catch(_){}
      const nowBest=rows.find(r=>r.playerId===id)?.best||Math.max(oldBest,score);
      const newBest=score>oldBest&&score===nowBest;
      runScore.textContent=String(score);panelTitle.textContent=newBest?'PERSONAL BEST':'RUN OVER';panelTitle.classList.toggle('best',newBest);
      if(newBest){burst.classList.remove('show');void burst.offsetWidth;burst.classList.add('show');}
      await renderLeaderboard(rows);
      setTimeout(()=>{panel.hidden=false;},180);
      root.dispatchEvent(new CustomEvent('roadtripgamescore',{detail:{player:runtime.player,score,best:nowBest,newBest,leaderboard:rows}}));
    }

    function flap(){
      if(state==='idle'){state='playing';startEl.hidden=true;}
      if(state!=='playing') return;
      bird.vy=-Math.max(335,H*.43);bird.rot=-.46;bird.wing=1;
      for(let i=0;i<5;i++)particles.push({x:bird.x-24,y:bird.y+(Math.random()-.5)*12,vx:-55-Math.random()*65,vy:(Math.random()-.5)*70,life:.45,size:2+Math.random()*3,h:Math.random()>.5?165:320});
    }

    function difficulty(){const t=1-Math.exp(-score/34);return{speed:W*(.335+.13*t),gap:H*(.305-.072*t),interval:1.48-.25*t};}

    function spawnPipe(){
      const d=difficulty(),margin=Math.max(98,H*.115),min=margin+d.gap/2,max=H-margin-d.gap/2,previous=pipes.length?pipes[pipes.length-1].gapY:H*.5,maxDelta=H*.19;
      let center=min+Math.random()*Math.max(1,max-min);center=Math.max(min,Math.min(max,previous+Math.max(-maxDelta,Math.min(maxDelta,center-previous))));
      pipes.push({x:W+35,w:Math.max(72,W*.19),gapY:center,gap:d.gap,scored:false});
    }

    function milestone(){
      if(!score||score%10) return;
      milestoneEl.textContent=`FLOW ${score}`;milestoneEl.classList.remove('show');void milestoneEl.offsetWidth;milestoneEl.classList.add('show');flash=.42;
      for(let i=0;i<36;i++){const a=Math.random()*Math.PI*2,s=80+Math.random()*190;particles.push({x:W*.5,y:H*.3,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.85,size:2+Math.random()*4,h:(score*23+i*9)%360});}
    }

    function hit(p){const br=bird.r*.68;if(bird.x+br<p.x||bird.x-br>p.x+p.w)return false;return bird.y-br<p.gapY-p.gap/2||bird.y+br>p.gapY+p.gap/2;}

    function update(dt){
      time+=dt;bird.wing=Math.max(0,bird.wing-dt*3.4);
      particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=70*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
      if(state!=='playing'){shake*=Math.pow(.03,dt);flash=Math.max(0,flash-dt*2);return;}
      const d=difficulty();bird.vy+=Math.max(930,H*1.12)*dt;bird.y+=bird.vy*dt;bird.rot=Math.min(1.12,bird.rot+dt*2.45);
      spawnTimer-=dt;if(spawnTimer<=0){spawnPipe();spawnTimer=d.interval;}
      pipes.forEach(p=>{p.x-=d.speed*dt;if(!p.scored&&p.x+p.w<bird.x){p.scored=true;score++;scoreEl.textContent=String(score);flash=.2;milestone();}if(hit(p))finish();});
      pipes=pipes.filter(p=>p.x+p.w>-50);if(bird.y-bird.r<0||bird.y+bird.r>H)finish();shake*=Math.pow(.03,dt);flash=Math.max(0,flash-dt*2.4);
    }

    function coverImage(img,alpha,drift){
      if(!img||!img.complete||!img.naturalWidth)return false;
      const scale=Math.max(W/img.naturalWidth,H/img.naturalHeight),sw=W/scale,sh=H/scale,maxX=Math.max(0,img.naturalWidth-sw),maxY=Math.max(0,img.naturalHeight-sh);
      const sx=maxX*.5+Math.sin(time*.018+drift)*Math.min(maxX*.15,16),sy=Math.max(0,maxY*(.32+drift*.08));ctx.globalAlpha=alpha;ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);ctx.globalAlpha=1;return true;
    }

    function drawFallbackEclipse(){
      const ex=W*.54,ey=H*.26,er=Math.min(W,H)*.095,halo=ctx.createRadialGradient(ex,ey,er*.7,ex,ey,er*1.8);
      halo.addColorStop(0,'rgba(255,185,66,.65)');halo.addColorStop(1,'rgba(255,98,45,0)');ctx.fillStyle=halo;ctx.beginPath();ctx.arc(ex,ey,er*1.8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(24,10,54,.96)';ctx.beginPath();ctx.arc(ex,ey,er,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffbc46';ctx.lineWidth=3;ctx.stroke();
    }

    function drawBackground(){
      ctx.fillStyle='#24104d';ctx.fillRect(0,0,W,H);
      const index=backgrounds.length?Math.floor(score/12)%backgrounds.length:0,next=backgrounds.length?(index+1)%backgrounds.length:0,mix=(score%12)/12;
      const ok=backgrounds.length?coverImage(backgrounds[index],1,index):false;
      if(ok&&backgrounds.length>1&&mix>.72)coverImage(backgrounds[next],Math.min(1,(mix-.72)/.28),next);
      if(!ok){
        const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#29095e');g.addColorStop(.45,'#d94878');g.addColorStop(1,'#122a3c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);drawFallbackEclipse();
      }else{
        ctx.fillStyle='rgba(8,4,24,.045)';ctx.fillRect(0,0,W,H);
      }
    }

    function drawRealPillar(p,top,y,h){
      const sourceW=pipeSprite.naturalWidth,sourceH=pipeSprite.naturalHeight;
      const scale=Math.max(p.w/sourceW,h/sourceH),dw=sourceW*scale,dh=sourceH*scale;
      const dx=p.x+(p.w-dw)/2,dy=(h-dh)/2;
      ctx.save();ctx.beginPath();ctx.rect(p.x,y,p.w,h);ctx.clip();
      if(top){
        ctx.translate(0,y+h);ctx.scale(1,-1);ctx.drawImage(pipeSprite,dx,dy,dw,dh);
      }else{
        ctx.drawImage(pipeSprite,dx,y+dy,dw,dh);
      }
      ctx.restore();
    }

    function drawFallbackPipe(p,top,y,h,endTop,startBottom){
      ctx.save();ctx.beginPath();ctx.roundRect(p.x,y,p.w,h,10);ctx.clip();ctx.drawImage(pipeTexture,p.x,y,p.w,h);ctx.restore();
      ctx.strokeStyle='#171126';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(p.x,y,p.w,h,10);ctx.stroke();
      const capH=30,cy=top?endTop-capH:startBottom,cg=ctx.createLinearGradient(p.x,cy,p.x+p.w,cy+capH);cg.addColorStop(0,'#f2aa32');cg.addColorStop(.5,'#d65079');cg.addColorStop(1,'#2fb597');ctx.fillStyle=cg;ctx.beginPath();ctx.roundRect(p.x-7,cy,p.w+14,capH,9);ctx.fill();ctx.strokeStyle='#171126';ctx.lineWidth=5;ctx.stroke();
    }

    function drawPipe(p,top){
      const endTop=p.gapY-p.gap/2,startBottom=p.gapY+p.gap/2,y=top?0:startBottom,h=top?endTop:H-startBottom;if(h<=0)return;
      if(pipeSprite&&pipeSprite.complete&&pipeSprite.naturalWidth)drawRealPillar(p,top,y,h);
      else drawFallbackPipe(p,top,y,h,endTop,startBottom);
    }

    function drawBird(){
      ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(bird.rot);const s=Math.max(.9,Math.min(1.3,W/390));ctx.scale(s,s);
      if(birdSprite&&birdSprite.complete&&birdSprite.naturalWidth){
        const w=80,h=w*(birdSprite.naturalHeight/birdSprite.naturalWidth),bob=Math.sin(time*12)*1.5-bird.wing*4;
        ctx.shadowColor='rgba(255,73,200,.55)';ctx.shadowBlur=9;ctx.drawImage(birdSprite,-w*.56,-h*.5+bob,w,h);ctx.shadowBlur=0;ctx.restore();return;
      }
      ctx.shadowColor='#ff49c8';ctx.shadowBlur=12;
      for(let i=0;i<11;i++){const a=(i-5)*.22;ctx.fillStyle=i%3===0?'#ff4f9a':i%3===1?'#7935aa':'#18a99f';ctx.beginPath();ctx.ellipse(-26-Math.cos(a)*8,(i-5)*4,22,6,a*.35,0,Math.PI*2);ctx.fill();}
      ctx.shadowBlur=0;ctx.fillStyle='#49215e';ctx.beginPath();ctx.ellipse(0,0,30,25,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffb63c';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#8e3db0';ctx.beginPath();ctx.ellipse(-10,9,20,12,.35,0,Math.PI*2);ctx.fill();const wingLift=bird.wing*7;ctx.fillStyle='#d34a9e';ctx.beginPath();ctx.ellipse(-16,11-wingLift,22,9,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2bd1bd';ctx.beginPath();ctx.arc(8,-7,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffe06a';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#121222';ctx.beginPath();ctx.arc(9,-7,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(12,-10,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffb13c';ctx.beginPath();ctx.moveTo(22,-3);ctx.lineTo(45,5);ctx.lineTo(22,13);ctx.closePath();ctx.fill();ctx.strokeStyle='#21142d';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    }

    function drawParticles(){particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/.85);ctx.fillStyle=`hsl(${p.h} 90% 65%)`;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}
    function draw(){ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawBackground();pipes.forEach(p=>{drawPipe(p,true);drawPipe(p,false);});drawParticles();drawBird();if(state==='idle'){ctx.fillStyle='rgba(15,4,35,.1)';ctx.fillRect(0,0,W,H);}if(flash>0){ctx.fillStyle=`rgba(112,255,203,${flash*.3})`;ctx.fillRect(0,0,W,H);}ctx.restore();}
    function loop(now){const dt=Math.min(.033,Math.max(0,(now-last)/1000||0));last=now;update(dt);draw();if(!root.hidden)raf=requestAnimationFrame(loop);}

    async function open(options={}){
      runtime.options=options;runtime.player=normalizePlayer(options.player);runtime.crew=(options.crew||[]).map(p=>normalizePlayer(p));runtime.adapter=options.leaderboardAdapter||runtime.adapter||localAdapter();
      if(Array.isArray(options.backgrounds)&&options.backgrounds.length)backgrounds=options.backgrounds.map(image).filter(Boolean);
      birdSprite=image(options.birdSprite);pipeSprite=image(options.pipeSprite);
      root.hidden=false;document.documentElement.style.overflow='hidden';resize();reset();await loadRows();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
      if(options.fullscreen!==false&&root.requestFullscreen)root.requestFullscreen().catch(()=>{});
      root.dispatchEvent(new CustomEvent('roadtripgameopen',{detail:{player:runtime.player,crew:runtime.crew}}));
    }

    function close(){root.hidden=true;cancelAnimationFrame(raf);document.documentElement.style.overflow='';if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});root.dispatchEvent(new CustomEvent('roadtripgameclose'));}

    root.addEventListener('pointerdown',e=>{if(e.target.closest('button,.rtg-panel'))return;e.preventDefault();flap();},{passive:false});
    root.querySelector('.rtg-close').addEventListener('click',close);root.querySelector('[data-close]').addEventListener('click',close);root.querySelector('[data-retry]').addEventListener('click',async()=>{await loadRows();reset();});
    addEventListener('resize',resize);
    return{open,close,getScore:()=>score};
  }

  function ensureGame(){ensureStyles();if(!runtime.root){runtime.root=buildRoot();runtime.api=createGame(runtime.root);}return runtime.api;}

  window.RoadtripGame={
    open(options={}){return ensureGame().open(options);},
    close(){if(runtime.api)runtime.api.close();},
    setLeaderboardAdapter(adapter){runtime.adapter=adapter;},
    getScore(){return runtime.api?runtime.api.getScore():0;},
    createLocalLeaderboardAdapter:localAdapter
  };
  window.openRoadtripGame=options=>window.RoadtripGame.open(options||{});
})();
