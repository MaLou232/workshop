(function () {
  'use strict';

  // =====================================================
  // CONSTANTS
  // =====================================================

  const CIRCUMFERENCE = 2 * Math.PI * 54; // ~339.292

  const QUOTES = [
    'Maus denkt an dich, Schneck! Du schaffst das!',
    'Du kannst das schaffen, Schneck! Maus glaubt an dich!',
    'Maus sagt: Noch ein bisschen, Schneck – du rockst das!',
    'Dein Fokus ist beeindruckend, Schneck! 🌟',
    'Maus schickt dir ganz viel Liebe, Schneck!',
    'Schneck, du bist ein Held! Maus ist so stolz!',
    'Fast geschafft, Schneck! Maus feuert dich an!',
    'Du bist unaufhaltsam, Schneck! So sagt\'s Maus!',
    'Maus flüstert: Du bist der beste Schneck der Welt!',
    'Konzentriert wie ein Laser, Schneck! Maus ist begeistert!',
    'Maus weiß: Du hast das drauf, Schneck!',
    'Schneck, du machst das fantastisch! Maus applaudiert!',
    'Ein Schritt nach dem anderen, Schneck. Maus ist bei dir!',
    'Maus sagt: Dein Fokus heute ist phänomenal, Schneck!',
    'Schneck im Flow-Modus! Maus jubelt laut!',
    'Maus schickt dir Energiewellen, Schneck. Fühlst du sie?',
    'Du bist der Schneck des Tages! Maus ist verliebt!',
    'Maus sagt: Weiter so, Schneck – du bist eine Inspiration!',
    'Schneck, du rockst die Fokuszeit! Maus ist hin und weg!',
    'Maus denkt: Schneck ist heute nicht aufzuhalten!',
  ];

  const BADGE_DEFS = [
    { id: 'first',  emoji: '🌱', name: 'Sprössling',    desc: '1. Session',      condition: s => s.completedSessions >= 1  },
    { id: 'five',   emoji: '🌿', name: 'Setzling',      desc: '5 Sessionen',     condition: s => s.completedSessions >= 5  },
    { id: 'ten',    emoji: '💚', name: 'Maus-Liebling', desc: '10 Sessionen',    condition: s => s.completedSessions >= 10 },
    { id: 'level3', emoji: '⭐', name: 'Aufsteiger',    desc: 'Level 3',         condition: s => s.level >= 3              },
    { id: 'level5', emoji: '🌟', name: 'Fokus-Meister', desc: 'Level 5',         condition: s => s.level >= 5              },
    { id: 'xp500',  emoji: '🏆', name: 'XP-Sammler',   desc: '500 XP',          condition: s => s.xp >= 500               },
  ];

  const LEVEL_XP     = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 99999];
  const LEVEL_TITLES = ['Sämling','Sprössling','Setzling','Baum','Eiche','Urwald','Legende','Maus-Champion'];

  // =====================================================
  // STATE
  // =====================================================

  let timer = {
    totalSeconds: 25 * 60,
    remaining:    25 * 60,
    isRunning:    false,
    isPaused:     false,
    intervalId:   null,
    puffinShown:  false,
    lastTenth:    -1,   // for rustle sound every 10%
  };

  let player = {
    xp: 0, level: 1, badges: [],
    completedSessions: 0, quotesSeenCount: 0,
  };

  let shuffledQuotes = [], quoteIdx = 0;
  let puffinTimeouts = [];

  // Tree: branch lengths are measured after DOM ready
  let branchLengths = {};

  // =====================================================
  // DOM
  // =====================================================

  const $ = id => document.getElementById(id);
  const el = {
    minutesInput:   $('input-minutes'),
    secondsInput:   $('input-seconds'),
    inputGroup:     $('input-group'),
    ringWrap:       $('ring-wrap'),
    startBtn:       $('start-btn'),
    pauseBtn:       $('pause-btn'),
    resetBtn:       $('reset-btn'),
    testSoundBtn:   $('test-sound-btn'),
    countdown:      $('countdown-display'),
    ring:           $('progress-ring'),
    puffin:         $('puffin-container'),
    bubble:         $('speech-bubble'),
    quoteText:      $('quote-text'),
    kiss:           $('kiss-heart'),
    logList:        $('quote-log-list'),
    levelNum:       $('level-number'),
    levelTitle:     $('level-title'),
    xpDisplay:      $('xp-display'),
    xpFill:         $('xp-bar-fill'),
    badgesGrid:     $('badges-grid'),
    sessionsDisp:   $('sessions-display'),
    levelBanner:    $('level-up-banner'),
    levelBannerTxt: $('level-up-text'),
    badgePopup:     $('badge-popup'),
    badgeEmoji:     $('badge-popup-emoji'),
    badgeText:      $('badge-popup-text'),
    canvas:         $('confetti-canvas'),
  };

  // =====================================================
  // AUDIO  (Web Audio API – no external files)
  // =====================================================

  function mkCtx() {
    return new (window.AudioContext || window.webkitAudioContext)();
  }

  // Bell chime: timer end
  function playPing() {
    try {
      const ac = mkCtx(), now = ac.currentTime;
      [[528, 0.5, 2.6], [1056, 0.22, 2.1]].forEach(([freq, vol, dur]) => {
        const osc  = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain); gain.connect(ac.destination);
        osc.start(now); osc.stop(now + dur);
      });
    } catch (e) {}
  }

  // Leaf rustle: multiple short bursts of bandpass noise ~2-4 kHz
  function playRustle() {
    try {
      const ac = mkCtx(), now = ac.currentTime;
      const burstCount = 6;
      for (let i = 0; i < burstCount; i++) {
        const t   = now + i * 0.055;
        const len = Math.floor(ac.sampleRate * 0.11);
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d   = buf.getChannelData(0);
        for (let j = 0; j < len; j++) {
          // shape: ramp-up then ramp-down
          const env = Math.min(j / 400, 1) * (1 - j / len);
          d[j] = (Math.random() * 2 - 1) * env;
        }
        const src  = ac.createBufferSource();
        src.buffer = buf;
        // Two bandpass filters for richer leaf texture
        const bp1 = ac.createBiquadFilter();
        bp1.type = 'bandpass';
        bp1.frequency.value = 2800 + Math.random() * 1200;
        bp1.Q.value = 0.8;
        const bp2 = ac.createBiquadFilter();
        bp2.type = 'bandpass';
        bp2.frequency.value = 1800 + Math.random() * 800;
        bp2.Q.value = 1.2;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        src.connect(bp1); bp1.connect(bp2); bp2.connect(gain); gain.connect(ac.destination);
        src.start(t);
      }
    } catch (e) {}
  }

  // Earth crack: seed sprouting
  function playCrack() {
    try {
      const ac = mkCtx(), now = ac.currentTime;
      const len = Math.floor(ac.sampleRate * 0.28);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src    = ac.createBufferSource();
      src.buffer   = buf;
      const filter = ac.createBiquadFilter();
      filter.type  = 'bandpass';
      filter.frequency.value = 650; filter.Q.value = 0.5;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
      src.start(now);
    } catch (e) {}
  }

  // Wood creak
  function playCreak() {
    try {
      const ac = mkCtx(), now = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.linearRampToValueAtTime(72, now + 0.9);
      const lfo  = ac.createOscillator(); lfo.frequency.value = 7;
      const lfoG = ac.createGain();       lfoG.gain.value = 22;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      const filt = ac.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 400;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(filt); filt.connect(gain); gain.connect(ac.destination);
      lfo.start(now); osc.start(now);
      lfo.stop(now + 1.1); osc.stop(now + 1.1);
    } catch (e) {}
  }

  // Wing flutter for puffin arrival
  function playFlap() {
    try {
      const ac = mkCtx(), now = ac.currentTime;
      for (let i = 0; i < 8; i++) {
        const t   = now + i * 0.08;
        const len = Math.floor(ac.sampleRate * 0.04);
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const d   = buf.getChannelData(0);
        for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
        const src  = ac.createBufferSource(); src.buffer = buf;
        const filt = ac.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = 1200 + Math.random() * 900; filt.Q.value = 1.2;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
        src.connect(filt); filt.connect(gain); gain.connect(ac.destination);
        src.start(t);
      }
    } catch (e) {}
  }

  // =====================================================
  // TIMER
  // =====================================================

  function getInputSecs() {
    const mm = Math.max(0, parseInt(el.minutesInput.value) || 0);
    const ss = Math.min(59, Math.max(0, parseInt(el.secondsInput.value) || 0));
    return mm * 60 + ss;
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function startTimer() {
    const total = getInputSecs();
    if (total <= 0) return;

    if (!timer.isPaused) {
      timer.totalSeconds = total;
      timer.remaining    = total;
      timer.puffinShown  = false;
      timer.lastTenth    = -1;
    }

    timer.isRunning = true;
    timer.isPaused  = false;

    // Swap input for ring
    el.inputGroup.style.display  = 'none';
    el.ringWrap.classList.remove('hidden');

    el.startBtn.disabled     = true;
    el.pauseBtn.disabled     = false;
    el.minutesInput.disabled = true;
    el.secondsInput.disabled = true;

    updateRingUI();
    timer.intervalId = setInterval(tick, 1000);
  }

  function pauseTimer() {
    clearInterval(timer.intervalId);
    timer.isRunning = false;
    timer.isPaused  = true;
    el.startBtn.disabled    = false;
    el.startBtn.textContent = 'Weiter';
    el.pauseBtn.disabled    = true;
  }

  function resetTimer() {
    clearInterval(timer.intervalId);
    clearPuffinTimeouts();
    hidePuffin();

    timer.isRunning   = false;
    timer.isPaused    = false;
    timer.puffinShown = false;
    timer.lastTenth   = -1;
    timer.remaining   = getInputSecs();

    // Swap ring back to input
    el.ringWrap.classList.add('hidden');
    el.inputGroup.style.display = '';

    el.startBtn.disabled     = false;
    el.startBtn.textContent  = 'Start';
    el.pauseBtn.disabled     = true;
    el.minutesInput.disabled = false;
    el.secondsInput.disabled = false;

    el.ring.style.strokeDashoffset = 0;
    el.ring.style.stroke           = 'var(--blue)';
    el.countdown.textContent       = fmt(timer.remaining);

    // Reset tree to bare
    updateTree(0);
  }

  function tick() {
    timer.remaining--;

    if (timer.remaining <= 0) {
      timer.remaining = 0;
      clearInterval(timer.intervalId);
      updateRingUI();
      updateTree(1);
      onComplete();
      return;
    }

    updateRingUI();

    const elapsed  = timer.totalSeconds - timer.remaining;
    const progress = elapsed / timer.totalSeconds;

    // Continuous tree growth
    updateTree(progress);

    // XP every 5 minutes
    if (elapsed > 0 && elapsed % 300 === 0) awardXP(5);

    // Leaf rustle sound every 10% of progress
    const tenths = Math.floor(progress * 10);
    if (tenths > timer.lastTenth) {
      timer.lastTenth = tenths;
      if (tenths > 0) playRustle();
    }

    // Puffin at 75%
    if (!timer.puffinShown && progress >= 0.75) {
      timer.puffinShown = true;
      showPuffin();
    }

    // Ring colour: blue → yellow → green
    if (progress > 0.75)     el.ring.style.stroke = 'var(--green)';
    else if (progress > 0.5) el.ring.style.stroke = 'var(--yellow-dark)';
    else                      el.ring.style.stroke = 'var(--blue)';
  }

  function updateRingUI() {
    el.countdown.textContent = fmt(timer.remaining);
    const progress = (timer.totalSeconds - timer.remaining) / timer.totalSeconds;
    el.ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  }

  function onComplete() {
    timer.isRunning = false;

    // Swap ring back to input
    el.ringWrap.classList.add('hidden');
    el.inputGroup.style.display = '';

    playPing();
    launchConfetti();
    awardXP(50);
    player.completedSessions++;
    checkBadges();
    savePlayer();
    renderBadges();
    el.sessionsDisp.textContent = player.completedSessions;

    el.startBtn.disabled     = false;
    el.startBtn.textContent  = 'Neue Session';
    el.pauseBtn.disabled     = true;
    el.minutesInput.disabled = false;
    el.secondsInput.disabled = false;

    timer.isPaused    = false;
    timer.puffinShown = false;
  }

  // =====================================================
  // TREE  (continuous growth via stroke-dashoffset)
  // =====================================================

  function initTree() {
    document.querySelectorAll('.branch').forEach(path => {
      const len = path.getTotalLength ? path.getTotalLength() : 100;
      path.dataset.len = len;
      path.style.strokeDasharray  = len;
      path.style.strokeDashoffset = len; // fully hidden
    });
    // Leaves start invisible (set via CSS opacity:0)
  }

  let lastCrackPlayed = false;
  let lastCreakPlayed = false;

  function updateTree(progress) {
    // Branches: each has data-start and data-end
    document.querySelectorAll('.branch').forEach(path => {
      const start  = parseFloat(path.dataset.start || 0);
      const end    = parseFloat(path.dataset.end   || 1);
      const reveal = Math.max(0, Math.min(1, (progress - start) / (end - start)));
      const len    = parseFloat(path.dataset.len || 100);
      path.style.strokeDashoffset = len * (1 - reveal);
    });

    // Leaves: each has data-min (fade in over 8% window)
    document.querySelectorAll('.leaf').forEach(leaf => {
      const min    = parseFloat(leaf.dataset.min || 0);
      const reveal = Math.max(0, Math.min(1, (progress - min) / 0.09));
      leaf.style.opacity = reveal;
    });

    // One-shot sounds at growth milestones
    if (!lastCrackPlayed && progress >= 0.10) { lastCrackPlayed = true; playCrack(); }
    if (!lastCreakPlayed && progress >= 0.25) { lastCreakPlayed = true; playCreak(); }
  }

  // =====================================================
  // PUFFIN  (appears on branch, stays 15 s)
  // =====================================================

  function clearPuffinTimeouts() {
    puffinTimeouts.forEach(clearTimeout);
    puffinTimeouts = [];
  }

  function showPuffin() {
    clearPuffinTimeouts();
    playFlap();

    const p = el.puffin;
    p.classList.remove('hidden');
    // Trigger fade-in on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => p.classList.add('visible'));
    });

    // Show quote when settled (after 0.8 s)
    puffinTimeouts.push(setTimeout(showQuote, 800));

    // Send kiss at 13 s
    puffinTimeouts.push(setTimeout(sendKiss, 13000));

    // Fly away at 15 s (hide with fade-out)
    puffinTimeouts.push(setTimeout(hidePuffin, 15000));
  }

  function hidePuffin() {
    clearPuffinTimeouts();
    el.bubble.classList.add('hidden');
    el.kiss.classList.remove('flying');
    el.kiss.classList.add('hidden');

    const p = el.puffin;
    p.classList.remove('visible');
    // After fade-out transition, fully hide
    setTimeout(() => p.classList.add('hidden'), 700);
  }

  function sendKiss() {
    const h = el.kiss;
    h.classList.remove('hidden', 'flying');
    void h.offsetWidth; // reflow to restart animation
    h.classList.add('flying');
    setTimeout(() => { h.classList.add('hidden'); h.classList.remove('flying'); }, 2400);
  }

  // =====================================================
  // QUOTES
  // =====================================================

  function shuffleQuotes() {
    shuffledQuotes = [...QUOTES].sort(() => Math.random() - 0.5);
    quoteIdx = 0;
  }

  function showQuote() {
    if (quoteIdx >= shuffledQuotes.length) shuffleQuotes();
    const quote = shuffledQuotes[quoteIdx++];
    el.quoteText.textContent = quote;
    el.bubble.classList.remove('hidden');
    addToLog(quote);
    awardXP(10);
    player.quotesSeenCount++;
    checkBadges();
    savePlayer();
  }

  function addToLog(quote) {
    const empty = el.logList.querySelector('.empty-log');
    if (empty) empty.remove();
    const now  = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const div  = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<p>${quote}</p><span class="log-time">${time} Uhr</span>`;
    el.logList.prepend(div);
  }

  // =====================================================
  // GAMIFICATION
  // =====================================================

  function awardXP(amount) {
    player.xp += amount;
    checkLevelUp();
    savePlayer();
    renderXPBar();
  }

  function checkLevelUp() {
    while (player.level < LEVEL_XP.length - 1 && player.xp >= LEVEL_XP[player.level]) {
      player.level++;
      showLevelUpBanner(player.level);
    }
    el.levelNum.textContent   = player.level;
    el.levelTitle.textContent = LEVEL_TITLES[Math.min(player.level - 1, LEVEL_TITLES.length - 1)];
  }

  function showLevelUpBanner(level) {
    const b = el.levelBanner;
    b.classList.remove('hidden');
    el.levelBannerTxt.textContent = `Level ${level} – ${LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]}!`;
    setTimeout(() => b.classList.add('show'), 10);
    setTimeout(() => {
      b.classList.remove('show');
      setTimeout(() => b.classList.add('hidden'), 500);
    }, 3200);
  }

  function checkBadges() {
    BADGE_DEFS.forEach(def => {
      if (!player.badges.includes(def.id) && def.condition(player)) {
        player.badges.push(def.id);
        showBadgePopup(def);
        renderBadges();
      }
    });
  }

  function showBadgePopup(def) {
    const p = el.badgePopup;
    p.classList.remove('hidden');
    el.badgeEmoji.textContent = def.emoji;
    el.badgeText.textContent  = def.name;
    setTimeout(() => p.classList.add('show'), 10);
    setTimeout(() => { p.classList.remove('show'); setTimeout(() => p.classList.add('hidden'), 500); }, 4000);
  }

  function renderXPBar() {
    const lvl   = Math.min(player.level - 1, LEVEL_XP.length - 1);
    const next  = Math.min(player.level, LEVEL_XP.length - 1);
    const start = LEVEL_XP[lvl], end = LEVEL_XP[next];
    const pct   = end > start ? ((player.xp - start) / (end - start)) * 100 : 100;
    el.xpFill.style.width    = Math.min(pct, 100) + '%';
    el.xpDisplay.textContent = `${player.xp} / ${end}`;
  }

  function renderBadges() {
    el.badgesGrid.innerHTML = '';
    BADGE_DEFS.forEach(def => {
      const unlocked = player.badges.includes(def.id);
      const d = document.createElement('div');
      d.className = `badge-item ${unlocked ? 'unlocked' : 'locked'}`;
      d.title     = def.desc;
      d.innerHTML = `<span class="badge-emoji">${def.emoji}</span><span class="badge-name">${def.name}</span>`;
      el.badgesGrid.appendChild(d);
    });
  }

  // =====================================================
  // LOCALSTORAGE
  // =====================================================

  function savePlayer() {
    try { localStorage.setItem('schneck_v1', JSON.stringify(player)); } catch (e) {}
  }

  function loadPlayer() {
    try {
      const raw = localStorage.getItem('schneck_v1');
      if (raw) Object.assign(player, JSON.parse(raw));
    } catch (e) {}
  }

  // =====================================================
  // CONFETTI
  // =====================================================

  function launchConfetti() {
    const canvas = el.canvas;
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#7ab87a','#7aaed6','#e8d87a','#f0a8c4','#9ed88e','#b0d0ec'];
    const parts  = Array.from({ length: 110 }, () => ({
      x: Math.random() * canvas.width, y: -15,
      w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
      vx: (Math.random() - 0.5) * 4.5, vy: Math.random() * 3.2 + 2,
      rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.18,
      color: colors[Math.floor(Math.random() * colors.length)], opacity: 1,
    }));
    const t0 = Date.now();
    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - t0;
      let alive = false;
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += p.rotV;
        if (elapsed > 2200) p.opacity = Math.max(0, p.opacity - 0.012);
        if (p.opacity > 0) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  }

  // =====================================================
  // INIT
  // =====================================================

  function init() {
    loadPlayer();
    shuffleQuotes();
    initTree();

    // Ring setup
    el.ring.style.strokeDasharray  = CIRCUMFERENCE;
    el.ring.style.strokeDashoffset = 0;
    el.countdown.textContent       = fmt(getInputSecs());

    // Reset milestone flags
    lastCrackPlayed = false;
    lastCreakPlayed = false;

    checkLevelUp();
    renderXPBar();
    renderBadges();
    el.sessionsDisp.textContent = player.completedSessions;

    // Button listeners
    el.startBtn.addEventListener('click', startTimer);
    el.pauseBtn.addEventListener('click', pauseTimer);
    el.resetBtn.addEventListener('click', resetTimer);
    el.testSoundBtn.addEventListener('click', playPing);

    // Live countdown preview
    el.minutesInput.addEventListener('input', () => {
      if (!timer.isRunning) el.countdown.textContent = fmt(getInputSecs());
    });
    el.secondsInput.addEventListener('input', () => {
      if (!timer.isRunning) el.countdown.textContent = fmt(getInputSecs());
    });
    el.secondsInput.addEventListener('change', () => {
      const v = parseInt(el.secondsInput.value);
      if (isNaN(v) || v < 0) el.secondsInput.value = 0;
      if (v > 59)            el.secondsInput.value = 59;
      if (!timer.isRunning)  el.countdown.textContent = fmt(getInputSecs());
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
