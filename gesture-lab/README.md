# 手势实验室 Gesture Lab ✋

用摄像头识别手势的交互小应用，纯前端实现，打开即用，无需安装任何软件。

## 三个玩法

| 模式 | 玩法 |
|---|---|
| 🥌 石头剪刀布 | 在镜头前出拳（✊石头 / ✌️剪刀 / ✋布），AI 实时应战计分 |
| 📖 翻页器 | 左右挥手翻页，可当 PPT 遥控器 |
| 💡 智能开关 | 五指张开=开灯，握拳=关灯（智能家居面板演示） |

## 技术栈

- **MediaPipe Hands**（谷歌开源手势识别，模型打包在 npm 包内，走 jsdelivr CDN）
- 原生 HTML / CSS / JS，无框架
- 摄像头画面**只在本地浏览器处理，不上传**

## 如何运行

> ⚠️ 摄像头需要安全环境：`https` 或 `localhost`。**不能直接双击 index.html 打开**（file:// 下浏览器会禁用摄像头）。

### 本地运行（最简单）
```bash
# 在项目目录下启动一个本地服务器
python -m http.server 8080
```
然后浏览器打开 `http://localhost:8080`。

### 部署上线（GitHub Pages，免费）
1. 在 GitHub 新建仓库（如 `gesture-lab`），把本项目文件（index.html、style.css、app.js、README.md）上传
2. 仓库 Settings → Pages → Source 选 `main` 分支的 `/` 根目录
3. 等 1-2 分钟，访问 `https://你的用户名.github.io/gesture-lab/` 即可

## 浏览器兼容

- 推荐 Chrome / Edge（桌面与手机均可）
- 首次会请求摄像头权限，点击「允许」

## 常见问题

- **提示 MediaPipe 加载失败**：检查能否访问 `cdn.jsdelivr.net`（国内一般可直连；如果被墙，把 index.html 里 3 个 script 的 `cdn.jsdelivr.net` 换成 `fastly.jsdelivr.net`）
- **页面能开但点「开启摄像头」没反应**：确认是通过 `localhost` 或 `https` 访问的
- **手势偶尔识别不准**：保证手在画面内、光线充足、离镜头 30-60cm

## 目录结构

```
gesture-lab/
├─ index.html   # 页面结构 + MediaPipe CDN 引用
├─ style.css    # 样式
├─ app.js       # 手势识别 + 三个玩法逻辑（有注释）
└─ README.md
```
