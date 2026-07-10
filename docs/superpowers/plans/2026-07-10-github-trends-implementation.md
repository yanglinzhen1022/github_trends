# GitHub 热点追踪器 (GitHub Trends Tracker) 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于纯前端单页应用（Vite + Vanilla JS + Vitest 单元测试）的 GitHub 热点追踪器，允许用户分类、过滤、排序和收藏 Github 热门仓库，并支持填入 Token 提升限流。

**Architecture:** 前端采用 SPA 单页应用设计，使用 Vite 进行本地服务托管与热重载。核心逻辑划分为 API 模块、本地存储收藏模块以及 DOM 渲染控制模块。单元测试使用 Vitest 进行 TDD 开发。

**Tech Stack:** HTML5, Vanilla JavaScript (ES6+), CSS3 (CSS Variables, Flexbox, Grid), Vite, Vitest.

## Global Constraints

* 界面必须采用现代高颜值暗黑模式 + 玻璃拟物化设计，带有 hover 动画与微小动效。
* 代码必须完全自包含，分类筛选全部通过 GitHub Search API 动态计算日期与拼装查询条件完成。
* 敏感配置（如 Token）必须保存在 `localStorage` 中，绝不能硬编码。
* 每个任务完成后，运行测试并通过后再提交代码。

---

### Task 1: 项目基础搭建与开发环境配置

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `src/setup.test.js`

**Interfaces:**
- Consumes: None
- Produces: 开发与测试环境，基础测试用例通过

- [ ] **Step 1: 创建 `package.json` 配置文件**
  编写包含 Vite 和 Vitest 依赖的 package.json。
  ```json
  {
    "name": "github-trends-tracker",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview",
      "test": "vitest run"
    },
    "devDependencies": {
      "vite": "^5.0.0",
      "vitest": "^1.0.0",
      "jsdom": "^22.0.0"
    }
  }
  ```

- [ ] **Step 2: 创建 `vite.config.js` 配置文件**
  ```javascript
  import { defineConfig } from 'vite';

  export default defineConfig({
    test: {
      environment: 'jsdom',
      globals: true
    }
  });
  ```

- [ ] **Step 3: 创建基础验证测试 `src/setup.test.js`**
  ```javascript
  import { describe, it, expect } from 'vitest';

  describe('Environment Setup', () => {
    it('should run tests successfully', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

- [ ] **Step 4: 安装依赖并运行测试**
  运行：`npm install` 随后运行 `npm run test`。
  Expected: PASS `src/setup.test.js`

- [ ] **Step 5: 提交基础环境配置**
  ```bash
  git add package.json vite.config.js src/setup.test.js
  git commit -m "chore: setup vite and vitest development environment"
  ```

---

### Task 2: API 模块与查询拼装逻辑 (TDD)

**Files:**
- Create: `src/api.js`
- Create: `src/api.test.js`

**Interfaces:**
- Consumes: None
- Produces: `calculateDate`, `buildQueryUrl`, `fetchTrendingRepos` 方法

- [ ] **Step 1: 编写 API 模块的测试用例**
  创建 `src/api.test.js` 验证日期计算和查询拼装逻辑。
  ```javascript
  import { describe, it, expect } from 'vitest';
  import { calculateDate, buildQueryUrl } from './api.js';

  describe('API Utility Tests', () => {
    it('should calculate correct past date string', () => {
      const baseDate = new Date('2026-07-10T12:00:00Z');
      expect(calculateDate(1, baseDate)).toBe('2026-07-09');
      expect(calculateDate(7, baseDate)).toBe('2026-07-03');
      expect(calculateDate(30, baseDate)).toBe('2026-06-10');
    });

    it('should build correct query URL for general category', () => {
      const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03');
      expect(url).toContain('q=stars%3A%3E5+created%3A%3E2026-07-03');
      expect(url).toContain('sort=stars');
    });

    it('should build correct query URL for AI category with python filter', () => {
      const url = buildQueryUrl('ai', 'monthly', 'python', '2026-06-10');
      expect(url).toContain('q=topic%3Aai+OR+topic%3Amachine-learning+OR+topic%3Allm+OR+topic%3Adeep-learning+language%3Apython+created%3A%3E2026-06-10');
    });
  });
  ```

- [ ] **Step 2: 运行测试以确保失败**
  运行：`npm run test`
  Expected: FAIL (`calculateDate` and `buildQueryUrl` are not defined)

- [ ] **Step 3: 实现 `src/api.js`**
  ```javascript
  export function calculateDate(daysAgo, baseDate = new Date()) {
    const targetDate = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  export function buildQueryUrl(category, timeRange, language, forceDate = null) {
    const daysMap = { daily: 1, weekly: 7, monthly: 30 };
    const daysAgo = daysMap[timeRange] || 7;
    const dateStr = forceDate || calculateDate(daysAgo);

    let queryParts = [];

    // 分类映射
    if (category === 'ai') {
      queryParts.push('topic:ai OR topic:machine-learning OR topic:llm OR topic:deep-learning');
    } else if (category === 'frontend') {
      queryParts.push('topic:frontend OR topic:react OR topic:vue OR topic:angular OR topic:css');
    } else if (category === 'backend') {
      queryParts.push('topic:backend OR topic:nodejs OR topic:golang OR topic:rust OR topic:python OR topic:java');
    } else if (category === 'devops') {
      queryParts.push('topic:devops OR topic:docker OR topic:kubernetes OR topic:ci-cd');
    } else if (category === 'mobile') {
      queryParts.push('topic:ios OR topic:android OR topic:flutter OR topic:react-native');
    } else if (category === 'general') {
      queryParts.push('stars:>5');
    } else {
      // 自定义分类
      queryParts.push(`topic:${category}`);
    }

    if (language && language.toLowerCase() !== 'all') {
      queryParts.push(`language:${language}`);
    }

    // 排除 Fork，仅拉取原项目
    queryParts.push(`created:>${dateStr}`);

    const q = queryParts.join(' ');
    return `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
  }

  export async function fetchTrendingRepos(url, token = null) {
    const headers = {};
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.items || [];
  }
  ```

- [ ] **Step 4: 重新运行测试以确认全部通过**
  运行：`npm run test`
  Expected: PASS

- [ ] **Step 5: 提交 API 模块代码**
  ```bash
  git add src/api.js src/api.test.js
  git commit -m "feat: implement API client and query builder with unit tests"
  ```

---

### Task 3: 本地存储与收藏模块 (TDD)

**Files:**
- Create: `src/storage.js`
- Create: `src/storage.test.js`

**Interfaces:**
- Consumes: None
- Produces: `saveToken`, `getToken`, `toggleFavorite`, `isFavorite`, `getFavorites`, `addCustomCategory`, `getCustomCategories`

- [ ] **Step 1: 编写 LocalStorage 交互模块的测试**
  ```javascript
  import { describe, it, expect, beforeEach } from 'vitest';
  import { 
    saveToken, getToken, toggleFavorite, isFavorite, getFavorites, 
    addCustomCategory, getCustomCategories 
  } from './storage.js';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('Storage Utility Tests', () => {
    it('should save and get github token', () => {
      saveToken('ghp_test_token');
      expect(getToken()).toBe('ghp_test_token');
    });

    it('should toggle and query favorites correctly', () => {
      const mockRepo = { id: 12345, name: 'react', html_url: 'https://github.com/facebook/react' };
      expect(isFavorite(12345)).toBe(false);
      
      toggleFavorite(mockRepo);
      expect(isFavorite(12345)).toBe(true);
      expect(getFavorites().length).toBe(1);
      
      toggleFavorite(mockRepo);
      expect(isFavorite(12345)).toBe(false);
      expect(getFavorites().length).toBe(0);
    });

    it('should manage custom categories list', () => {
      addCustomCategory('webgpu');
      expect(getCustomCategories()).toContain('webgpu');
    });
  });
  ```

- [ ] **Step 2: 运行测试以确保失败**
  运行：`npm run test`
  Expected: FAIL (storage functions undefined)

- [ ] **Step 3: 实现 `src/storage.js`**
  ```javascript
  export function saveToken(token) {
    if (token) {
      localStorage.setItem('github_pat', token);
    } else {
      localStorage.removeItem('github_pat');
    }
  }

  export function getToken() {
    return localStorage.getItem('github_pat') || '';
  }

  export function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem('favorite_repos') || '[]');
    } catch {
      return [];
    }
  }

  export function isFavorite(repoId) {
    const list = getFavorites();
    return list.some(item => item.id === repoId);
  }

  export function toggleFavorite(repo) {
    let list = getFavorites();
    if (isFavorite(repo.id)) {
      list = list.filter(item => item.id !== repo.id);
    } else {
      list.push(repo);
    }
    localStorage.setItem('favorite_repos', JSON.stringify(list));
  }

  export function getCustomCategories() {
    try {
      return JSON.parse(localStorage.getItem('custom_categories') || '[]');
    } catch {
      return [];
    }
  }

  export function addCustomCategory(categoryName) {
    const list = getCustomCategories();
    const cleanName = categoryName.trim().toLowerCase();
    if (cleanName && !list.includes(cleanName)) {
      list.push(cleanName);
      localStorage.setItem('custom_categories', JSON.stringify(list));
    }
  }
  ```

- [ ] **Step 4: 运行测试验证通过**
  运行：`npm run test`
  Expected: PASS

- [ ] **Step 5: 提交 Storage 模块**
  ```bash
  git add src/storage.js src/storage.test.js
  git commit -m "feat: implement local storage utilities for token, favorites and custom categories"
  ```

---

### Task 4: CSS 样式表 (高级暗黑玻璃拟物化设计)

**Files:**
- Create: `styles.css`

**Interfaces:**
- Consumes: CSS variables, flexbox/grid layout design
- Produces: 全套美观响应式的暗黑模式 CSS 样式，包含粒子卡片悬停效果、模态框、载入骨架屏和微动效。

- [ ] **Step 1: 创建 `styles.css` 编写基础与卡片样式**
  包含全局颜色定义、卡片微光和毛玻璃效果。
  ```css
  :root {
    --bg-color: #0b0f19;
    --card-bg: rgba(22, 27, 34, 0.4);
    --card-border: rgba(56, 139, 253, 0.15);
    --card-border-hover: rgba(56, 139, 253, 0.4);
    --text-primary: #f0f6fc;
    --text-secondary: #8b949e;
    --accent: #58a6ff;
    --accent-glow: rgba(88, 166, 255, 0.3);
    --danger: #f85149;
    --success: #3fb950;
    --font-stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: var(--bg-color);
    background-image: 
      radial-gradient(at 10% 10%, rgba(31, 38, 135, 0.15) 0px, transparent 50%),
      radial-gradient(at 90% 90%, rgba(98, 0, 234, 0.1) 0px, transparent 50%);
    color: var(--text-primary);
    font-family: var(--font-stack);
    line-height: 1.6;
    padding-bottom: 40px;
    min-height: 100vh;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 5%;
    background: rgba(13, 17, 23, 0.7);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    font-size: 24px;
    font-weight: 800;
    background: linear-gradient(45deg, #58a6ff, #bc85ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    cursor: pointer;
  }

  .btn {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    color: var(--text-primary);
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .btn:hover {
    border-color: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
    transform: translateY(-1px);
  }

  .btn-primary {
    background: linear-gradient(45deg, #1f6feb, #8e2de2);
    border: none;
  }

  .btn-primary:hover {
    box-shadow: 0 0 15px rgba(142, 45, 226, 0.5);
  }

  main {
    max-width: 1400px;
    margin: 30px auto;
    padding: 0 20px;
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 30px;
  }

  @media (max-width: 900px) {
    main {
      grid-template-columns: 1fr;
    }
  }

  .sidebar {
    background: var(--card-bg);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(12px);
    height: fit-content;
  }

  .sidebar h3 {
    margin-bottom: 15px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-secondary);
  }

  .category-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-item {
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .category-item:hover, .category-item.active {
    background: rgba(56, 139, 253, 0.15);
    color: var(--accent);
  }

  .custom-category-box {
    margin-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    padding-top: 20px;
  }

  .custom-category-box input {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 8px;
    outline: none;
  }

  .custom-category-box input:focus {
    border-color: var(--accent);
  }

  .content-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
    background: var(--card-bg);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 15px 20px;
    backdrop-filter: blur(12px);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .filter-group label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .filter-group select {
    background: rgba(13, 17, 23, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    padding: 8px 14px;
    border-radius: 6px;
    outline: none;
    cursor: pointer;
  }

  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .repo-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    padding: 24px;
    backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }

  .repo-card:hover {
    border-color: var(--card-border-hover);
    transform: translateY(-5px);
    box-shadow: 0 8px 24px rgba(88, 166, 255, 0.1);
  }

  .repo-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #58a6ff, #bc85ff);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .repo-card:hover::before {
    opacity: 1;
  }

  .repo-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
    word-break: break-all;
  }

  .repo-title a {
    color: var(--text-primary);
    text-decoration: none;
  }

  .repo-title a:hover {
    color: var(--accent);
  }

  .repo-desc {
    color: var(--text-secondary);
    font-size: 14px;
    margin-bottom: 20px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    height: 66px;
  }

  .repo-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: auto;
  }

  .repo-stats {
    display: flex;
    gap: 15px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .repo-lang {
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .favorite-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 18px;
    cursor: pointer;
    transition: color 0.2s;
  }

  .favorite-btn.active {
    color: #e3b341;
  }

  /* Modal Styles */
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }

  .modal.active {
    opacity: 1;
    pointer-events: auto;
  }

  .modal-content {
    background: #161b22;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 30px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    position: relative;
  }

  .modal-close {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 20px;
    cursor: pointer;
  }

  .modal-title {
    font-size: 20px;
    margin-bottom: 15px;
    font-weight: 700;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .form-group input {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
    padding: 10px 14px;
    border-radius: 8px;
    outline: none;
  }

  .form-group input:focus {
    border-color: var(--accent);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  /* Skeleton Loading */
  .skeleton {
    animation: skeleton-glow 1.5s ease-in-out infinite;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.1) 37%, rgba(255, 255, 255, 0.05) 63%);
    background-size: 400% 100%;
    border-radius: 4px;
  }

  @keyframes skeleton-glow {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .skeleton-title {
    height: 24px;
    width: 60%;
    margin-bottom: 12px;
  }

  .skeleton-desc {
    height: 60px;
    width: 100%;
    margin-bottom: 20px;
  }

  .skeleton-meta {
    height: 18px;
    width: 40%;
  }

  .error-message {
    text-align: center;
    padding: 40px;
    grid-column: 1 / -1;
    background: rgba(248, 81, 73, 0.05);
    border: 1px solid rgba(248, 81, 73, 0.2);
    border-radius: 12px;
  }

  .error-message p {
    color: var(--danger);
    margin-bottom: 15px;
    font-weight: 500;
  }
  ```

- [ ] **Step 2: 提交样式表**
  ```bash
  git add styles.css
  git commit -m "style: design glassmorphism dark-themed style system with skeleton screen support"
  ```

---

### Task 5: 前端 DOM 交互与主渲染模块 (App Logic)

**Files:**
- Create: `index.html`
- Create: `src/app.js`

**Interfaces:**
- Consumes: `src/api.js`, `src/storage.js`, `styles.css`
- Produces: 完整的交互网页，能够加载、渲染数据、响应侧边栏、管理 Token 配置与仓库收藏。

- [ ] **Step 1: 创建 `index.html` 页面基础结构**
  ```html
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Hotspots Tracker - GitHub 热点趋势</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <header>
      <div class="logo" id="logo-btn">🚀 GitHub Hotspots</div>
      <div>
        <button class="btn" id="fav-toggle-view">⭐ 我的收藏</button>
        <button class="btn btn-primary" id="token-btn">🔑 配置 Token</button>
      </div>
    </header>

    <main>
      <div class="sidebar">
        <h3>热门领域分类</h3>
        <ul class="category-list" id="category-container">
          <li class="category-item active" data-id="general">✨ 综合趋势</li>
          <li class="category-item" data-id="ai">🤖 AI / 机器学习</li>
          <li class="category-item" data-id="frontend">🌐 Web 前端</li>
          <li class="category-item" data-id="backend">⚙️ 后端 / 系统</li>
          <li class="category-item" data-id="devops">🛠️ 开发者工具</li>
          <li class="category-item" data-id="mobile">📱 移动端开发</li>
        </ul>
        <div class="custom-category-box">
          <h3>添加自定义 Topic</h3>
          <input type="text" id="custom-input" placeholder="输入例如: webgpu, wasm">
          <button class="btn" id="custom-add-btn" style="width: 100%;">添加</button>
        </div>
      </div>

      <div class="content-section">
        <div class="filters">
          <div class="filter-group">
            <label for="time-range">时间跨度:</label>
            <select id="time-range">
              <option value="daily">今日热门 (Daily)</option>
              <option value="weekly" selected>本周热门 (Weekly)</option>
              <option value="monthly">本月热门 (Monthly)</option>
            </select>
          </div>

          <div class="filter-group">
            <label for="lang-select">编程语言:</label>
            <select id="lang-select">
              <option value="all">全部 (All)</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="cpp">C++</option>
            </select>
          </div>
        </div>

        <div class="grid-container" id="repos-grid">
          <!-- 卡片/加载中骨架屏动态渲染区 -->
        </div>
      </div>
    </main>

    <!-- Token 配置 Modal -->
    <div class="modal" id="token-modal">
      <div class="modal-content">
        <button class="modal-close" id="token-modal-close">×</button>
        <h3 class="modal-title">配置 GitHub Token</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 15px;">
          设置您的 GitHub Personal Access Token 可以免去未登录限流限制。此 Token 仅保存在您本地的 localStorage 中。
        </p>
        <div class="form-group">
          <label for="token-input">GitHub Token (PAT)</label>
          <input type="password" id="token-input" placeholder="ghp_...">
        </div>
        <div class="form-actions">
          <button class="btn" id="token-clear-btn" style="color: var(--danger);">清除</button>
          <button class="btn btn-primary" id="token-save-btn">保存</button>
        </div>
      </div>
    </div>

    <script type="module" src="./src/app.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 2: 实现 `src/app.js` 主控制模块**
  管理应用状态、拉取逻辑和渲染逻辑。
  ```javascript
  import { buildQueryUrl, fetchTrendingRepos } from './api.js';
  import { 
    saveToken, getToken, toggleFavorite, isFavorite, getFavorites, 
    addCustomCategory, getCustomCategories 
  } from './storage.js';

  // 应用当前状态
  const state = {
    currentCategory: 'general',
    timeRange: 'weekly',
    language: 'all',
    showingFavorites: false
  };

  // DOM 元素引用
  const reposGrid = document.getElementById('repos-grid');
  const tokenModal = document.getElementById('token-modal');
  const tokenInput = document.getElementById('token-input');
  const categoryContainer = document.getElementById('category-container');
  const customInput = document.getElementById('custom-input');
  const timeRangeSelect = document.getElementById('time-range');
  const langSelect = document.getElementById('lang-select');

  // 初始化应用程序
  document.addEventListener('DOMContentLoaded', () => {
    initCategories();
    initEventListeners();
    loadRepos();
  });

  // 初始化分类栏（加载自定义分类）
  function initCategories() {
    // 移除已有的自定义分类 DOM
    const items = categoryContainer.querySelectorAll('.category-item');
    items.forEach(item => {
      if (item.classList.contains('custom-item')) {
        item.remove();
      }
    });

    const customs = getCustomCategories();
    customs.forEach(cat => {
      const li = document.createElement('li');
      li.className = 'category-item custom-item';
      li.dataset.id = cat;
      li.textContent = `# ${cat}`;
      categoryContainer.appendChild(li);
    });
  }

  // 绑定事件监听
  function initEventListeners() {
    // 侧边栏分类点击
    categoryContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.category-item');
      if (!item) return;

      categoryContainer.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      state.currentCategory = item.dataset.id;
      state.showingFavorites = false;
      loadRepos();
    });

    // 过滤与排序改变
    timeRangeSelect.addEventListener('change', (e) => {
      state.timeRange = e.target.value;
      if (!state.showingFavorites) loadRepos();
    });

    langSelect.addEventListener('change', (e) => {
      state.language = e.target.value;
      if (!state.showingFavorites) loadRepos();
    });

    // 我的收藏按钮切换
    document.getElementById('fav-toggle-view').addEventListener('click', (e) => {
      state.showingFavorites = !state.showingFavorites;
      if (state.showingFavorites) {
        e.target.classList.add('btn-primary');
        categoryContainer.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
        renderFavorites();
      } else {
        e.target.classList.remove('btn-primary');
        // 回到综合趋势
        const generalItem = categoryContainer.querySelector('[data-id="general"]');
        generalItem.classList.add('active');
        state.currentCategory = 'general';
        loadRepos();
      }
    });

    // 添加自定义分类
    document.getElementById('custom-add-btn').addEventListener('click', () => {
      const val = customInput.value.trim();
      if (val) {
        addCustomCategory(val);
        initCategories();
        customInput.value = '';
      }
    });

    // Token Modal 弹出/关闭/保存
    document.getElementById('token-btn').addEventListener('click', () => {
      tokenInput.value = getToken();
      tokenModal.classList.add('active');
    });

    document.getElementById('token-modal-close').addEventListener('click', () => {
      tokenModal.classList.remove('active');
    });

    document.getElementById('token-save-btn').addEventListener('click', () => {
      saveToken(tokenInput.value.trim());
      tokenModal.classList.remove('active');
      if (!state.showingFavorites) loadRepos();
    });

    document.getElementById('token-clear-btn').addEventListener('click', () => {
      saveToken('');
      tokenInput.value = '';
      tokenModal.classList.remove('active');
      if (!state.showingFavorites) loadRepos();
    });

    // 点击 Logo 返回主页
    document.getElementById('logo-btn').addEventListener('click', () => {
      state.showingFavorites = false;
      document.getElementById('fav-toggle-view').classList.remove('btn-primary');
      categoryContainer.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
      categoryContainer.querySelector('[data-id="general"]').classList.add('active');
      state.currentCategory = 'general';
      loadRepos();
    });
  }

  // 渲染骨架屏加载状态
  function renderSkeletons() {
    reposGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const card = document.createElement('div');
      card.className = 'repo-card';
      card.innerHTML = `
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-desc"></div>
        <div class="skeleton skeleton-meta"></div>
      `;
      reposGrid.appendChild(card);
    }
  }

  // 加载仓库数据
  async function loadRepos() {
    renderSkeletons();
    const token = getToken();
    const url = buildQueryUrl(state.currentCategory, state.timeRange, state.language);

    try {
      const repos = await fetchTrendingRepos(url, token);
      renderRepos(repos);
    } catch (err) {
      renderError(err.message);
    }
  }

  // 渲染收藏列表
  function renderFavorites() {
    const list = getFavorites();
    if (list.length === 0) {
      reposGrid.innerHTML = `
        <div class="error-message" style="background: rgba(255, 255, 255, 0.02); border-color: rgba(255,255,255,0.05);">
          <p style="color: var(--text-secondary);">您还没有收藏任何仓库哦~</p>
        </div>
      `;
    } else {
      renderRepos(list);
    }
  }

  // 渲染卡片视图列表
  function renderRepos(repos) {
    reposGrid.innerHTML = '';
    if (repos.length === 0) {
      reposGrid.innerHTML = `
        <div class="error-message" style="background: rgba(255, 255, 255, 0.02); border-color: rgba(255,255,255,0.05);">
          <p style="color: var(--text-secondary);">没有找到匹配的热点项目，请尝试更换时间范围或语言。</p>
        </div>
      `;
      return;
    }

    repos.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'repo-card';

      const isFav = isFavorite(repo.id);
      const favClass = isFav ? 'active' : '';

      const name = repo.full_name || repo.name;
      const desc = repo.description || '暂无描述。';
      const lang = repo.language || 'Markdown';
      const stars = repo.stargazers_count || 0;
      const forks = repo.forks_count || 0;

      card.innerHTML = `
        <button class="favorite-btn ${favClass}" data-id="${repo.id}">★</button>
        <div class="repo-title">
          <a href="${repo.html_url}" target="_blank">${name}</a>
        </div>
        <div class="repo-desc" title="${desc}">${desc}</div>
        <div class="repo-meta">
          <span class="repo-lang">${lang}</span>
          <div class="repo-stats">
            <div class="stat-item">⭐ ${stars}</div>
            <div class="stat-item">🍴 ${forks}</div>
          </div>
        </div>
      `;

      // 收藏按钮点击逻辑
      card.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(repo);
        const button = e.target;
        button.classList.toggle('active');
        if (state.showingFavorites) {
          renderFavorites();
        }
      });

      reposGrid.appendChild(card);
    });
  }

  // 错误信息显示
  function renderError(message) {
    reposGrid.innerHTML = `
      <div class="error-message">
        <p>⚠️ 请求异常: ${message}</p>
        <p style="font-size: 13px; color: var(--text-secondary);">如果触发了 GitHub API 的速率限制，请点击顶部 "配置 Token" 按钮填入您的 GitHub Token 以恢复访问。</p>
        <button class="btn" id="retry-btn">重新尝试</button>
      </div>
    `;
    document.getElementById('retry-btn').addEventListener('click', loadRepos);
  }
  ```

- [ ] **Step 3: 提交前端交互实现**
  ```bash
  git add index.html src/app.js
  git commit -m "feat: design html structure and implement core frontend controller in app.js"
  ```

---

### Task 6: 联调验证与上线确认

**Files:**
- Modify: None

**Interfaces:**
- Consumes: 整个系统
- Produces: 稳定运行的高分值 GitHub 热点项目收集与展示网页

- [ ] **Step 1: 运行本地开发服务**
  运行：`npm run dev`
  确保控制台无报错输出，并且显示启动地址（如 `http://localhost:5173`）。

- [ ] **Step 2: 验证主界面与分类展示**
  使用浏览器打开启动的网页：
  - 点击“综合趋势”、“AI / 机器学习”，检查是否有数据加载并渲染。
  - 调整“时间跨度”为“今日热门”，查看是否能顺利拉取。
  - 调整“编程语言”为“Rust”，确认展示结果的主语言过滤为 Rust。

- [ ] **Step 3: 验证自定义分类与本地存储**
  - 输入“webgpu”并点击添加，确认侧边栏多了 `# webgpu` 分类。
  - 点击该自定义分类，核对查询结果。
  - 刷新网页，确认 `# webgpu` 依旧保存在侧边栏（证明 LocalStorage 读取正常）。

- [ ] **Step 4: 验证收藏与 Token 配置**
  - 在卡片上点击收藏（黄色星星亮起）。
  - 点击右上角“我的收藏”按钮，检查是否仅展示刚才收藏的仓库。
  - 点击“配置 Token”，输入测试的 Token 并保存。
  - 再次刷新页面尝试获取数据，确保接口调用无异常。

- [ ] **Step 5: 提交最终完成标志**
  ```bash
  git commit --allow-empty -m "release: github trends tracker complete and verified"
  ```
