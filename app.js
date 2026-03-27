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

  const BREAK_QUOTES = [
    'Streck dich kurz, Schneck – Maus macht das auch! 🌿',
    'Tief durchatmen! Maus schickt dir Ruhewellen. ☁️',
    'Schau kurz aus dem Fenster, Schneck. Die Welt dreht sich weiter!',
    'Kurze Denkpause einlegen – das Gehirn dankt es dir, Schneck!',
    'Maus sagt: Hände schütteln, Schultern lockern – du machst das super!',
    'Trink einen Schluck Wasser, Schneck. Maus sorgt sich um dich! 💧',
    'Diese 5 Minuten gehören dir, Schneck. Genieß die Stille!',
    'Maus flüstert: Augen schließen und kurz träumen, Schneck. ✨',
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
    totalSeconds:  25 * 60,
    remaining:     25 * 60,
    isRunning:     false,
    isPaused:      false,
    intervalId:    null,
    puffinShown:   false,   // used for short timers (< 25 min)
    puffinActive:  false,   // puffin currently on branch
    lastPuffinAt:  0,       // elapsed seconds when last puffin appeared
    lastTenth:     -1,      // unused, kept for safety
    leavesPlayed:  false,   // rustle sound played once per session
    phase:              'work',  // 'work' | 'break'
    intervalElapsed:    0,       // seconds elapsed in current 25-min work block
    breakRemaining:     0,       // seconds remaining in break
    breakIntervalId:    null,    // setInterval handle for break tick
    puffinShownInInterval: false, // puffin appeared in current work interval
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
    hoursInput:     $('input-hours'),
    minutesInput:   $('input-minutes'),
    inputGroup:     $('input-group'),
    ringWrap:       $('ring-wrap'),
    breakWrap:      $('break-wrap'),
    breakDisplay:   $('break-display'),
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
    cup:            $('puffin-cup'),
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
  // AUDIO  – single shared AudioContext, unlocked on first gesture
  // =====================================================

  let _ac = null;

  // Returns the shared AudioContext, creating it if needed.
  // Must be called from within (or after) a user-gesture handler so the
  // browser allows it to run – we call unlockAudio() on every button click.
  function getAc() {
    if (!_ac) {
      _ac = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ac.state === 'suspended') _ac.resume();
    return _ac;
  }

  // Wire all <audio> elements through the shared AudioContext so that
  // audio.play() works even from setInterval/setTimeout callbacks.
  // (iOS Safari and strict autoplay policies block native audio.play()
  // in timer callbacks; routing through a running AudioContext bypasses this.)
  const _mediaSrc = {};
  function wireAudioElement(id) {
    if (_mediaSrc[id]) return;
    const audio = document.getElementById(id);
    if (!audio) return;
    try {
      const ac  = getAc();
      const src = ac.createMediaElementSource(audio);
      src.connect(ac.destination);
      _mediaSrc[id] = src;
    } catch (e) {}
  }

  // Call on every button click to unlock the AudioContext AND wire elements.
  function unlockAudio() {
    try {
      getAc();
      wireAudioElement('snd-bird');
      wireAudioElement('snd-leaves');
      wireAudioElement('snd-slurp');
    } catch (e) {}
  }

  // Bell chime: timer end
  function playPing() {
    try {
      const ac = getAc(), now = ac.currentTime;
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

  // Play an <audio> element from scratch (rewind if already playing)
  function playAudio(id) {
    try {
      const audio = document.getElementById(id);
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  // Play poop sound via shared AudioContext with gain boost (file is quiet)
  // Uses a one-time MediaElementSource wired into the shared context.
  let _poopSrc = null;
  function playPoopAmplified() {
    try {
      const audio = document.getElementById('snd-poop');
      if (!audio) return;
      const ac = getAc();
      if (!_poopSrc) {
        _poopSrc = ac.createMediaElementSource(audio);
        const gain = ac.createGain();
        gain.gain.value = 5.0;
        _poopSrc.connect(gain);
        gain.connect(ac.destination);
      }
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {
      playAudio('snd-poop');
    }
  }

  // =====================================================
  // TIMER
  // =====================================================

  function getInputSecs() {
    const hh = Math.max(0, parseInt(el.hoursInput.value)   || 0);
    const mm = Math.min(59, Math.max(0, parseInt(el.minutesInput.value) || 0));
    return hh * 3600 + mm * 60;
  }

  // Main timer display: HH:MM:SS
  function fmtHHMM(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // Break timer display: MM:SS
  function fmtMMSS(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function startTimer() {
    const total = getInputSecs();
    if (total <= 0) return;

    if (!timer.isPaused) {
      timer.totalSeconds         = total;
      timer.remaining            = total;
      timer.puffinShown          = false;
      timer.puffinActive         = false;
      timer.lastPuffinAt         = 0;
      timer.lastTenth            = -1;
      timer.leavesPlayed         = false;
      timer.phase                = 'work';
      timer.intervalElapsed      = 0;
      timer.puffinShownInInterval = false;
      clearPoops();
      clearLog();
    }

    timer.isRunning = true;
    timer.isPaused  = false;

    // Swap input for ring
    el.inputGroup.style.display  = 'none';
    el.ringWrap.classList.remove('hidden');
    el.breakWrap.classList.add('hidden');

    el.startBtn.disabled     = true;
    el.pauseBtn.disabled     = false;
    el.hoursInput.disabled   = true;
    el.minutesInput.disabled = true;

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
    clearInterval(timer.breakIntervalId);
    clearPuffinTimeouts();
    hidePuffin();

    timer.isRunning            = false;
    timer.isPaused             = false;
    timer.puffinShown          = false;
    timer.puffinActive         = false;
    timer.lastPuffinAt         = 0;
    timer.lastTenth            = -1;
    timer.leavesPlayed         = false;
    timer.phase                = 'work';
    timer.intervalElapsed      = 0;
    timer.breakRemaining       = 0;
    timer.breakIntervalId      = null;
    timer.puffinShownInInterval = false;
    timer.remaining            = getInputSecs();
    clearPoops();

    // Swap ring/break back to input
    el.ringWrap.classList.add('hidden');
    el.breakWrap.classList.add('hidden');
    el.inputGroup.style.display = '';

    el.startBtn.disabled     = false;
    el.startBtn.textContent  = 'Start';
    el.pauseBtn.disabled     = true;
    el.hoursInput.disabled   = false;
    el.minutesInput.disabled = false;

    el.ring.style.strokeDashoffset = 0;
    el.ring.style.stroke           = 'var(--blue)';
    el.countdown.textContent       = fmtHHMM(timer.remaining);

    // Reset tree to bare
    updateTree(0);
    updateTabTitle();
  }

  function tick() {
    timer.remaining--;
    timer.intervalElapsed++;

    if (timer.remaining <= 0) {
      timer.remaining = 0;
      clearInterval(timer.intervalId);
      updateRingUI();
      updateTree(1);
      onComplete();
      return;
    }

    updateRingUI();
    updateTabTitle();

    const elapsed  = timer.totalSeconds - timer.remaining;
    const progress = elapsed / timer.totalSeconds;

    // Continuous tree growth (always based on overall progress)
    updateTree(progress);

    // XP every 5 minutes
    if (elapsed > 0 && elapsed % 300 === 0) awardXP(5);

    // Leaf rustle: once when leaves start appearing (~40% progress), max 3 s
    if (!timer.leavesPlayed && progress >= 0.40) {
      timer.leavesPlayed = true;
      const leavesAudio = document.getElementById('snd-leaves');
      if (leavesAudio) {
        leavesAudio.currentTime = 0;
        leavesAudio.play().catch(() => {});
        setTimeout(() => { leavesAudio.pause(); leavesAudio.currentTime = 0; }, 3000);
      }
    }

    // Pomodoro: 25-min work intervals with 5-min breaks
    if (timer.totalSeconds >= 1500) {
      // Long timer (≥ 25 min): pomodoro rhythm
      if (timer.intervalElapsed >= 1500) {
        startBreak();
        return; // don't apply further puffin logic
      }
      // Puffin at 75% of 25-min interval (after 18:45)
      if (!timer.puffinShownInInterval && timer.intervalElapsed >= 1125) {
        timer.puffinShownInInterval = true;
        timer.puffinActive = true;
        showPuffin(false);
      }
    } else {
      // Short timer (< 25 min): appear once at 75%
      if (!timer.puffinShown && progress >= 0.75) {
        timer.puffinShown  = true;
        timer.puffinActive = true;
        showPuffin(false);
      }
    }

    // Ring colour: blue → yellow → green
    if (progress > 0.75)     el.ring.style.stroke = 'var(--green)';
    else if (progress > 0.5) el.ring.style.stroke = 'var(--yellow-dark)';
    else                      el.ring.style.stroke = 'var(--blue)';
  }

  function updateRingUI() {
    el.countdown.textContent = fmtHHMM(timer.remaining);
    const progress = (timer.totalSeconds - timer.remaining) / timer.totalSeconds;
    el.ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  }

  function startBreak() {
    clearInterval(timer.intervalId);
    timer.intervalElapsed       = 0;
    timer.puffinShownInInterval = false;
    timer.breakRemaining        = 300; // 5 minutes

    // Reset puffin state so it arrives fresh with bird sound
    clearPuffinTimeouts();
    el.bubble.classList.add('hidden');
    el.cup.classList.add('hidden');
    el.puffin.classList.remove('visible');
    el.puffin.classList.add('hidden');
    timer.puffinActive = false;

    // Show break UI, hide ring
    el.ringWrap.classList.add('hidden');
    el.breakWrap.classList.remove('hidden');
    el.breakDisplay.textContent = fmtMMSS(timer.breakRemaining);

    // Puffin flies in fresh: bird sound → break quote → coffee cup + slurp
    showPuffin(true);

    sendNotif('☕ Pause! 5 Minuten für dich, Schneck.', 'Du hast 25 Minuten konzentriert gearbeitet – super gemacht!');

    timer.phase = 'break';
    timer.breakIntervalId = setInterval(breakTick, 1000);
  }

  function breakTick() {
    timer.breakRemaining--;
    el.breakDisplay.textContent = fmtMMSS(timer.breakRemaining);
    updateTabTitle();
    if (timer.breakRemaining <= 0) endBreak();
  }

  function endBreak() {
    clearInterval(timer.breakIntervalId);
    clearPuffinTimeouts();
    timer.phase = 'work';

    // Hide coffee cup and bubble
    el.cup.classList.add('hidden');
    el.bubble.classList.add('hidden');

    // Puffin flies away with bird sound
    playAudio('snd-bird');
    setTimeout(() => {
      const b = document.getElementById('snd-bird');
      if (b) { b.pause(); b.currentTime = 0; }
    }, 5000);

    // Fade puffin out
    el.puffin.classList.remove('visible');
    setTimeout(() => {
      el.puffin.classList.add('hidden');
      timer.puffinActive = false;
    }, 700);

    // Hide break UI, show ring
    el.breakWrap.classList.add('hidden');
    el.ringWrap.classList.remove('hidden');
    updateRingUI();

    sendNotif('💪 Weiter geht\'s, Schneck!', 'Pause vorbei – nächstes 25-Minuten-Intervall startet jetzt.');

    // Resume main timer if time remains
    if (timer.remaining > 0) {
      timer.intervalId = setInterval(tick, 1000);
    }
  }

  function onComplete() {
    timer.isRunning = false;

    // Swap ring back to input
    el.ringWrap.classList.add('hidden');
    el.inputGroup.style.display = '';

    playPing();
    launchConfetti();
    sendNotif('🎉 Session abgeschlossen!', 'Mega gemacht, Schneck! Maus ist so stolz auf dich!');
    updateTabTitle();
    awardXP(50);
    player.completedSessions++;
    checkBadges();
    savePlayer();
    renderBadges();
    el.sessionsDisp.textContent = player.completedSessions;

    el.startBtn.disabled     = false;
    el.startBtn.textContent  = 'Neue Session';
    el.pauseBtn.disabled     = true;
    el.hoursInput.disabled   = false;
    el.minutesInput.disabled = false;

    timer.isPaused    = false;
    timer.puffinShown = false;
  }

  // =====================================================
  // TREE  (continuous growth via stroke-dashoffset)
  // =====================================================

  // Generate ~500 leaves distributed across a full rounded dome canopy
  function generateLeaves() {
    const svg    = document.getElementById('tree-svg');
    const colors = ['#7ab87a','#8eca7e','#9ed88e','#6db06d','#a0d090','#b8e0a0','#c4e8b0','#58a058'];
    // [cx, cy, rx, ry, count, minProgress, maxProgress]
    const regions = [
      // ── Dome top (dense center crown) ──
      [110, 28, 32, 18, 36, 0.48, 0.68],
      [110, 48, 42, 22, 40, 0.50, 0.72],
      [110, 68, 50, 24, 38, 0.52, 0.74],
      [110, 88, 52, 22, 36, 0.54, 0.76],
      [110,108, 50, 20, 34, 0.56, 0.78],
      [110,124, 44, 16, 28, 0.58, 0.80],

      // ── Left dome quadrant ──
      [72,  42, 24, 20, 28, 0.50, 0.72],
      [58,  62, 22, 22, 26, 0.52, 0.74],
      [48,  82, 20, 20, 24, 0.54, 0.76],
      [40, 100, 18, 18, 22, 0.56, 0.78],
      [34, 118, 16, 16, 18, 0.57, 0.80],

      // ── Right dome quadrant ──
      [148,  42, 24, 20, 28, 0.50, 0.72],
      [162,  62, 22, 22, 26, 0.52, 0.74],
      [172,  82, 20, 20, 24, 0.54, 0.76],
      [180, 100, 18, 18, 22, 0.56, 0.78],
      [186, 118, 16, 16, 18, 0.57, 0.80],

      // ── Far-left tips ──
      [14,  12, 20, 14, 22, 0.41, 0.64],
      [4,   34, 14, 16, 18, 0.44, 0.66],
      [8,   52, 16, 14, 18, 0.46, 0.68],
      [18,  70, 16, 14, 16, 0.48, 0.70],
      [28,  90, 18, 14, 18, 0.50, 0.72],

      // ── Far-right tips ──
      [206,  12, 20, 14, 22, 0.41, 0.64],
      [216,  34, 14, 16, 18, 0.44, 0.66],
      [212,  52, 16, 14, 18, 0.46, 0.68],
      [202,  70, 16, 14, 16, 0.48, 0.70],
      [192,  90, 18, 14, 18, 0.50, 0.72],

      // ── Filling gaps between dome sections ──
      [86,  36, 20, 16, 22, 0.49, 0.71],
      [134, 36, 20, 16, 22, 0.49, 0.71],
      [78,  90, 26, 18, 24, 0.55, 0.78],
      [142, 90, 26, 18, 24, 0.55, 0.78],
      [68, 115, 22, 16, 18, 0.57, 0.80],
      [152,115, 22, 16, 18, 0.57, 0.80],

      // ── Extra bulk layers ──
      [110, 15, 22, 12, 20, 0.46, 0.66],
      [90,  55, 30, 18, 22, 0.51, 0.73],
      [130, 55, 30, 18, 22, 0.51, 0.73],
      [100, 78, 36, 18, 22, 0.53, 0.75],
      [120, 78, 36, 18, 22, 0.53, 0.75],

      // ── Upper dome arc fill (closing the red-line gap) ──
      [110,  5, 26, 10, 30, 0.44, 0.65],  // very top center
      [88,  14, 20, 12, 26, 0.45, 0.66],  // top left of center
      [132, 14, 20, 12, 26, 0.45, 0.66],  // top right of center
      [64,  18, 20, 14, 26, 0.45, 0.67],  // upper-left inner arc
      [156, 18, 20, 14, 26, 0.45, 0.67],  // upper-right inner arc
      [44,  32, 20, 16, 24, 0.46, 0.68],  // upper-left outer arc
      [176, 32, 20, 16, 24, 0.46, 0.68],  // upper-right outer arc
      [28,  50, 18, 16, 20, 0.47, 0.69],  // far-left upper fill
      [192, 50, 18, 16, 20, 0.47, 0.69],  // far-right upper fill
      [56,  38, 16, 14, 20, 0.46, 0.68],  // left arc shoulder
      [164, 38, 16, 14, 20, 0.46, 0.68],  // right arc shoulder
    ];

    regions.forEach(([cx, cy, rx, ry, count, minT, maxT]) => {
      for (let i = 0; i < count; i++) {
        const x     = cx + (Math.random() - 0.5) * rx * 2;
        const y     = cy + (Math.random() - 0.5) * ry * 2;
        const angle = (Math.random() - 0.5) * 100;
        const scale = 0.7 + Math.random() * 0.75;
        const thr   = minT + Math.random() * (maxT - minT);
        const color = colors[Math.floor(Math.random() * colors.length)];
        const use   = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#lf');
        use.setAttribute('class', 'leaf');
        use.dataset.min = thr.toFixed(3);
        use.setAttribute('transform',
          `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${scale.toFixed(2)})`);
        use.setAttribute('fill', color);
        use.style.opacity = '0';
        svg.appendChild(use);
      }
    });
  }

  function initTree() {
    document.querySelectorAll('.branch').forEach(path => {
      const len = path.getTotalLength ? path.getTotalLength() : 100;
      path.dataset.len = len;
      path.style.strokeDasharray  = len;
      path.style.strokeDashoffset = len; // fully hidden
    });
    // Leaves start invisible (set via CSS opacity:0)
  }

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
  }

  // =====================================================
  // PUFFIN  (appears on branch, stays 15 s)
  // =====================================================

  function clearPuffinTimeouts() {
    puffinTimeouts.forEach(clearTimeout);
    puffinTimeouts = [];
  }

  function showPuffin(breakMode = false) {
    clearPuffinTimeouts();
    playAudio('snd-bird');
    // Stop bird sound after 5 s
    puffinTimeouts.push(setTimeout(() => {
      const b = document.getElementById('snd-bird');
      if (b) { b.pause(); b.currentTime = 0; }
    }, 5000));

    const p = el.puffin;
    p.classList.remove('hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => p.classList.add('visible'));
    });

    if (!breakMode) {
      // Normal work visit: quote shows at 0.8s, puffin leaves at 15.8s
      // → quote is visible for exactly 15 seconds
      puffinTimeouts.push(setTimeout(showQuote,   800));   // quote appears
      const willPoop = Math.random() < 0.30;
      if (willPoop) {
        puffinTimeouts.push(setTimeout(doPoop,   12300)); // poop at 11.5s after quote
      }
      puffinTimeouts.push(setTimeout(sendKiss,   13800)); // kiss at 13s after quote
      puffinTimeouts.push(setTimeout(hidePuffin, 15800)); // fly away at 15s after quote
    } else {
      // Break mode: show break quote, then pull out coffee cup + slurp sound
      puffinTimeouts.push(setTimeout(() => {
        showBreakQuote();
        puffinTimeouts.push(setTimeout(() => {
          el.cup.classList.remove('hidden');
          playAudio('snd-slurp');
        }, 700));
      }, 800));
      // No fly-away scheduled – puffin stays until endBreak()
    }
  }

  function hidePuffin() {
    clearPuffinTimeouts();
    el.bubble.classList.add('hidden');
    el.cup.classList.add('hidden');
    el.kiss.classList.remove('flying');
    el.kiss.classList.add('hidden');

    const p = el.puffin;
    p.classList.remove('visible');
    // After fade-out transition, fully hide
    setTimeout(() => {
      p.classList.add('hidden');
      timer.puffinActive = false;
    }, 700);
  }

  function playKissSound() {
    try {
      const ac = getAc(), now = ac.currentTime;
      // Lip-smack: short burst of bandpass noise
      const len = Math.floor(ac.sampleRate * 0.09);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
      const src  = ac.createBufferSource(); src.buffer = buf;
      const bp   = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
      const ng   = ac.createGain(); ng.gain.setValueAtTime(0.55, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      src.connect(bp); bp.connect(ng); ng.connect(ac.destination);
      src.start(now);
      // "Mmwah" tone: soft sine rising then falling, ~1.2 s total
      const osc  = ac.createOscillator(); osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now + 0.04);
      osc.frequency.linearRampToValueAtTime(580, now + 0.28);
      osc.frequency.linearRampToValueAtTime(340, now + 0.9);
      const og   = ac.createGain();
      og.gain.setValueAtTime(0, now + 0.04);
      og.gain.linearRampToValueAtTime(0.18, now + 0.18);
      og.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(og); og.connect(ac.destination);
      osc.start(now + 0.04); osc.stop(now + 1.2);
    } catch (e) {}
  }

  function sendKiss() {
    playKissSound();
    const h = el.kiss;
    h.classList.remove('hidden', 'flying');
    void h.offsetWidth;
    h.classList.add('flying');
    setTimeout(() => { h.classList.add('hidden'); h.classList.remove('flying'); }, 2400);
  }

  let activePoops   = [];
  let wormTimeouts  = [];

  function doPoop() {
    playPoopAmplified();
    const scene = document.getElementById('tree-scene');
    const poop  = document.createElement('div');
    poop.textContent = '💩';
    poop.className   = 'poop-item';
    // Start at puffin position (right ~68px, bottom ~174px in scene)
    poop.style.right  = '72px';
    poop.style.bottom = '174px';
    scene.appendChild(poop);
    activePoops.push(poop);
    // Force reflow, then transition to ground
    void poop.offsetWidth;
    poop.style.bottom    = '8px';
    poop.style.transform = 'rotate(20deg)';

    // Worm crawls in from the right 3 minutes later to eat the poop
    const t = setTimeout(() => {
      if (poop.parentNode) doWorm(poop);
    }, 180000);
    wormTimeouts.push(t);
  }

  function doWorm(poopEl) {
    const scene  = document.getElementById('tree-scene');
    const sceneW = scene.offsetWidth;

    const worm = document.createElement('div');
    worm.className   = 'worm-item';
    worm.textContent = '🪱';
    worm.style.bottom = '4px';
    worm.style.left   = (sceneW + 20) + 'px'; // start off-screen right

    scene.appendChild(worm);
    void worm.offsetWidth; // force reflow before transition

    // Phase 1: crawl left to poop (~2 s)
    const targetLeft = sceneW - 72 - 24;
    worm.style.transition = 'left 2s linear';
    worm.style.left = targetLeft + 'px';

    setTimeout(() => {
      // Eating: wiggle + fade poop out
      worm.classList.add('worm-eating');
      poopEl.style.transition = 'opacity 0.4s ease';
      poopEl.style.opacity    = '0';
      setTimeout(() => {
        if (poopEl.parentNode) poopEl.remove();
        activePoops = activePoops.filter(p => p !== poopEl);
      }, 400);

      setTimeout(() => {
        worm.classList.remove('worm-eating');
        // Phase 2: crawl out to the left (~2.5 s)
        worm.style.transition = 'left 2.5s linear';
        worm.style.left = '-60px';
        setTimeout(() => { if (worm.parentNode) worm.remove(); }, 2600);
      }, 1400);
    }, 2100);
  }

  function clearPoops() {
    activePoops.forEach(p => p.remove());
    activePoops = [];
    wormTimeouts.forEach(clearTimeout);
    wormTimeouts = [];
    document.querySelectorAll('.worm-item').forEach(w => w.remove());
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

  function showBreakQuote() {
    const q = BREAK_QUOTES[Math.floor(Math.random() * BREAK_QUOTES.length)];
    el.quoteText.textContent = q;
    el.bubble.classList.remove('hidden');
    addToLog(q);
  }

  function clearLog() {
    el.logList.innerHTML = '<p class="empty-log">Noch keine Nachrichten...<br>starte einen Timer!</p>';
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
  // NOTIFICATIONS + TAB TITLE
  // =====================================================

  function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendNotif(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body, silent: false }); } catch (e) {}
  }

  function updateTabTitle() {
    if (timer.phase === 'break') {
      document.title = `☕ ${fmtMMSS(timer.breakRemaining)} – Pause`;
    } else if (timer.isRunning) {
      document.title = `⏱ ${fmtHHMM(timer.remaining)} – Fokuszeit`;
    } else {
      document.title = '🌱 Schnecks Fokuszeit';
    }
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
    generateLeaves();
    initTree();

    // Ring + countdown init
    el.ring.style.strokeDasharray  = CIRCUMFERENCE;
    el.ring.style.strokeDashoffset = 0;
    el.countdown.textContent       = fmtHHMM(getInputSecs());

    checkLevelUp();
    renderXPBar();
    renderBadges();
    el.sessionsDisp.textContent = player.completedSessions;

    // Button listeners – unlockAudio() on every click so the shared
    // AudioContext is created/resumed within a genuine user gesture.
    el.startBtn.addEventListener('click',    () => { unlockAudio(); requestNotifPermission(); startTimer(); });
    el.pauseBtn.addEventListener('click',    () => { unlockAudio(); pauseTimer(); });
    el.resetBtn.addEventListener('click',    () => { unlockAudio(); resetTimer(); });
    el.testSoundBtn.addEventListener('click',() => { unlockAudio(); playPing();  });

    // Live countdown preview
    el.hoursInput.addEventListener('input', () => {
      const v = parseInt(el.hoursInput.value);
      if (isNaN(v) || v < 0) el.hoursInput.value = 0;
      if (v > 23)            el.hoursInput.value = 23;
      if (!timer.isRunning)  el.countdown.textContent = fmtHHMM(getInputSecs());
    });
    el.minutesInput.addEventListener('input', () => {
      if (!timer.isRunning) el.countdown.textContent = fmtHHMM(getInputSecs());
    });
    el.minutesInput.addEventListener('change', () => {
      const v = parseInt(el.minutesInput.value);
      if (isNaN(v) || v < 0) el.minutesInput.value = 0;
      if (v > 59)            el.minutesInput.value = 59;
      if (!timer.isRunning)  el.countdown.textContent = fmtHHMM(getInputSecs());
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
