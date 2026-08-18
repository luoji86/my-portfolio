# 罗一言 · 个人作品集

用 AI 把想法做成可以玩的东西。

## 在线访问

部署于 GitHub Pages：`https://Cleaner-cyber.github.io/my-portfolio/`

## 项目内容

- **作品集**：AI 简历优化网站 / 手势实验室 / 个人作品集网站 / AI 辅助开发交互原型
- **小游戏**（`games/`）：
  - `plane.html` — 飞机大战（键盘）
  - `fruit.html` — 手势切水果（需摄像头，需 https）
  - `supernova.html` — 手势粒子云（需摄像头，需 https）

## 技术栈

纯 HTML + CSS + 原生 JS，无框架；MediaPipe Hands 手势识别；8-bit Web Audio 音效。

## 本地运行

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

> 摄像头游戏必须通过 `https` 或 `localhost` 访问（浏览器安全策略）。
