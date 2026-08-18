/* =========================================================
 * 8-bit 音效系统 sound.js
 * 纯 Web Audio API 生成，不引入任何音频文件。
 * 依赖：index.html 中已存在 #soundToggle 按钮（♪ ON / ♪ OFF）。
 * ========================================================= */
(function () {
  "use strict";

  /* ---------- 状态 ---------- */
  var ctx = null;          // AudioContext（懒创建）
  var master = null;       // 主音量节点（音乐 + 音效共用）
  var soundOn = false;     // 音效开关
  var lastHover = 0;       // hover 音效节流
  var btn = null;          // 开关按钮

  /* ---------- 背景音乐音序 ---------- */
  var musicTimer = null;
  var musicIndex = 0;
  var nextNoteTime = 0;
  var STEP = 60 / 120 / 2; // BPM 120，八分音符 0.25s；64 步 = 16 秒一轮
  // 旋律（64 步，C 大调五声音阶，0 = 休止；A-B 段落结构，避免单调）
  var MELODY = [
    // A 段
    523, 659, 784, 659, 880, 784, 659, 587,
    523, 659, 784, 880, 784, 659, 587, 0,
    // A' 段（变化）
    523, 659, 784, 659, 880, 784, 659, 523,
    587, 698, 880, 698, 784, 659, 523, 0,
    // B 段（对比，更开阔）
    659, 784, 880, 784, 587, 659, 784, 659,
    523, 587, 659, 784, 880, 784, 659, 0,
    // A'' 段（回归收尾）
    523, 659, 784, 659, 880, 784, 659, 587,
    523, 659, 784, 1047, 880, 784, 659, 523,
  ];
  // 低音线（64 步；每 4 步一个根音 + 一个五度，更稀疏不抢戏）
  var BASS = [
    131, 0, 98, 0, 131, 0, 98, 0,
    131, 0, 98, 0, 87, 0, 65, 0,
    110, 0, 82, 0, 110, 0, 82, 0,
    98, 0, 73, 0, 98, 0, 73, 0,
    131, 0, 98, 0, 131, 0, 98, 0,
    131, 0, 98, 0, 87, 0, 65, 0,
    110, 0, 82, 0, 110, 0, 82, 0,
    98, 0, 73, 0, 131, 0, 98, 0,
  ];

  /* ---------- 初始化 ---------- */
  try {
    soundOn = localStorage.getItem("arcade-sound") === "1";
  } catch (e) {
    soundOn = false;
  }

  function ready() {
    btn = document.getElementById("soundToggle");
    if (!btn) return;
    updateBtn();

    btn.addEventListener("click", toggleSound);

    // 持久化为开启时：等用户第一次点击页面再启动音乐（浏览器策略）
    if (soundOn) {
      window.addEventListener("pointerdown", startMusic, { once: true });
    }

    // 页面隐藏时暂停音乐
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopMusic();
      } else if (soundOn) {
        startMusic();
      }
    });
  }

  /* ---------- 核心：懒创建 AudioContext ---------- */
  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5; // 主音量（保守）
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
        return null;
      }
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  /* ---------- 单个音效 ---------- */
  function playTone(freq, dur, type, vol, when) {
    if (!soundOn) return;
    var c = ensureCtx();
    if (!c || !master) return;
    var t0 = c.currentTime + (when || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    // 音量包络：5ms 起音，平滑收尾，防刺耳
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    osc.onended = function () {
      try {
        osc.disconnect();
        g.disconnect();
      } catch (e) {}
    };
  }

  /* ---------- 连奏音（金币/提示） ---------- */
  function playArpeggio(freqs, type, vol, step) {
    if (!soundOn) return;
    var st = step || 0.09;
    freqs.forEach(function (f, i) {
      playTone(f, 0.12, type || "square", vol || 0.02, i * st);
    });
  }

  /* ---------- 音效映射（事件委托，不侵入 app.js） ---------- */
  function bindSounds() {
    // 点击：a / button
    document.addEventListener("click", function (e) {
      if (!e.target.closest("a, button")) return;
      if (e.target === btn) return; // 开关自己的确认音单独处理
      playTone(880, 0.09, "square", 0.03);
    });

    // hover：a / button（节流，防连发）
    document.addEventListener("mouseover", function (e) {
      if (!e.target.closest("a, button")) return;
      var now = performance.now();
      if (now - lastHover < 90) return;
      lastHover = now;
      playTone(660, 0.05, "square", 0.015);
    });

    // 作品卡片 hover：短双音
    document.querySelectorAll(".project-card").forEach(function (card) {
      card.addEventListener("mouseenter", function () {
        playArpeggio([987, 1319], "square", 0.02, 0.06);
      });
    });

    // 区块进入视口（reveal 触发）：升调双音
    var mo = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.target.classList && m.target.classList.contains("is-visible") &&
          m.target.querySelector &&
          m.target.querySelector("h2") &&
          playArpeggio([523, 784], "square", 0.02, 0.07);
      });
    });
    document.querySelectorAll(".reveal").forEach(function (el) {
      mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    });

    // 回到顶部按钮浮现：上滑音
    var topBtn = document.querySelector(".back-to-top");
    if (topBtn) {
      var tmo = new MutationObserver(function () {
        if (!topBtn.hidden) {
          playTone(1000, 0.12, "square", 0.02);
          setTimeout(function () { playTone(1200, 0.12, "square", 0.02); }, 90);
        }
      });
      tmo.observe(topBtn, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  /* ---------- 开关 ---------- */
  function toggleSound() {
    soundOn = !soundOn;
    try {
      localStorage.setItem("arcade-sound", soundOn ? "1" : "0");
    } catch (e) {}
    updateBtn();
    if (soundOn) {
      ensureCtx();
      playTone(880, 0.1, "square", 0.03); // 确认音
      startMusic();
    } else {
      stopMusic();
    }
  }

  function updateBtn() {
    if (!btn) return;
    btn.textContent = soundOn ? "♪ ON" : "♪ OFF";
    btn.classList.toggle("on", soundOn);
  }

  /* ---------- 背景音乐（音序器） ---------- */
  function startMusic() {
    stopMusic();
    var c = ensureCtx();
    if (!c || !master || !soundOn) return;
    musicIndex = 0;
    nextNoteTime = c.currentTime + 0.1;
    musicTimer = setInterval(musicTick, 100);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function musicTick() {
    var c = ensureCtx();
    if (!c || !master || !soundOn) {
      stopMusic();
      return;
    }
    // 提前调度 0.2s 内的音符
    while (nextNoteTime < c.currentTime + 0.2) {
      var i = musicIndex % MELODY.length;
      if (MELODY[i]) {
        scheduleNote(MELODY[i], nextNoteTime, "square", 0.02, 0.2);
      }
      if (BASS[i]) {
        scheduleNote(BASS[i], nextNoteTime, "triangle", 0.022, 0.22);
      }
      nextNoteTime += STEP;
      musicIndex++;
    }
  }

  function scheduleNote(freq, when, type, vol, dur) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.03);
    osc.onended = function () {
      try {
        osc.disconnect();
        g.disconnect();
      } catch (e) {}
    };
  }

  /* ---------- 启动 ---------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      ready();
      bindSounds();
    });
  } else {
    ready();
    bindSounds();
  }
})();
