# 🚀 GitHub Hotspots Tracker (GitHub 热点趋势追踪器)

这是一个基于纯前端 SPA 架构开发的 GitHub 热门项目浏览器。它通过高效对接 GitHub Search API，实现动态收集、过滤、以及分类展示当前最新、最活跃的高星及高 Fork 热门项目，帮助开发者和研究人员快速捕捉各领域最新的技术风向（如 AI、Web 前端、后端系统、区块链等）。

👉 **在线演示地址**：[https://yanglinzhen1022.github.io/github_trends/](https://yanglinzhen1022.github.io/github_trends/)

---

## ✨ 功能亮点

* **🌌 现代暗黑玻璃拟物化设计**：采用前沿的 CSS 玻璃流光卡片设计，搭配流畅的渐变色和 Hover 动效，视觉体验极佳。
* **📊 10 大核心领域分类**：
  * ✨ 综合趋势、🤖 AI / 机器学习、🌐 Web 前端、⚙️ 后端 / 系统、🛠️ 开发者工具 (DevOps)、📱 移动端开发、💾 数据库 / 存储、🛡️ 网络安全 / 渗透、🎮 游戏引擎 / 开发、⛓️ 区块链 / Web3。
* **🔍 自定义 Topic 分类**：支持一键添加任何您关心的 Topic（例如：`webgpu`、`wasm`、`redis`），侧边栏会自动渲染并立即切换加载。
* **🛠️ 灵活的过滤与排序**：
  * **时间跨度**：支持今日热门 (Daily)、本周热门 (Weekly)、本月热门 (Monthly) 的动态日期计算。
  * **语言过滤**：内置 Python、JavaScript、TypeScript、Go、Rust、C++ 等常用编程语言的精确检索。
  * **多维排序**：支持按 Star 数量 或 Fork 数量进行多维度降序排列。
* **📖 README 快速预览**：卡片内置预览按钮，支持在不跳出页面的情况下，以 Modal 形式即时异步拉取、解码并展示该仓库的 README 简要说明。
* **⭐ 本地收藏夹**：利用浏览器 `localStorage` 自动管理收藏列表，支持离线持久化查看。
* **🔒 安全的凭证配置**：支持在网页端直接配置您的 GitHub Personal Access Token 并保存在本地浏览器中，绝无任何后端硬编码泄露风险，并能直接将 API 限制提升至 5000 次/小时。

---

## 🛠️ 技术栈

* **核心结构**：HTML5 语义化标签 + Vanilla JavaScript (ES6+)
* **样式设计**：原生 CSS3 (包含 Flexbox/Grid 布局、CSS 变量、流光玻璃拟物化特效)
* **构建与构建测试**：Vite + Vitest (单元测试覆盖率完整)
* **API 服务**：GitHub REST Search API v3 (已针对 GitHub API 的括号字符限制及单个查询 `OR` 操作符 <= 5 个的硬性规范进行了深度查询拼装优化，彻底避免 422 报错)

---

## 💻 本地开发与运行步骤

在您的本地环境中运行本项目非常简单：

### 1. 克隆项目并安装依赖
```bash
# 进入项目目录
cd github_trends

# 安装构建与测试依赖
npm install
```

### 2. 启动本地开发服务器
```bash
npm run dev
```
启动后，在浏览器中打开命令行输出的本地链接（默认为 `http://localhost:5173/`）即可进行开发与预览。

### 3. 运行自动化测试
项目配备了完整的单元测试（包含 API URL 拼接验证、HTML 安全转义验证、本地存储操作验证等）：
```bash
npm run test
```

### 4. 生产环境构建打包
```bash
npm run build
```
构建出的静态资源将输出在 `dist/` 文件夹中。

---

## 🚀 一键部署至 GitHub Pages

本项目已经配置了**全自动的 GitHub Pages 部署流水线**（利用 GitHub Actions）。只要您将代码推送到 GitHub，云端会自动帮您打包并发布网站。

### 部署步骤：

1. **在 GitHub 上创建一个空白仓库**：
   * 登录您的 GitHub 账号，创建一个名为 `github_trends` 的新仓库。**不要**勾选初始化 README 等选项。

2. **关联并推送本地代码到 GitHub**：
   在项目根目录运行以下终端命令（请将 `<your-username>` 替换为您的真实 GitHub 用户名）：
   ```bash
   # 关联远程仓库
   git remote add origin https://github.com/<your-username>/github_trends.git
   
   # 推送代码至 main 分支
   git push -u origin main
   ```

3. **开启 GitHub Pages 权限**：
   * 代码推送成功后，进入您的 GitHub 仓库网页页面。
   * 点击顶部的 **Settings** -> 左侧导航栏 **Pages**。
   * 在 **Build and deployment** -> **Source** 下，将默认的 `Deploy from a branch` 改为 **`GitHub Actions`**。

4. **查看实时网址**：
   * 点击仓库顶部的 **Actions** 可以看到 `Deploy to GitHub Pages` 正在编译部署。
   * 部署完成后，在 Actions 页面或 Pages 页面即可获得您的专属在线访问链接！
