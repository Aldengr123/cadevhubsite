/* ========== CADev Hub — scroll-scrubbed frame-sequence reveal + interactions ========== */
(function(){
  const FRAME_COUNT = 120;
  const framePath = i => `assets/frames/frame-${String(i).padStart(3,'0')}.webp`;

  const canvas = document.getElementById('revealCanvas');
  const ctx = canvas.getContext('2d', { alpha:false });
  const pin = document.querySelector('.reveal-pin');
  const revealSection = document.querySelector('.reveal');
  const hint = document.querySelector('.hint');
  const heroCopy = document.querySelector('.hero-copy');
  const loader = document.querySelector('.loader');
  const loaderBar = document.querySelector('.loader .bar i');
  const header = document.querySelector('.site-header');

  const frames = new Array(FRAME_COUNT);
  let loaded = 0, ready = false, drawnIndex = -1;
  let copyStart = 0.80;

  function clamp01(x){return Math.min(1,Math.max(0,x));}
  function mapRange(x,a,b){return clamp01((x-a)/(b-a));}

  /* ---- canvas sizing (cover-fit, dpr-aware) ---- */
  function sizeCanvas(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(pin.clientWidth * dpr);
    canvas.height = Math.round(pin.clientHeight * dpr);
    drawnIndex = -1; // force redraw
    render(true);
  }
  function drawCover(img){
    const cw = canvas.width, ch = canvas.height;
    const ir = img.width / img.height, cr = cw / ch;
    let dw, dh, dx, dy;
    if (ir > cr){ dh = ch; dw = ch * ir; dx = (cw - dw)/2; dy = 0; }
    else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh)/2; }
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,cw,ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ---- preload all frames (decode-once → instant scrub, any device) ---- */
  function finishLoading(){
    if (ready) return;
    ready = true;
    loaderBar.style.width = '100%';
    loader.style.opacity = '0';
    setTimeout(()=>loader.style.display='none', 600);
    render(true);
  }
  function preload(){
    let done = 0;
    const tick = (i, img, ok) => {
      done++; loaded = done;
      loaderBar.style.width = (done/FRAME_COUNT*100) + '%';
      if (i===0 && ok) drawCover(img);          // paint first frame asap
      if (done >= FRAME_COUNT) finishLoading();
    };
    for (let i=0;i<FRAME_COUNT;i++){
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => tick(i, img, true);
      img.onerror = () => tick(i, img, false);
      img.src = framePath(i);
      frames[i] = img;
    }
    // safety: never trap the user behind the loader
    setTimeout(finishLoading, 12000);
  }

  /* ---- scroll progress through the reveal section ---- */
  function progress(){
    const rect = revealSection.getBoundingClientRect();
    const total = revealSection.offsetHeight - window.innerHeight;
    return clamp01(total > 0 ? (-rect.top) / total : 0);
  }

  // Synchronous draw on scroll — a single drawImage of an already-decoded
  // frame is instant, so no rAF dependency and no seeking. Smooth everywhere.
  function onScroll(){ render(false); }

  function render(force){
    const p = progress();
    const idx = Math.round(p * (FRAME_COUNT - 1));
    if ((idx !== drawnIndex || force) && frames[idx] && frames[idx].complete && frames[idx].naturalWidth){
      drawCover(frames[idx]);
      drawnIndex = idx;
    }
    const hintO = 1 - mapRange(p, 0.015, 0.10);
    hint.style.opacity = hintO;
    hint.style.transform = `translateY(${(1-hintO)*20}px)`;
    const copyIn = mapRange(p, copyStart, copyStart + 0.165);
    heroCopy.style.opacity = copyIn;
    heroCopy.style.transform = `translateY(${-46 + (1-copyIn)*4}%) scale(${0.985+copyIn*0.015})`;
    heroCopy.style.pointerEvents = copyIn > 0.5 ? 'auto':'none';
    if (copyIn > 0.5) heroCopy.classList.add('entered');
    if (p > 0.86) header.classList.add('show'); else header.classList.remove('show');
  }

  /* ---- header solid state once past reveal ---- */
  function headerSolid(){
    if (window.scrollY > window.innerHeight * 0.9) header.classList.add('solid');
    else header.classList.remove('solid');
  }

  window.addEventListener('scroll', ()=>{ onScroll(); headerSolid(); revealOnScroll(); }, {passive:true});
  window.addEventListener('resize', sizeCanvas);

  /* ---- bridge for the Tweaks panel ---- */
  window.__cadev = {
    recalc(){ sizeCanvas(); render(true); },
    setCopyStart(v){ copyStart = v; render(true); }
  };
  window.addEventListener('cadev:tweak', e=>{
    if (e.detail && typeof e.detail.copyStart === 'number') copyStart = e.detail.copyStart;
    sizeCanvas(); render(true);
  });

  // kick off
  sizeCanvas();
  preload();

  /* ========== reveal-on-scroll for content (scroll-driven, no IO/rAF) ========== */
  // split word-reveal headings into per-word spans with a stagger delay
  const wordEls = Array.from(document.querySelectorAll('.reveal-words'));
  wordEls.forEach(h=>{
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = '';
    words.forEach((w,i)=>{
      const span = document.createElement('span');
      span.className = 'rw';
      span.textContent = w;
      span.style.transitionDelay = (i*0.045)+'s';
      h.appendChild(span);
    });
  });

  const fxEls = Array.from(document.querySelectorAll('.fx'));
  let statsDone = false;
  function fireStats(){
    if (statsDone) return; statsDone = true;
    document.querySelectorAll('.ring').forEach(r=>{
      const prog = r.querySelector('.prog');
      const pct = parseFloat(r.dataset.pct);
      const C = 2 * Math.PI * 54; // r=54
      prog.style.strokeDasharray = C;
      prog.style.strokeDashoffset = C;
      setTimeout(()=>{ prog.style.strokeDashoffset = C * (1 - pct); }, 60);
      const num = r.querySelector('.num');
      const target = parseInt(r.dataset.val,10);
      const steps = 40; let s = 0;
      const iv = setInterval(()=>{
        s++;
        const k = s/steps, eased = 1-Math.pow(1-k,3);
        num.textContent = '+' + Math.round(target*eased);
        if(s>=steps){ num.textContent = '+' + target; clearInterval(iv); }
      }, 34);
    });
  }
  const statsSection = document.querySelector('.stats');
  function revealOnScroll(){
    const vh = window.innerHeight;
    for (let i=fxEls.length-1;i>=0;i--){
      const el = fxEls[i];
      if (el.getBoundingClientRect().top < vh*0.86){ el.classList.add('in'); fxEls.splice(i,1); }
    }
    for (let i=wordEls.length-1;i>=0;i--){
      const el = wordEls[i];
      if (el.getBoundingClientRect().top < vh*0.86){ el.classList.add('in'); wordEls.splice(i,1); }
    }
    if (statsSection && !statsDone && statsSection.getBoundingClientRect().top < vh*0.7) fireStats();
  }
  revealOnScroll();

  /* ========== project video lightbox ========== */
  const lb = document.getElementById('lightbox');
  const lbVideo = lb.querySelector('video');
  document.querySelectorAll('[data-video]').forEach(el=>{
    el.addEventListener('click',()=>{
      lb.classList.add('open');
      lbVideo.currentTime = 0;
      lbVideo.play().catch(()=>{});
    });
  });
  function closeLb(){ lb.classList.remove('open'); lbVideo.pause(); }
  lb.querySelector('.close').addEventListener('click',closeLb);
  lb.addEventListener('click',e=>{ if(e.target===lb) closeLb(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLb(); });

  /* smooth-scroll for in-page nav */
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const t = document.querySelector(a.getAttribute('href'));
      if(t){ e.preventDefault(); window.scrollTo({top:t.getBoundingClientRect().top+window.scrollY-70,behavior:'smooth'}); }
    });
  });

  /* ========== rotating word in the hero headline ========== */
  const ROT_WORDS = ['impressiona', 'vende', 'escala'];
  const rotEl = document.querySelector('.rot-word');
  if (rotEl){
    let ri = 0;
    setInterval(()=>{
      rotEl.style.opacity = '0';
      rotEl.style.transform = 'translateY(-0.5em)';
      setTimeout(()=>{
        ri = (ri+1) % ROT_WORDS.length;
        rotEl.textContent = ROT_WORDS[ri];
        rotEl.style.transition = 'none';
        rotEl.style.transform = 'translateY(0.5em)';
        void rotEl.offsetWidth;                 // force reflow
        rotEl.style.transition = 'opacity .38s ease, transform .42s var(--ease)';
        rotEl.style.opacity = '1';
        rotEl.style.transform = 'translateY(0)';
      }, 400);
    }, 2400);
  }
})();
