(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var root = document.documentElement;
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var finePointer = window.matchMedia && matchMedia('(pointer: fine)').matches;
var rand = function (a, b) { return a + Math.random() * (b - a); };
var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
var store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};
var CONFETTI = ['#FFC53D', '#138A8A', '#FFF4E4', '#F07A2C', '#9ED8D2', '#CE2836'];
function restart(el, cls) { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); }
function onVisible(el, cb, threshold) {
  var t = threshold || 0;
  if (!('IntersectionObserver' in window)) { cb(true); return; }
  new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { cb(e.isIntersecting && e.intersectionRatio >= t - 0.01, e); });
  }, { threshold: t > 0 ? [0, t] : [0] }).observe(el);
}

/* =========================================================
   SOUND: tiny synth, plays only after a tap or click
   ========================================================= */
var Sound = (function () {
  var ctx = null, master = null;
  var muted = store.get('bday-muted') === '1';
  function ensure() {
    if (muted) return null;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function N(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function tone(freq, dur, o) {
    o = o || {}; var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    var v = o.vol == null ? 0.1 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  var noiseBuf = null;
  function noise(dur, o) {
    o = o || {}; var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0);
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource(); src.buffer = noiseBuf;
    var f = c.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t0 + dur);
    var g = c.createGain(); var v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  var engine = { o: null, g: null, f: null };
  var api = {
    N: N, tone: tone,
    get muted() { return muted; },
    setMuted: function (m) { muted = m; store.set('bday-muted', m ? '1' : '0'); if (m) { api.engineStop(); if (ctx) ctx.suspend(); } else ensure(); },
    unlock: function () { ensure(); },
    note: function (n, dur, vol, delay) { tone(N(n), dur || 0.12, { vol: vol || 0.06, delay: delay || 0, type: 'triangle' }); },
    pop: function () { noise(0.12, { ftype: 'highpass', freq: 900, vol: 0.35 }); tone(600, 0.08, { type: 'triangle', to: 180, vol: 0.1 }); },
    jump: function () { tone(330, 0.15, { to: 900, vol: 0.06 }); },
    coin: function () { tone(N(83), 0.07, { vol: 0.06 }); tone(N(88), 0.2, { vol: 0.06, delay: 0.07 }); },
    crash: function () { noise(0.45, { freq: 900, fto: 120, vol: 0.3 }); tone(160, 0.4, { type: 'sawtooth', to: 50, vol: 0.07 }); },
    level: function () { [72, 76, 79, 84].forEach(function (n, i) { tone(N(n), 0.13, { vol: 0.07, delay: i * 0.08 }); }); },
    jingle: function () { [67, 72, 76, 79, 76, 79, 84].forEach(function (n, i) { tone(N(n), i === 6 ? 0.5 : 0.13, { vol: 0.08, delay: i * 0.1, type: i % 2 ? 'square' : 'triangle' }); }); },
    woof: function () { [0, 0.22].forEach(function (d) { noise(0.15, { freq: 700, fto: 180, vol: 0.35, delay: d }); tone(220, 0.14, { type: 'sawtooth', to: 110, vol: 0.12, delay: d }); }); },
    meow: function () {
      var c = ensure(); if (!c) return; var t0 = c.currentTime;
      var o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 3;
      o.frequency.setValueAtTime(560, t0); o.frequency.linearRampToValueAtTime(900, t0 + 0.16); o.frequency.linearRampToValueAtTime(620, t0 + 0.48);
      f.frequency.setValueAtTime(1000, t0); f.frequency.linearRampToValueAtTime(2000, t0 + 0.18); f.frequency.linearRampToValueAtTime(900, t0 + 0.48);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);
      o.connect(f); f.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.55);
    },
    purr: function () {
      var c = ensure(); if (!c) return; var t0 = c.currentTime;
      var o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 46; f.type = 'lowpass'; f.frequency.value = 360;
      lfo.frequency.value = 22; lg.gain.value = 0.07; lfo.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.15); g.gain.setValueAtTime(0.1, t0 + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.3);
      o.connect(f); f.connect(g); g.connect(master); o.start(t0); lfo.start(t0); o.stop(t0 + 1.35); lfo.stop(t0 + 1.35);
    },
    beep: function () { tone(N(76), 0.16, { vol: 0.09 }); tone(N(76), 0.24, { vol: 0.09, delay: 0.22 }); },
    puff: function () { noise(0.35, { freq: 2600, fto: 300, vol: 0.22 }); },
    click: function () { tone(1700, 0.03, { vol: 0.05 }); noise(0.03, { ftype: 'highpass', freq: 3000, vol: 0.08 }); },
    zap: function () { noise(0.1, { ftype: 'bandpass', freq: 3200, vol: 0.18 }); },
    fixed: function () { [76, 79, 84].forEach(function (n, i) { tone(N(n), 0.12, { vol: 0.07, delay: i * 0.08, type: 'triangle' }); }); },
    squeak: function () { tone(1400, 0.12, { type: 'sine', to: 2200, vol: 0.05 }); tone(2100, 0.1, { type: 'sine', to: 1500, vol: 0.04, delay: 0.12 }); },
    boom: function () { noise(0.7, { freq: 1600, fto: 160, vol: 0.16 }); },
    paper: function () { noise(0.25, { ftype: 'highpass', freq: 2500, vol: 0.08 }); },
    engineStart: function () {
      var c = ensure(); if (!c || engine.o) return;
      engine.o = c.createOscillator(); engine.g = c.createGain(); engine.f = c.createBiquadFilter();
      engine.o.type = 'sawtooth'; engine.o.frequency.value = 55; engine.f.type = 'lowpass'; engine.f.frequency.value = 500;
      engine.g.gain.value = 0.0001; engine.o.connect(engine.f); engine.f.connect(engine.g); engine.g.connect(master);
      engine.o.start(); engine.g.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 0.1);
    },
    engineSet: function (s) { if (!engine.o) return; var t = ctx.currentTime; engine.o.frequency.setTargetAtTime(42 + s * 30, t, 0.08); engine.f.frequency.setTargetAtTime(360 + s * 280, t, 0.1); },
    engineStop: function () {
      if (!engine.o) return; var o = engine.o, g = engine.g;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(function () { try { o.stop(); } catch (e) {} }, 700);
      engine.o = engine.g = engine.f = null;
    }
  };
  return api;
})();

var soundBtn = $('#soundBtn');
function syncSoundBtn() {
  soundBtn.setAttribute('aria-pressed', String(!Sound.muted));
  soundBtn.setAttribute('aria-label', Sound.muted ? 'Sound effects: off' : 'Sound effects: on');
}
syncSoundBtn();
soundBtn.addEventListener('click', function () { Sound.setMuted(!Sound.muted); syncSoundBtn(); if (!Sound.muted) Sound.coin(); });

/* =========================================================
   FX: full-screen confetti bursts
   ========================================================= */
var FX = (function () {
  var cv = $('#fx'), ctx = cv.getContext('2d'), W = 0, H = 0, parts = [], running = false;
  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); addEventListener('resize', resize);
  function burst(x, y, n, o) {
    if (reduce) return;
    o = o || {}; n = n || 40;
    var cols = o.colors || CONFETTI;
    for (var i = 0; i < n; i++) {
      var a = o.angle != null ? o.angle + rand(-(o.spread || 0.6), o.spread || 0.6) : rand(0, Math.PI * 2);
      var sp = rand(o.min || 3, o.max || 9);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up == null ? 2 : o.up), g: o.g == null ? 0.2 : o.g,
        w: rand(6, 11), h: rand(9, 15), r: rand(0, 6.28), vr: rand(-0.3, 0.3), c: cols[i % cols.length], life: 0, max: rand(80, 130), round: Math.random() < 0.28, flip: rand(0.08, 0.2) });
    }
    if (parts.length > 900) parts.splice(0, parts.length - 900);
    if (!running) { running = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    var alive = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]; p.life++;
      if (p.life > p.max || p.y > H + 40) continue;
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (p.max - p.life) / 25)); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 6.283); ctx.fill(); }
      else { var s = Math.abs(Math.cos(p.life * p.flip)); ctx.fillRect(-p.w / 2, -p.h / 2 * s, p.w, p.h * s + 1); }
      ctx.restore(); alive.push(p);
    }
    parts = alive;
    if (parts.length) requestAnimationFrame(tick); else { running = false; ctx.clearRect(0, 0, W, H); }
  }
  function burstAt(el, n, o) { var r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, n, o); }
  function rain(n) { for (var i = 0; i < (n || 6); i++) setTimeout(function () { burst(rand(0, W), -20, 22, { angle: Math.PI / 2, spread: 0.9, min: 1, max: 4, up: 0, g: 0.12 }); }, i * 140); }
  return { burst: burst, burstAt: burstAt, rain: rain };
})();

/* =========================================================
   HERO: rain, sparkles, rising balloons, letters
   ========================================================= */
var hero = $('.hero');
function setHeroH() {
  var w = hero.offsetWidth, h = hero.offsetHeight, cy = h * 0.46;
  hero.style.setProperty('--heroH', h + 'px');
  hero.style.setProperty('--raysize', Math.ceil(2 * Math.hypot(w / 2, Math.max(cy, h - cy)) + 40) + 'px');
}
setHeroH();
if ('ResizeObserver' in window) new ResizeObserver(setHeroH).observe(hero); else addEventListener('resize', setHeroH);

(function makeRain() {
  var box = $('#rain'); if (!box) return;
  var html = '';
  for (var i = 0; i < 30; i++) {
    var cls = 'cf' + (i % 4 === 0 ? ' round' : i % 4 === 1 ? ' strip' : '');
    html += '<span class="' + cls + '" style="left:' + rand(0, 99).toFixed(1) + '%;background:' + CONFETTI[i % 5] + ';--t:' + rand(7, 14).toFixed(1) + 's;--d:-' + rand(0, 14).toFixed(1) + 's;--r:' + (Math.random() < .5 ? '-' : '') + Math.round(rand(300, 720)) + 'deg"></span>';
  }
  box.innerHTML = html;
})();

(function makeSparkles() {
  var box = $('#sparkles'); if (!box) return;
  var spots = [[8, 16], [92, 14], [18, 30], [82, 32], [30, 9], [70, 8], [4, 52], [96, 50], [12, 74], [88, 72], [40, 26], [62, 27]];
  var html = '';
  spots.forEach(function (s, i) {
    var c = i % 3 === 0 ? '#FFC53D' : '#FFF4E4';
    html += '<svg class="sparkle" viewBox="0 0 20 20" style="left:' + s[0] + '%;top:' + s[1] + '%;--sz:' + Math.round(rand(12, 26)) + 'px;--t:' + rand(1.6, 3.2).toFixed(1) + 's;--d:-' + rand(0, 3).toFixed(1) + 's"><path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6 Z" fill="' + c + '"/></svg>';
  });
  box.innerHTML = html;
})();

var Balloons = (function () {
  var field = $('#balloonField'), timer = null;
  var colors = [['#FFC53D', '#FFE08A'], ['#138A8A', '#9ED8D2'], ['#FFF4E4', '#FFFFFF'], ['#F07A2C', '#FFB27A'], ['#0B5E62', '#5FB8B2'], ['#FFC53D', '#FFE08A']];
  function svg(c) {
    return '<svg viewBox="0 0 80 200"><path d="M40 92 C46 120 34 150 42 196" stroke="#FFF4E4" stroke-width="2" fill="none"/><ellipse cx="40" cy="45" rx="34" ry="42" fill="' + c[0] + '" stroke="#24161A" stroke-width="3"/><path d="M35 86 L45 86 L40 94 Z" fill="' + c[0] + '" stroke="#24161A" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 30 C22 20 28 14 36 12" stroke="' + c[1] + '" stroke-width="5" stroke-linecap="round" fill="none"/></svg>';
  }
  function spawn() {
    if (document.hidden || !field || field.childElementCount > 7) return;
    var r = hero.getBoundingClientRect(); if (r.bottom < 0) return;
    var b = document.createElement('div'); b.className = 'rb';
    b.style.left = rand(1, 92).toFixed(1) + '%';
    b.style.setProperty('--w', Math.round(rand(52, 86)) + 'px');
    b.style.setProperty('--t', rand(13, 21).toFixed(1) + 's');
    b.style.setProperty('--s', rand(2.2, 4).toFixed(1) + 's');
    b.innerHTML = '<div>' + svg(pick(colors)) + '</div>';
    b.addEventListener('pointerdown', function () { pop(b); });
    b.addEventListener('animationend', function (e) { if (e.target === b) b.remove(); });
    field.appendChild(b);
  }
  function pop(b) {
    if (b.classList.contains('popped')) return;
    b.classList.add('popped'); Sound.pop();
    var r = b.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.width * 0.55, 34, { min: 2, max: 8, up: 1 });
    setTimeout(function () { b.remove(); }, 240);
  }
  return { start: function () { if (reduce || timer || !field) return; for (var i = 0; i < 3; i++) setTimeout(spawn, 300 + i * 900); timer = setInterval(spawn, 2200); } };
})();

$$('.cluster .bl').forEach(function (bl) {
  bl.addEventListener('pointerdown', function () {
    if (bl.classList.contains('gone')) return;
    bl.classList.remove('back'); bl.classList.add('gone'); Sound.pop();
    var r = bl.getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.width * 0.5, 40, { min: 2, max: 9 });
    setTimeout(function () { bl.classList.remove('gone'); restart(bl, 'back'); }, 2600);
  });
});

var scale = [0, 2, 4, 5, 7, 9, 11, 12, 14];
$$('.ltr').forEach(function (l, i) {
  l.addEventListener('pointerdown', function () { restart(l, 'boing'); Sound.note(64 + scale[i % scale.length], 0.14, 0.07); });
  l.addEventListener('mouseenter', function () { Sound.note(64 + scale[i % scale.length], 0.09, 0.03); });
  l.addEventListener('animationend', function () { l.classList.remove('boing'); });
});

/* marquee lights */
function layoutBulbs(box, perPx) {
  var holder = $('.bulbs', box); if (!holder) return;
  var W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
  var band = parseFloat(getComputedStyle(box).paddingLeft) || 24;
  var h = band / 2, gap = perPx;
  var nx = Math.max(4, Math.round((W - band) / gap)), ny = Math.max(3, Math.round((H - band) / gap));
  var html = '', k = 0;
  function add(x, y) { html += '<i class="bulb c' + (k++ % 3) + '" style="left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px"></i>'; }
  var i, j;
  for (i = 0; i <= nx; i++) add(h + (W - band) * i / nx, h);
  for (j = 1; j <= ny; j++) add(W - h, h + (H - band) * j / ny);
  for (i = nx - 1; i >= 0; i--) add(h + (W - band) * i / nx, H - h);
  for (j = ny - 1; j >= 1; j--) add(h, h + (H - band) * j / ny);
  holder.innerHTML = html;
}
var marquee = $('#marquee'), cabTop = $('#cabTop');
function relayoutBulbs() { if (marquee) layoutBulbs(marquee, innerWidth < 760 ? 30 : 38); if (cabTop) layoutBulbs(cabTop, 30); }
relayoutBulbs();
if ('ResizeObserver' in window) { var ro = new ResizeObserver(relayoutBulbs); if (marquee) ro.observe(marquee); if (cabTop) ro.observe(cabTop); }
else addEventListener('resize', relayoutBulbs);

/* =========================================================
   PETS: reactions, speech bubbles, hearts, eyes that follow you
   ========================================================= */
function hearts(btn, n, color) {
  for (var i = 0; i < n; i++) {
    var h = document.createElement('span'); h.className = 'heart';
    h.innerHTML = '<svg viewBox="0 0 24 22"><path d="M12 21 C5 15 1 11 1 6.5 A5.5 5.5 0 0 1 12 4 A5.5 5.5 0 0 1 23 6.5 C23 11 19 15 12 21Z" fill="' + color + '" stroke="#24161A" stroke-width="2"/></svg>';
    h.style.left = rand(25, 70).toFixed(0) + '%'; h.style.top = rand(10, 40).toFixed(0) + '%';
    h.style.setProperty('--dx', rand(-50, 50).toFixed(0) + 'px'); h.style.setProperty('--rot', rand(-35, 35).toFixed(0) + 'deg');
    h.style.animationDelay = (i * 0.12) + 's';
    btn.appendChild(h);
    (function (el, d) { setTimeout(function () { el.remove(); }, 1700 + d); })(h, i * 120);
  }
}
var petConfig = {
  'pet-dog': { sound: function () { Sound.woof(); }, heart: '#E8353F', n: 4 },
  'pet-tortie': { sound: function () { Sound.meow(); }, heart: '#F07A2C', n: 3, burst: true },
  'pet-cat': { sound: function () { Sound.purr(); }, heart: '#E8A3AA', n: 5 }
};
$$('.pet').forEach(function (btn) {
  var says = (btn.dataset.say || '').split('|'), k = 0, conf = null;
  Object.keys(petConfig).forEach(function (c) { if (btn.classList.contains(c)) conf = petConfig[c]; });
  btn.addEventListener('click', function () {
    var b = $('.bubble', btn); if (b && says.length) b.textContent = says[k++ % says.length];
    restart(btn, 'react'); clearTimeout(btn._t); btn._t = setTimeout(function () { btn.classList.remove('react'); }, 1600);
    if (conf) { conf.sound(); hearts(btn, conf.n, conf.heart); if (conf.burst) FX.burstAt(btn, 34, { angle: -Math.PI / 2, spread: 0.7, min: 4, max: 10 }); }
  });
});

(function eyes() {
  var groups = $$('.pupils').map(function (p) { return { p: p, whites: $$('.eye-w', p.parentNode), max: +p.dataset.max || 3 }; });
  if (!groups.length) return;
  var px = innerWidth / 2, py = innerHeight * 0.45, raf = 0, last = 0;
  function upd() {
    raf = 0;
    groups.forEach(function (g) {
      var cx = 0, cy = 0, n = 0;
      g.whites.forEach(function (w) { var r = w.getBoundingClientRect(); if (r.width) { cx += r.left + r.width / 2; cy += r.top + r.height / 2; n++; } });
      if (!n) return; cx /= n; cy /= n;
      var svg = g.p.ownerSVGElement, vb = svg.viewBox.baseVal, s = svg.getBoundingClientRect().width / (vb.width || 1);
      if (!s) return;
      var dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1, m = Math.min(g.max, d / s / 26);
      g.p.setAttribute('transform', 'translate(' + (dx / d * m).toFixed(2) + ' ' + (dy / d * m * 0.8).toFixed(2) + ')');
    });
  }
  function req() { if (!raf) raf = requestAnimationFrame(upd); }
  addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; last = Date.now(); req(); }, { passive: true });
  addEventListener('pointerdown', function (e) { px = e.clientX; py = e.clientY; last = Date.now(); req(); }, { passive: true });
  addEventListener('scroll', req, { passive: true });
  setInterval(function () { if (Date.now() - last > 3500) { px = rand(0, innerWidth); py = rand(0, innerHeight); req(); } }, 2300);
  req();
})();

/* =========================================================
   INTRO: the present
   ========================================================= */
var intro = $('#intro'), giftBtn = $('#giftBtn'), opened = false, partyStarted = false;
function startParty() {
  root.classList.remove('pre', 'lock'); restart(root, 'party');
  setHeroH(); relayoutBulbs();
  if (!partyStarted) { partyStarted = true; Balloons.start(); }
}
function openGift(skip) {
  if (opened) return; opened = true;
  if (!skip) {
    Sound.unlock(); Sound.pop(); setTimeout(function () { Sound.jingle(); }, 140);
    var r = giftBtn.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height * 0.35, 150, { min: 4, max: 15, up: 5 });
    setTimeout(function () { FX.burst(innerWidth * 0.18, innerHeight * 0.3, 60); }, 260);
    setTimeout(function () { FX.burst(innerWidth * 0.82, innerHeight * 0.3, 60); }, 420);
  }
  intro.classList.add('opening');
  var pg = $('.page'); if (pg) pg.inert = false;
  setTimeout(function () { intro.classList.add('gone'); startParty(); if (!skip) FX.rain(5); }, skip ? 0 : 650);
  setTimeout(function () { intro.hidden = true; }, skip ? 900 : 1900);
}
function showIntro() {
  opened = false;
  intro.classList.remove('gone', 'opening'); intro.hidden = false;
  var pg = $('.page'); if (pg) pg.inert = true;
  root.classList.remove('party'); root.classList.add('pre', 'lock');
}
if (intro && giftBtn) {
  giftBtn.addEventListener('click', function () { openGift(false); });
  $('#skipBtn').addEventListener('click', function () { openGift(true); });
  addEventListener('keydown', function (e) { if (!opened && e.key === 'Escape') openGift(true); });
  showIntro();
} else { startParty(); }

$$('.hero, .note-sec, .shop, .arcade, .ride, .finale').forEach(function (sec) {
  onVisible(sec, function (vis) { sec.classList.toggle('paused', !vis); }, 0);
});

/* =========================================================
   SCROLL: progress bike, reveals, sparkle trail
   ========================================================= */
(function progress() {
  var fill = $('#progFill'), bike = $('#progBike'), raf = 0;
  function upd() {
    raf = 0;
    var max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    bike.style.left = Math.min(innerWidth - 20, Math.max(20, p * innerWidth)) + 'px';
  }
  addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  addEventListener('resize', upd); upd();
})();

if ('IntersectionObserver' in window) {
  var revealObs = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(function (el) { revealObs.observe(el); });
} else { $$('.reveal').forEach(function (el) { el.classList.add('in'); }); }

if (finePointer && !reduce) {
  var lastSpark = 0, sparkCount = 0;
  addEventListener('pointermove', function (e) {
    var now = Date.now(); if (now - lastSpark < 45 || sparkCount > 26 || e.pointerType !== 'mouse') return; lastSpark = now;
    var s = document.createElement('div'); s.className = 'spark'; sparkCount++;
    s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
    s.innerHTML = '<svg viewBox="0 0 20 20" width="12" height="12"><path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6 Z" fill="' + pick(['#FFC53D', '#FFF4E4', '#9ED8D2', '#F07A2C']) + '"/></svg>';
    document.body.appendChild(s);
    setTimeout(function () { s.remove(); sparkCount--; }, 720);
  }, { passive: true });
}

/* =========================================================
   NOTE: the envelope opens when it scrolls into view
   ========================================================= */
(function envelope() {
  var wrap = $('#noteWrap'); if (!wrap) return;
  var env = $('.envelope', wrap), done = false;
  function open() {
    if (done) return; done = true;
    env.classList.remove('idle'); wrap.classList.add('open');
    setTimeout(function () { Sound.paper(); }, 300);
    setTimeout(function () { Sound.note(72, 0.12, 0.05); Sound.note(79, 0.18, 0.05, 0.1); }, 1300);
  }
  if (reduce) { wrap.classList.add('open'); env.classList.remove('idle'); return; }
  onVisible(wrap, function (vis) { if (vis) setTimeout(open, 250); }, 0.45);
  env.parentNode.addEventListener('click', open);
})();

/* =========================================================
   WORKSHOP
   ========================================================= */
(function shop() {
  var scene = $('#shopScene'); if (!scene) return;
  var sw = $('#hsSwitch'), valve = $('#hsValve'), box = $('#hsBox'), stamp = $('#fixedStamp');
  function hideTag(id) { var t = $('#' + id); if (t) t.classList.add('hide'); }
  sw.addEventListener('click', function () {
    var dark = scene.classList.toggle('dark');
    sw.setAttribute('aria-pressed', String(!dark)); Sound.click(); hideTag('tagSwitch');
    if (!dark) Sound.zap();
  });
  valve.addEventListener('click', function () {
    hideTag('tagValve');
    if (scene.classList.contains('fixed')) {
      scene.classList.remove('fixed'); stamp.classList.remove('show'); valve.classList.remove('done'); valve.setAttribute('aria-pressed', 'false'); Sound.squeak(); return;
    }
    scene.classList.add('fixed'); valve.classList.add('done'); valve.setAttribute('aria-pressed', 'true'); Sound.squeak();
    setTimeout(function () { restart(stamp, 'show'); Sound.fixed(); FX.burstAt(valve, 46, { min: 3, max: 10 }); }, 800);
  });
  box.addEventListener('click', function () {
    hideTag('tagBox'); scene.classList.add('box-open'); Sound.pop(); setTimeout(function () { Sound.jingle(); }, 120);
    FX.burstAt(box, 90, { angle: -Math.PI / 2, spread: 0.65, min: 6, max: 14, up: 3 });
    clearTimeout(box._t); box._t = setTimeout(function () { scene.classList.remove('box-open'); }, 1700);
  });
  var flickered = false;
  onVisible(scene, function (vis) {
    if (!vis || flickered || reduce) return; flickered = true;
    [0, 120, 260, 340, 520].forEach(function (t, i) { setTimeout(function () { scene.classList.toggle('dark', i % 2 === 0); }, 400 + t); });
    setTimeout(function () { scene.classList.remove('dark'); }, 1100);
  }, 0.5);
})();

/* =========================================================
   ARCADE: Birthday Run
   ========================================================= */
(function game() {
  var cv = $('#game'); if (!cv) return;
  var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  var W = 256, H = 144, GROUND = 124;
  function pickRes() { var cw = cv.getBoundingClientRect().width || 600; var w = cw < 440 ? 200 : 256; if (w !== W || cv.width !== w) { W = w; H = Math.round(w * 9 / 16); GROUND = H - 20; cv.width = W; cv.height = H; g.imageSmoothingEnabled = false; if (typeof P !== 'undefined' && P.ground) P.y = GROUND - 23; } }
  pickRes();
  var PAL = { k: '#24161A', K: '#120C0E', S: '#C9D1D8', s: '#8C97A1', p: '#E39B7F', b: '#4A6FA5', y: '#E8B894', e: '#B4AEA6', r: '#CE2836', R: '#8E1426', c: '#FFF4E4', n: '#1F2D4A', T: '#BFE3E6', g: '#FFC53D', o: '#F07A2C', P: '#F48FA3', d: '#3A3236' };
  function sprite(rows) {
    var h = rows.length, w = rows[0].length, c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    rows.forEach(function (row, j) { for (var i = 0; i < row.length; i++) { var ch = row[i]; if (ch !== '.' && PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, j, 1, 1); } } });
    return c;
  }
  function makeBike(frame) {
    var c = document.createElement('canvas'); c.width = 32; c.height = 23; var x = c.getContext('2d');
    function R(col, a, b, w, h) { x.fillStyle = PAL[col]; x.fillRect(a, b, w, h); }
    var wheel = frame ? ['..KKKKK..', '.KKSSSKK.', 'KKSdddSKK', 'KSdSdSdSK', 'KSddSddSK', 'KSdSdSdSK', 'KKSdddSKK', '.KKSSSKK.', '..KKKKK..']
                      : ['..KKKKK..', '.KKSSSKK.', 'KKSdddSKK', 'KSddSddSK', 'KSdSSSdSK', 'KSddSddSK', 'KKSdddSKK', '.KKSSSKK.', '..KKKKK..'];
    function W9(ox, oy) { wheel.forEach(function (row, j) { for (var i = 0; i < 9; i++) { var ch = row[i]; if (ch !== '.') { x.fillStyle = PAL[ch]; x.fillRect(ox + i, oy + j, 1, 1); } } }); }
    // tour pack + rack + taillight
    R('S', 1, 6, 8, 1); R('k', 1, 7, 8, 5); R('r', 1, 11, 8, 1); R('d', 9, 8, 1, 4);
    // saddlebag
    R('k', 2, 13, 9, 4); R('S', 2, 13, 9, 1); R('r', 3, 15, 2, 1);
    // seat, tank, engine
    R('d', 9, 11, 8, 2); R('k', 16, 10, 7, 3); R('r', 17, 12, 5, 1);
    R('s', 12, 14, 8, 3); R('S', 13, 13, 2, 3); R('S', 17, 13, 2, 3); R('k', 11, 13, 10, 1);
    // exhaust
    R('S', 6, 18, 13, 2); R('k', 5, 18, 1, 2);
    // fork + fender
    R('S', 24, 12, 1, 2); R('S', 25, 14, 1, 2); R('S', 26, 16, 1, 2); R('k', 23, 13, 6, 1); R('k', 22, 14, 2, 1);
    // fairing, windshield, headlight
    R('T', 22, 5, 2, 3); R('T', 24, 6, 1, 2);
    R('k', 23, 8, 4, 1); R('k', 22, 9, 7, 1); R('k', 22, 10, 8, 2); R('k', 23, 12, 6, 1); R('c', 30, 10, 1, 2); R('r', 23, 11, 5, 1);
    // rider: helmet, face, beard
    R('k', 15, 0, 4, 1); R('k', 14, 1, 6, 2); R('k', 19, 2, 2, 1);
    R('k', 14, 3, 2, 1); R('y', 16, 3, 2, 1); R('k', 18, 3, 2, 1);
    R('y', 15, 4, 5, 1); R('e', 16, 5, 4, 1); R('e', 17, 6, 2, 1);
    // torso, arm, hand
    R('p', 13, 6, 4, 1); R('p', 12, 7, 6, 3); R('p', 13, 10, 4, 1);
    R('p', 17, 7, 3, 1); R('y', 19, 8, 3, 1); R('y', 21, 9, 1, 1);
    // legs, shoe
    R('b', 12, 11, 7, 2); R('b', 18, 12, 2, 3); R('n', 18, 15, 3, 1);
    W9(0, 14); W9(22, 14);
    return c;
  }
  var bikeA = makeBike(0), bikeB = makeBike(1);
  var cone = sprite(['....o....', '...ooo...', '...ccc...', '...ooo...', '..ooooo..', '..ccccc..', '..ooooo..', '.ooooooo.', '.ooooooo.', 'kkkkkkkkk', 'kkkkkkkkk']);
  var tbox = sprite(['....kkkkk....', '....k...k....', 'rrrrrrrrrrrrr', 'rRRRRRRRRRRRr', 'rrrrrgggrrrrr', 'rrrrrgggrrrrr', 'rrrrrrrrrrrrr', 'rrrrrrrrrrrrr', 'kkkkkkkkkkkkk']);
  var cupA = sprite(['....g....', '....c....', '....c....', '..PPPPP..', '.PPPPPPP.', 'PPPPPPPPP', '.rRrRrRr.', '.rRrRrRr.', '..rRrRr..']);
  var cupB = sprite(['....o....', '....c....', '....c....', '..PPPPP..', '.PPPPPPP.', 'PPPPPPPPP', '.rRrRrRr.', '.rRrRrRr.', '..rRrRr..']);
  var star = sprite(['...g...', '..ggg..', 'ggggggg', '.ggggg.', '..ggg..', '.gg.gg.', 'g.....g']);

  var state = 'title', frame = 0, speed = 2.0, score = 0, hi = +(store.get('bday-hi') || 0), level = 64, nextLevel = 200;
  var P = { x: 30, y: GROUND - 23, vy: 0, ground: true, hold: false };
  var obs = [], items = [], parts = [], pops = [], dist = 0, scroll = 0, overT = 0, shake = 0, nextObs = 160, nextItem = 260;
  var visible = false, raf = 0, acc = 0, lastTs = 0;
  var stars = []; for (var i = 0; i < 36; i++) stars.push([Math.random() * W, Math.random() * 70, Math.random() * 6.28]);

  function reset() {
    state = 'play'; frame = 0; speed = 2.0; score = 0; level = 64; nextLevel = 200; dist = 0; overT = 0;
    P.y = GROUND - 23; P.vy = 0; P.ground = true; obs = []; items = []; parts = []; pops = []; nextObs = 140; nextItem = 220;
  }
  function start() { Sound.unlock(); if (state === 'over' && overT < 50) return; reset(); Sound.level(); }
  function jump() {
    if (state !== 'play') { start(); return; }
    if (P.ground) { P.vy = -6.6; P.ground = false; P.hold = true; Sound.jump(); for (var i = 0; i < 5; i++) parts.push({ x: P.x + 4, y: GROUND - 1, vx: rand(-1.5, -0.3), vy: rand(-1.2, -0.2), l: 18, c: '#8C97A1' }); }
  }
  function release() { P.hold = false; if (P.vy < -2.6) P.vy = -2.6; }
  function popText(t, x, y, c) { pops.push({ t: t, x: x, y: y, l: 60, c: c || '#FFC53D' }); }
  function confetti(n) { for (var i = 0; i < n; i++) parts.push({ x: rand(0, W), y: rand(-20, 0), vx: rand(-0.6, 0.6), vy: rand(0.6, 2), l: rand(80, 140), c: pick(CONFETTI), conf: 1 }); }
  function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function update() {
    frame++;
    stars.forEach(function (s) { s[2] += 0.05; });
    if (state === 'title') { scroll += 1; return; }
    if (state === 'over') { overT++; scroll += 0.3; parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.l--; }); parts = parts.filter(function (p) { return p.l > 0; }); return; }
    speed = Math.min(5.2, speed + 0.0009); scroll += speed; dist += speed;
    score = Math.floor(dist / 6) + (score % 1);
    P.vy += P.hold ? 0.32 : 0.42; P.y += P.vy;
    if (P.y >= GROUND - 23) { if (!P.ground) { for (var i = 0; i < 4; i++) parts.push({ x: P.x + rand(2, 28), y: GROUND - 1, vx: rand(-1, 1), vy: rand(-1, -0.2), l: 14, c: '#8C97A1' }); } P.y = GROUND - 23; P.vy = 0; P.ground = true; }
    nextObs -= speed;
    if (nextObs <= 0) {
      var tb = Math.random() < 0.35;
      obs.push({ x: W + 8, y: GROUND - (tb ? 9 : 11), w: tb ? 13 : 9, h: tb ? 9 : 11, s: tb ? tbox : cone });
      if (Math.random() < 0.18 && speed > 3.2) obs.push({ x: W + 22, y: GROUND - 11, w: 9, h: 11, s: cone });
      nextObs = rand(speed * 40 + 70, speed * 70 + 150);
    }
    nextItem -= speed;
    if (nextItem <= 0) { var cup = Math.random() < 0.65; items.push({ x: W + 8, y: GROUND - rand(40, 62), w: cup ? 9 : 7, h: cup ? 9 : 7, cup: cup, t: rand(0, 6) }); nextItem = rand(180, 320); }
    var pb = { x: P.x + 3, y: P.y + 6, w: 25, h: 15 };
    obs.forEach(function (o) { o.x -= speed; });
    obs = obs.filter(function (o) { return o.x > -20; });
    for (var k = 0; k < obs.length; k++) { var o = obs[k]; if (hit(pb, { x: o.x + 1, y: o.y + 2, w: o.w - 2, h: o.h - 2 })) { over(); return; } }
    items.forEach(function (it) { it.x -= speed; it.t += 0.15; });
    items = items.filter(function (it) {
      if (it.x < -12) return false;
      if (hit(pb, { x: it.x, y: it.y + Math.sin(it.t) * 2, w: it.w, h: it.h })) {
        var pts = it.cup ? 25 : 10; dist += pts * 6; Sound.coin(); popText('+' + pts, it.x, it.y, it.cup ? '#F48FA3' : '#FFC53D');
        for (var i = 0; i < 8; i++) parts.push({ x: it.x + 4, y: it.y + 4, vx: rand(-1.6, 1.6), vy: rand(-1.8, 0.4), l: 22, c: it.cup ? '#F48FA3' : '#FFC53D' });
        return false;
      }
      return true;
    });
    if (score >= nextLevel) { level++; nextLevel += 200; speed += 0.2; Sound.level(); popText('LEVEL UP!', W / 2 - 36, 44, '#FFC53D'); confetti(30); }
    if (frame % 3 === 0) parts.push({ x: P.x + 4, y: P.y + 18, vx: -speed * 0.4, vy: rand(-0.3, 0), l: 16, c: 'rgba(255,244,228,.7)', puff: 1 });
    parts.forEach(function (p) { p.x += p.vx; p.y += p.vy; if (!p.conf && !p.puff) p.vy += 0.08; p.l--; });
    parts = parts.filter(function (p) { return p.l > 0; });
    pops.forEach(function (p) { p.y -= 0.5; p.l--; }); pops = pops.filter(function (p) { return p.l > 0; });
    if (shake > 0) shake--;
  }
  function over() {
    state = 'over'; overT = 0; shake = 14; Sound.crash();
    if (score > hi) { hi = score; store.set('bday-hi', String(hi)); }
    for (var i = 0; i < 18; i++) parts.push({ x: P.x + 16, y: P.y + 12, vx: rand(-2.5, 2.5), vy: rand(-3, 0.5), l: 30, c: pick(['#F07A2C', '#FFC53D', '#C9D1D8']) });
    setTimeout(function () { if (state === 'over') { Sound.level(); confetti(60); } }, 900);
  }
  function text(t, x, y, size, color, align, shadow) {
    g.font = size + 'px "Press Start 2P", monospace'; g.textAlign = align || 'left'; g.textBaseline = 'top';
    if (shadow !== false) { g.fillStyle = '#24161A'; g.fillText(t, x + 1, y + 1); }
    g.fillStyle = color; g.fillText(t, x, y);
  }
  function drawBg() {
    var bands = ['#1A0F14', '#2A1420', '#46182A', '#6E1C2E', '#9C2131', '#C42A33', '#E0503A'];
    var bh = Math.ceil(GROUND / bands.length);
    bands.forEach(function (c, i) { g.fillStyle = c; g.fillRect(0, i * bh, W, bh + 1); });
    stars.forEach(function (s) { if (s[1] < 56) { g.fillStyle = Math.sin(s[2]) > 0.3 ? '#FFF4E4' : '#8E6A72'; g.fillRect(Math.floor(s[0]), Math.floor(s[1]), 1, 1); } });
    // pixel sun
    var sx = Math.round(W * 0.74), sy = GROUND - 26, sr = 22;
    for (var yy = -sr; yy <= 0; yy++) { var half = Math.floor(Math.sqrt(sr * sr - yy * yy)); var band = (yy > -12 && ((yy + 12) % 5 === 0 || (yy + 12) % 5 === 1)); if (!band) { g.fillStyle = yy < -14 ? '#FFF4E4' : '#FFC53D'; g.fillRect(sx - half, sy + yy, half * 2, 1); } }
    // mountains
    g.fillStyle = '#5A0C18';
    for (var x = 0; x < W; x++) { var wx = x + scroll * 0.15; var h = 24 + Math.sin(wx * 0.024) * 12 + Math.sin(wx * 0.06) * 6; g.fillRect(x, Math.floor(GROUND - 8 - h), 1, Math.ceil(h) + 8); }
    g.fillStyle = '#8E1426';
    for (x = 0; x < W; x++) { var wx2 = x + scroll * 0.4; var h2 = 10 + Math.sin(wx2 * 0.04) * 5 + Math.sin(wx2 * 0.1 + 1) * 3; g.fillRect(x, Math.floor(GROUND - h2), 1, Math.ceil(h2)); }
    // road
    g.fillStyle = '#24161A'; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = '#3E3539'; g.fillRect(0, GROUND, W, 2);
    g.fillStyle = '#FFC53D'; var off = Math.floor(scroll % 32); for (x = -off; x < W; x += 32) g.fillRect(x, GROUND + 12, 16, 2);
  }
  function ky(y) { return Math.round(y * H / 144); }
  function draw() {
    g.save();
    if (shake > 0) g.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
    drawBg();
    items.forEach(function (it) { var img = it.cup ? (Math.floor(frame / 8) % 2 ? cupA : cupB) : star; g.drawImage(img, Math.round(it.x), Math.round(it.y + Math.sin(it.t) * 2)); });
    obs.forEach(function (o) { g.drawImage(o.s, Math.round(o.x), Math.round(o.y)); });
    parts.forEach(function (p) { g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.conf ? 2 : (p.puff ? 2 : 1), p.conf ? 3 : (p.puff ? 2 : 1)); });
    var bob = state === 'play' && P.ground ? (Math.floor(frame / 4) % 2) : 0;
    var bk = (state === 'play' ? Math.floor(frame / 3) : Math.floor(frame / 10)) % 2 ? bikeA : bikeB;
    if (state === 'title') bob = Math.floor(frame / 16) % 2;
    if (state !== 'over' || Math.floor(overT / 4) % 2 === 0 || overT > 40) g.drawImage(bk, P.x, Math.round(P.y) - bob);
    g.restore();
    pops.forEach(function (p) { text(p.t, Math.round(p.x), Math.round(p.y), 8, p.c, 'left'); });
    text('SCORE ' + String(score).padStart(4, '0'), 6, 6, 8, '#FFF4E4');
    text('HI ' + String(hi).padStart(4, '0'), W - 6, 6, 8, '#FFC53D', 'right');
    if (state === 'play') { if (W < 230) text('LV' + level, 6, 17, 8, '#9ED8D2'); else text('LV' + level, W / 2, 6, 8, '#9ED8D2', 'center'); }
    if (state === 'title') {
      g.fillStyle = 'rgba(26,15,20,.55)'; g.fillRect(0, ky(28), W, ky(64));
      text('BIRTHDAY RUN', W / 2, ky(36), 16, '#FFC53D', 'center');
      if (Math.floor(frame / 30) % 2 === 0) text('PRESS START', W / 2, ky(60), 8, '#FFF4E4', 'center');
      text('TAP / SPACE = JUMP', W / 2, ky(76), 8, '#9ED8D2', 'center');
    }
    if (state === 'over') {
      g.fillStyle = 'rgba(26,15,20,.62)'; g.fillRect(0, ky(22), W, ky(92));
      if (overT < 50) text('GAME OVER?', W / 2, ky(56), 16, '#FFF4E4', 'center');
      else {
        text('NOPE! YOU', W / 2, ky(28), 8, '#9ED8D2', 'center');
        text('LEVELED UP!', W / 2, ky(41), 16, '#FFC53D', 'center');
        text('HAPPY 64TH, CHRIS!', W / 2, ky(64), 8, '#F48FA3', 'center');
        text('SCORE ' + score + (score >= hi && score > 0 ? ' NEW BEST!' : ''), W / 2, ky(80), 8, '#FFF4E4', 'center');
        if (Math.floor(frame / 30) % 2 === 0) text('PRESS START', W / 2, ky(98), 8, '#FFF4E4', 'center');
      }
    }
  }
  function loop(ts) {
    raf = 0;
    if (!lastTs) lastTs = ts;
    acc += Math.min(100, ts - lastTs); lastTs = ts;
    var steps = 0;
    while (acc >= 16.667 && steps < 5) { update(); acc -= 16.667; steps++; }
    draw();
    if (visible) raf = requestAnimationFrame(loop); else lastTs = 0;
  }
  function kick() { if (!raf && visible) { lastTs = 0; raf = requestAnimationFrame(loop); } }
  onVisible(cv, function (vis) { visible = vis; if (vis) kick(); }, 0.05);
  addEventListener('resize', function () { if (state !== 'play') { pickRes(); draw(); } });
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('8px "Press Start 2P"') : Promise.resolve();
  fontReady.then(function () { draw(); }, function () { draw(); });

  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.focus({ preventScroll: true }); jump(); });
  cv.addEventListener('pointerup', release); cv.addEventListener('pointerleave', release); cv.addEventListener('pointercancel', release);
  cv.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'w') { e.preventDefault(); if (!e.repeat) jump(); }
  });
  cv.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') release(); });
  $('#startBtn').addEventListener('click', function () { if (state === 'over' && overT < 50) overT = 50; reset(); Sound.unlock(); Sound.level(); cv.focus({ preventScroll: true }); kick(); });
  var jb = $('#jumpBtn');
  jb.addEventListener('pointerdown', function (e) { e.preventDefault(); jb.classList.add('held'); jump(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { jb.addEventListener(ev, function () { jb.classList.remove('held'); release(); }); });
  jb.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); jump(); } });
  jb.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') release(); });
})();

/* =========================================================
   RIDE ON: parallax road trip
   ========================================================= */
(function ride() {
  var scene = $('#rideScene'); if (!scene) return;
  var layers = $$('[data-speed]', scene).map(function (el) { return { el: el, k: +el.dataset.speed, w: +el.dataset.wrap, x: 0 }; });
  var wheels = $$('.ride-wheel', scene), bob = $('.bike-bob', scene), balloon = $('.ride-balloon', scene), lines = $('.speed-lines', scene), puffG = $('.puffs', scene), beam = $('.beam', scene);
  var vroom = $('#vroom'), honk = $('#honkBubble');
  var speed = reduce ? 0 : 1, target = reduce ? 0 : 1, base = reduce ? 0 : 1, last = 0, visible = false, raf = 0, ang = 0, t = 0, puffT = 0, puffs = [];
  var NS = 'http://www.w3.org/2000/svg';
  function spawnPuff() {
    var c = document.createElementNS(NS, 'circle'); c.setAttribute('fill', '#FFF4E4'); puffG.appendChild(c);
    puffs.push({ el: c, x: 422, y: 434 + rand(-3, 3), r: rand(5, 8), life: 0 });
    if (puffs.length > 24) { var old = puffs.shift(); old.el.remove(); }
  }
  function frame(ts) {
    raf = 0; var dt = last ? Math.min(3, (ts - last) / 16.667) : 1; last = ts; t += dt;
    speed += (target - speed) * 0.05 * dt;
    layers.forEach(function (L) { L.x = (L.x - L.k * speed * 2.4 * dt) % L.w; L.el.setAttribute('transform', 'translate(' + L.x.toFixed(1) + ' 0)'); });
    ang = (ang + speed * 10 * dt) % 360;
    wheels.forEach(function (w) { w.setAttribute('transform', 'rotate(' + ang.toFixed(1) + ' ' + w.dataset.cx + ' ' + w.dataset.cy + ')'); });
    bob.setAttribute('transform', 'translate(0 ' + (Math.sin(t * (0.3 + speed * 0.1)) * (0.8 + speed * 0.7)).toFixed(2) + ')');
    balloon.setAttribute('transform', 'rotate(' + (-6 - speed * 8 + Math.sin(t * 0.07) * 6).toFixed(1) + ' 96 58)');
    lines.setAttribute('opacity', Math.max(0, Math.min(1, (speed - 0.7) / 1.8)).toFixed(2));
    beam.setAttribute('opacity', (0.42 + Math.sin(t * 0.3) * 0.05 + Math.max(0, speed - 1) * 0.08).toFixed(2));
    puffT -= dt * (0.5 + speed * 0.6); if (puffT <= 0 && speed > 0.15) { spawnPuff(); puffT = 9; }
    puffs.forEach(function (p) { p.life += dt; p.x -= (1.2 + speed * 2.6) * dt; p.y -= 0.25 * dt; var k = p.life / 50; p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1)); p.el.setAttribute('r', (p.r * (1 + k * 1.6)).toFixed(1)); p.el.setAttribute('opacity', Math.max(0, 0.85 - k).toFixed(2)); });
    puffs = puffs.filter(function (p) { if (p.life > 50) { p.el.remove(); return false; } return true; });
    Sound.engineSet(speed);
    if (visible || Math.abs(target - speed) > 0.02) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  onVisible(scene, function (vis) { visible = vis; if (vis) kick(); }, 0.05);
  var rev = $('#revBtn'), revving = false;
  function revOn(e) {
    if (e) e.preventDefault(); if (revving) return; revving = true;
    target = 3.6; scene.classList.add('revving'); vroom.classList.add('show'); rev.classList.add('held');
    Sound.unlock(); Sound.engineStart(); kick();
  }
  function revOff() {
    if (!revving) return; revving = false;
    target = base || 0; scene.classList.remove('revving'); vroom.classList.remove('show'); rev.classList.remove('held');
    Sound.engineStop(); kick();
  }
  rev.addEventListener('pointerdown', revOn);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { rev.addEventListener(ev, revOff); });
  rev.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) revOn(e); });
  rev.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') revOff(); });
  rev.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  rev.addEventListener('click', function (e) { e.preventDefault(); });
  $('#honkBtn').addEventListener('click', function () {
    Sound.beep(); restart(honk, 'show');
    beam.setAttribute('opacity', '1'); setTimeout(function () { beam.setAttribute('opacity', '.5'); }, 160);
  });
})();

/* =========================================================
   FINALE: stars, fireworks, candles, birthday song
   ========================================================= */
(function stars() {
  var box = $('#stars'); if (!box) return; var html = '';
  for (var L = 0; L < 3; L++) {
    var dots = [];
    for (var i = 0; i < 26; i++) { var r = Math.random() < 0.2 ? 2.2 : 1.4; dots.push('radial-gradient(circle at ' + rand(0, 100).toFixed(1) + '% ' + rand(0, 86).toFixed(1) + '%, #FFF4E4 ' + r + 'px, rgba(255,244,228,0) ' + (r + 1.2).toFixed(1) + 'px)'); }
    html += '<i class="star-layer" style="background-image:' + dots.join(',') + ';animation-duration:' + (2.6 + L * 0.9).toFixed(1) + 's;animation-delay:-' + (L * 0.9).toFixed(1) + 's"></i>';
  }
  box.innerHTML = html;
})();

var Fireworks = (function () {
  var cv = $('#fireworks'); if (!cv) return { launch: function () {}, barrage: function () {} };
  var ctx = cv.getContext('2d'), W = 0, H = 0, rockets = [], sparks = [], raf = 0, visible = false, autoTimer = 0;
  function resize() { var r = cv.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } }
  var sets = [['#FFC53D', '#FFF4E4'], ['#CE2836', '#F48FA3'], ['#138A8A', '#9ED8D2'], ['#F07A2C', '#FFC53D'], ['#FFF4E4', '#9ED8D2']];
  function launch(loud) {
    if (!W) resize(); if (!W || !H) return;
    rockets.push({ x: rand(W * 0.12, W * 0.88), y: H + 10, vx: rand(-0.8, 0.8), vy: -rand(Math.sqrt(H) * 0.42, Math.sqrt(H) * 0.52), cols: pick(sets), loud: loud });
    kick();
  }
  function explode(r) {
    var n = reduce ? 20 : 48, sp = rand(2.6, 4.4), ring = Math.random() < 0.35;
    if (sparks.length > 520) sparks.splice(0, sparks.length - 520);
    for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI * 2, v = ring ? sp : sp * rand(0.3, 1); sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rand(48, 72), c: r.cols[i % 2] }); }
    if (r.loud) Sound.boom();
  }
  function tick() {
    raf = 0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = '#FFE8B0';
    rockets = rockets.filter(function (r) {
      r.x += r.vx; r.y += r.vy; r.vy += 0.09;
      ctx.beginPath(); ctx.moveTo(r.x - r.vx * 3, r.y - r.vy * 3); ctx.lineTo(r.x, r.y); ctx.stroke();
      if (r.vy >= -0.6) { explode(r); return false; } return true;
    });
    ctx.lineWidth = 2.6;
    sparks = sparks.filter(function (s) {
      s.life++; s.vx *= 0.97; s.vy = s.vy * 0.97 + 0.045; s.x += s.vx; s.y += s.vy;
      ctx.globalAlpha = Math.max(0, 1 - s.life / s.max); ctx.strokeStyle = s.c;
      ctx.beginPath(); ctx.moveTo(s.x - s.vx * 2.5, s.y - s.vy * 2.5); ctx.lineTo(s.x, s.y); ctx.stroke();
      return s.life < s.max;
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (rockets.length || sparks.length) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function scheduleAuto() {
    clearTimeout(autoTimer); if (!visible || reduce) return;
    autoTimer = setTimeout(function () { if (visible && !document.hidden) launch(false); scheduleAuto(); }, rand(1500, 2800));
  }
  onVisible(cv.parentNode, function (vis) { visible = vis; if (vis) { resize(); scheduleAuto(); } else clearTimeout(autoTimer); }, 0.1);
  addEventListener('resize', function () { if (visible) resize(); });
  return { launch: launch, barrage: function (n) { for (var i = 0; i < n; i++) setTimeout(function () { launch(true); }, i * 280); } };
})();

var Song = (function () {
  var MEL = [[67, .75], [67, .25], [69, 1], [67, 1], [72, 1], [71, 2], [67, .75], [67, .25], [69, 1], [67, 1], [74, 1], [72, 2], [67, .75], [67, .25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2], [77, .75], [77, .25], [76, 1], [72, 1], [74, 1], [72, 3]];
  var BASS = [[1, 48], [4, 43], [7, 43], [10, 48], [13, 48], [16, 41], [19, 48], [22, 43], [25, 48]];
  var playing = false;
  function play(onNote, onEnd) {
    if (playing) return 0; playing = true; Sound.unlock();
    var beat = 0.36, t = 0;
    MEL.forEach(function (m) {
      (function (n, d, at) {
        Sound.tone(Sound.N(n), d * beat * 0.92, { vol: 0.09, delay: at, type: 'square' });
        Sound.tone(Sound.N(n + 12), d * beat * 0.5, { vol: 0.025, delay: at, type: 'triangle' });
        setTimeout(function () { if (onNote) onNote(n); }, at * 1000);
      })(m[0], m[1], t);
      t += m[1] * beat;
    });
    BASS.forEach(function (b) { Sound.tone(Sound.N(b[1]), beat * 2.4, { vol: 0.08, delay: b[0] * beat, type: 'triangle' }); Sound.tone(Sound.N(b[1] + 7), beat * 0.4, { vol: 0.03, delay: (b[0] + 1) * beat, type: 'triangle' }); Sound.tone(Sound.N(b[1] + 7), beat * 0.4, { vol: 0.03, delay: (b[0] + 2) * beat, type: 'triangle' }); });
    setTimeout(function () { playing = false; if (onEnd) onEnd(); }, t * 1000 + 300);
    return t;
  }
  return { play: play, get playing() { return playing; } };
})();

(function cake() {
  var wrap = $('#cakeWrap'); if (!wrap) return;
  var btns = $$('.candle-btn', wrap), flames = $$('.flame-wrap', wrap), msg = $('#wishMsg'), relight = $('#relightBtn'), blowAll = $('#blowBtn'), songBtn = $('#songBtn');
  var labels = ['6', '4'], out = 0;
  function blow(i) {
    var f = flames[i]; if (!f || f.classList.contains('out')) return;
    f.classList.add('out'); btns[i].setAttribute('aria-label', 'The ' + labels[i] + ' candle is out');
    Sound.puff(); out++;
    if (out === flames.length) wish();
  }
  function wish() {
    msg.textContent = 'Wish granted!'; msg.classList.add('show');
    Fireworks.barrage(7);
    var r = wrap.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height * 0.25, 100, { min: 5, max: 14, up: 4 });
    setTimeout(function () { FX.rain(4); }, 400);
    relight.hidden = false; blowAll.hidden = true;
    setTimeout(function () { playSong(); }, 900);
  }
  function relightAll() {
    flames.forEach(function (f, i) { f.classList.remove('out'); btns[i].setAttribute('aria-label', 'Blow out the ' + labels[i] + ' candle'); });
    out = 0; msg.classList.remove('show'); setTimeout(function () { if (!out) msg.textContent = ''; }, 400);
    relight.hidden = true; blowAll.hidden = false; Sound.fixed();
  }
  btns.forEach(function (b) { b.addEventListener('click', function () { blow(+b.dataset.c); }); });
  blowAll.addEventListener('click', function () { flames.forEach(function (_, i) { setTimeout(function () { blow(i); }, i * 180); }); });
  relight.addEventListener('click', relightAll);
  function floatNote() {
    var n = document.createElement('span'); n.className = 'note-float'; n.textContent = pick(['♪', '♫', '♪', '♬']);
    n.style.left = rand(15, 80).toFixed(0) + '%'; n.style.top = rand(5, 35).toFixed(0) + '%';
    n.style.setProperty('--dx', rand(-60, 60).toFixed(0) + 'px'); n.style.setProperty('--rot', rand(-40, 40).toFixed(0) + 'deg');
    n.style.color = pick(['#FFC53D', '#9ED8D2', '#F48FA3', '#FFF4E4']);
    wrap.appendChild(n); setTimeout(function () { n.remove(); }, 2300);
  }
  function playSong() {
    if (Song.playing) return;
    songBtn.disabled = true; songBtn.classList.add('held');
    Song.play(function () { floatNote(); }, function () { songBtn.disabled = false; songBtn.classList.remove('held'); Fireworks.barrage(3); });
  }
  songBtn.addEventListener('click', playSong);
  $('#replayBtn').addEventListener('click', function () {
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
    if (intro && giftBtn) setTimeout(showIntro, 30);
  });
})();

})();

