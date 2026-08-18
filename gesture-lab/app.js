/* =========================================================
 * 手势实验室 Gesture Lab
 * 基于 MediaPipe Hands（旧版 API），纯前端，画面本地处理。
 * 代码已尽量注释，方便你自己改着玩。
 * ========================================================= */

/* ---------- 全局状态 ---------- */
const $ = (id) => document.getElementById(id);

const video = $("video");
const overlay = $("overlay");
const ctx = overlay.getContext("2d");
const statusPill = $("statusPill");
const camHint = $("camHint");

let hands = null;        // MediaPipe Hands 实例
let camera = null;       // 摄像头控制器
let running = false;     // 摄像头是否已开启

let currentMode = "rps"; // rps | flip | light

/* ---------- 工具：两点距离 ---------- */
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/* ---------- 手指伸展判断 ----------
 * 原理：指尖到手腕的距离 > 指中关节到手腕的距离 => 这根手指是伸开的。
 * landmarks 是 MediaPipe 的 21 个手部关键点：
 *   0 手腕, 1-4 拇指, 5-8 食指, 9-12 中指, 13-16 无名指, 17-20 小指
 * 每个点: {x, y, z}，x/y 是 0-1 的归一化坐标。
 */
function getFingers(lm) {
  const W = lm[0];
  const f = (tip, pip, base) => dist(lm[tip], lm[base]) > dist(lm[pip], lm[base]);
  return {
    thumb: dist(lm[4], lm[1]) > dist(lm[3], lm[1]),  // 拇指：用掌根做基准
    index: f(8, 6, 0),
    middle: f(12, 10, 0),
    ring: f(16, 14, 0),
    pinky: f(20, 18, 0),
  };
}

/* ---------- 判断手势：石头 / 剪刀 / 布 ---------- */
function getPose(f) {
  const four = [f.index, f.middle, f.ring, f.pinky];
  const extended = four.filter(Boolean).length;
  if (extended <= 0) return "rock";       // 全握 = 石头
  if (extended >= 3) return "paper";      // 张开 = 布
  if (f.index && f.middle && !f.ring && !f.pinky) return "scissors";
  return null;                            // 其他手势不算
}

const POSE_META = {
  rock: { emoji: "✊", name: "石头" },
  paper: { emoji: "✋", name: "布" },
  scissors: { emoji: "✌️", name: "剪刀" },
};

/* =========================================================
 * 石头剪刀布模式
 * ========================================================= */
const rps = {
  scoreYou: 0,
  scoreAi: 0,
  stablePose: null,     // 当前连续保持的手势
  stableSince: 0,       // 开始稳定的时间
  roundCooldown: 0,     // 一局结束后短暂冷却
  resultText: "",       // 本局结果
  resultUntil: 0,
};

function resetRps() {
  rps.scoreYou = 0;
  rps.scoreAi = 0;
  rps.stablePose = null;
  rps.roundCooldown = 0;
  rps.resultText = "";
  rps.resultUntil = 0;
  $("scoreYou").textContent = "0";
  $("scoreAi").textContent = "0";
  $("yourEmoji").textContent = "✋";
  $("yourName").textContent = "等待出拳…";
  $("aiEmoji").textContent = "❔";
  $("aiName").textContent = "—";
  setResult("", "");
}

function setResult(text, cls) {
  const el = $("rpsResult");
  el.textContent = text;
  el.className = "rps-result" + (cls ? " " + cls : "");
}

function updateRps(pose) {
  const now = performance.now();

  // 结果展示期：忽略手势
  if (now < rps.resultUntil || now < rps.roundCooldown) {
    $("yourEmoji").textContent = "✋";
    $("yourName").textContent = "…";
    return;
  }

  // 更新展示
  if (pose && POSE_META[pose]) {
    $("yourEmoji").textContent = POSE_META[pose].emoji;
    $("yourName").textContent = POSE_META[pose].name;
  } else {
    $("yourEmoji").textContent = "✋";
    $("yourName").textContent = "等待出拳…";
  }

  // 稳定检测：同一个手势保持 0.5 秒才算「出拳」
  if (pose === rps.stablePose) {
    if (pose && now - rps.stableSince > 500) {
      playRound(pose);
    }
  } else {
    rps.stablePose = pose;
    rps.stableSince = now;
  }
}

function playRound(you) {
  const ai = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
  $("aiEmoji").textContent = POSE_META[ai].emoji;
  $("aiName").textContent = POSE_META[ai].name;

  let text, cls;
  if (you === ai) {
    text = "平局！再来一局";
    cls = "draw";
  } else if (
    (you === "rock" && ai === "scissors") ||
    (you === "paper" && ai === "rock") ||
    (you === "scissors" && ai === "paper")
  ) {
    text = "🎉 你赢了！";
    cls = "win";
    rps.scoreYou++;
  } else {
    text = "AI 赢了，再来！";
    cls = "lose";
    rps.scoreAi++;
  }
  $("scoreYou").textContent = rps.scoreYou;
  $("scoreAi").textContent = rps.scoreAi;
  setResult(text, cls);

  // 冷却 1.6 秒后进入下一局
  rps.resultText = text;
  rps.resultUntil = performance.now() + 1600;
  rps.roundCooldown = performance.now() + 300;
  rps.stablePose = null;
}

/* =========================================================
 * 翻页器模式：检测手指尖的快速左右滑动
 * ========================================================= */
const flip = {
  page: 1,
  maxPage: 20,
  history: [],          // [{t, x}] 最近的手指 x 轨迹（已镜像）
  cooldown: 0,
  tipFlash: 0,
};

function resetFlip() {
  flip.page = 1;
  flip.history = [];
  flip.cooldown = 0;
  $("flipNum").textContent = "1";
  $("flipTip").textContent = "挥手试试（左右各一次）";
}

function updateFlip(lm) {
  const now = performance.now();

  // 记录食指指尖的镜像 x 坐标（镜像后和屏幕方向一致）
  const tip = lm[8];
  flip.history.push({ t: now, x: 1 - tip.x });

  // 只保留最近 0.5 秒的轨迹
  flip.history = flip.history.filter((p) => now - p.t < 500);

  if (now < flip.cooldown || flip.history.length < 6) return;

  const first = flip.history[0];
  const last = flip.history[flip.history.length - 1];
  const dt = (last.t - first.t) / 1000; // 秒
  if (dt <= 0.05) return;

  const dx = last.x - first.x;          // 总位移（归一化宽度）
  const vx = dx / dt;                   // 速度（宽度/秒）

  // 速度够快 + 位移够大 => 判定为一次挥动
  if (Math.abs(vx) > 1.6 && Math.abs(dx) > 0.14) {
    if (vx < 0) {
      flip.page = Math.max(1, flip.page - 1);
      $("flipTip").textContent = "◀ 上一页";
    } else {
      flip.page = Math.min(flip.maxPage, flip.page + 1);
      $("flipTip").textContent = "▶ 下一页";
    }
    $("flipNum").textContent = flip.page;
    flip.cooldown = now + 650;          // 冷却，防止连挥
    flip.history = [];
  }
}

/* =========================================================
 * 智能开关模式：张开 = 开，握拳 = 关（防抖 0.6 秒）
 * ========================================================= */
const light = {
  state: false,          // 当前灯的状态
  target: null,          // 手势想要的状态
  stableSince: 0,
};

function resetLight() {
  light.state = false;
  light.target = null;
  setLightUI(false);
}

function setLightUI(on) {
  $("lightBulb").className = "light-bulb" + (on ? " on" : "");
  $("lightState").textContent = "灯：" + (on ? "开" : "关");
  $("lightState").className = "light-state" + (on ? " on" : "");
  $("lightSwitch").className = "light-switch" + (on ? " on" : "");
}

function updateLight(f) {
  const now = performance.now();
  const extended = [f.thumb, f.index, f.middle, f.ring, f.pinky].filter(Boolean).length;

  let target;
  if (extended >= 3) target = true;   // 张开手 = 开
  else if (extended <= 1) target = false; // 握拳 = 关
  else {
    light.target = null;              // 半握状态不算
    $("lightGuide").textContent = "举起手：张开 / 握拳";
    return;
  }

  if (target === light.target) {
    // 目标状态保持 0.6 秒才切换（防抖）
    if (target !== light.state && now - light.stableSince > 600) {
      light.state = target;
      setLightUI(target);
      $("lightGuide").textContent = target ? "已开灯：握拳可关闭" : "已关灯：张开手可打开";
    }
  } else {
    light.target = target;
    light.stableSince = now;
    $("lightGuide").textContent = target ? "保持张开…" : "保持握拳…";
  }
}

/* =========================================================
 * MediaPipe 识别主回调：每一帧调用
 * ========================================================= */
function onResults(results) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.drawImage(results.image, 0, 0, overlay.width, overlay.height);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    if (currentMode === "rps") {
      $("yourEmoji").textContent = "✋";
      $("yourName").textContent = "等待出拳…";
    }
    return;
  }

  const lm = results.multiHandLandmarks[0];

  // 画出手部骨架（便于调试）
  if (window.drawConnectors && window.drawLandmarks) {
    drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: "#3fe0e0", lineWidth: 2 });
    drawLandmarks(ctx, lm, { color: "#5ef0a8", lineWidth: 1, radius: 3 });
  }

  const f = getFingers(lm);

  if (currentMode === "rps") {
    updateRps(getPose(f));
  } else if (currentMode === "flip") {
    updateFlip(lm);
  } else if (currentMode === "light") {
    updateLight(f);
  }
}

/* =========================================================
 * 摄像头控制
 * ========================================================= */
async function startCamera() {
  if (running) return;
  setStatus("正在加载模型…", "warn");
  camHint.textContent = "正在加载手势识别模型…";

  try {
    if (typeof window.Hands === "undefined" || typeof window.Camera === "undefined") {
      throw new Error("MediaPipe 加载失败：请检查网络能否访问 cdn.jsdelivr.net");
    }

    // 创建识别器（模型文件从 jsdelivr 的 npm 包内加载）
    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    hands.onResults(onResults);

    // 摄像头
    camera = new Camera(video, {
      onFrame: async () => {
        if (hands) await hands.send({ image: video });
      },
      width: 640,
      height: 480,
    });
    await camera.start();

    running = true;
    $("startBtn").disabled = true;
    $("stopBtn").disabled = false;
    camHint.style.display = "none";
    setStatus("识别中", "on");
  } catch (err) {
    console.error(err);
    camHint.style.display = "grid";
    if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      camHint.textContent = "摄像头权限被拒绝：请在浏览器地址栏左侧允许摄像头访问后重试。";
      setStatus("权限被拒", "err");
    } else if (err && err.name === "NotFoundError") {
      camHint.textContent = "没有检测到摄像头设备。";
      setStatus("无摄像头", "err");
    } else {
      camHint.textContent = "启动失败：" + err.message;
      setStatus("错误", "err");
    }
  }
}

function stopCamera() {
  if (camera) {
    camera.stop();
    camera = null;
  }
  if (hands) {
    hands.close();
    hands = null;
  }
  running = false;
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
  camHint.style.display = "grid";
  camHint.textContent = "已停止，点击上方按钮重新开启";
  setStatus("已停止", "");
}

function setStatus(text, cls) {
  statusPill.textContent = text;
  statusPill.className = "status-pill" + (cls ? " " + cls : "");
}

/* =========================================================
 * 模式切换与按钮绑定
 * ========================================================= */
function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  document.querySelectorAll(".mode-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== "panel-" + mode);
  });
  // 切换模式时重置对应状态
  if (mode === "rps") resetRps();
  if (mode === "flip") resetFlip();
  if (mode === "light") resetLight();
}

document.querySelectorAll(".mode-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});

$("startBtn").addEventListener("click", startCamera);
$("stopBtn").addEventListener("click", stopCamera);
$("rpsReset").addEventListener("click", resetRps);
$("flipReset").addEventListener("click", resetFlip);

// 初始化画布尺寸（与视频一致，横屏 4:3）
function resizeCanvas() {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  overlay.width = w;
  overlay.height = h;
}
video.addEventListener("loadedmetadata", resizeCanvas);
resizeCanvas();

// 首次提示
setStatus("等待启动", "");
