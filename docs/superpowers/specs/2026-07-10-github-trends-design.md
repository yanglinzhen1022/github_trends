# GitHub 热点追踪器 (GitHub Trends Tracker) 设计文档

## 1. 项目简介
本项目是一个纯前端单页应用 (SPA)，用于实时收集、分类和展示 GitHub 的热门开源项目。通过直接调用 GitHub REST API，帮助用户快速了解不同技术领域（如 AI、Web 开发、系统编程等）的最新趋势，支持根据 Star 数、Fork 数进行多维度的筛选和排序。

## 2. 核心功能
* **热点分类展示**：
  * 综合趋势 (General Trends)
  * AI & 机器学习 (AI & Machine Learning)
  * Web 前端 (Frontend)
  * 后端与系统 (Backend & Systems)
  * 开发者工具与 DevOps (DevOps & Tools)
  * 移动端开发 (Mobile Dev)
* **自定义分类**：用户可输入关键字或 Topic 自定义添加分类。
* **多维度筛选与排序**：
  * 按时间跨度筛选：今日 (Daily)、本周 (Weekly)、本月 (Monthly)。
  * 按编程语言过滤：All、Python、JavaScript、TypeScript、Go、Rust、C++ 等。
  * 按排序指标：Star 增长数、Fork 增长数。
* **README 预览与仓库详情**：
  * 支持卡片内直接展开阅读 README 简述。
  * 收藏功能：用户可本地收藏感兴趣的仓库。
* **API 额度提升 (GitHub Token)**：
  * 提供 Token 输入入口，并保存在 `localStorage` 中，以提升 GitHub API 速率限制。

## 3. 技术栈
* **前端骨架**：HTML5 + Vanilla JavaScript (ES6+)。
* **样式表现**：CSS3 (使用原生 CSS 构建暗黑主题 + 玻璃拟物化设计)。
* **数据源**：GitHub REST API (`https://api.github.com/search/repositories`)。
* **构建部署**：零构建步骤，直接支持 GitHub Pages。

## 4. UI 界面设计与交互
* **配色方案**：
  * 背景色：深色系调色板（`#0d1117` 和 `#161b22`，仿 GitHub 暗黑主题，结合紫色/蓝色渐变发光阴影）。
  * 卡片：半透明模糊背景（`backdrop-filter: blur(12px)`），配以极细的亮色边框。
  * 按钮与交互：渐变色背景与悬浮发光效果。
* **响应式布局**：
  * 移动端：自适应单列卡片流与滑动分类栏。
  * 桌面端：多列网格 (Grid) 布局。

## 5. 数据抓取与分类逻辑
我们使用 GitHub Search API 动态构造查询参数：
* **API 请求格式**：
  `https://api.github.com/search/repositories?q={query}+created:>{date}&sort={sort}&order=desc&per_page=30`
* **查询映射**：
  * **AI/ML**: `q=topic:ai OR topic:machine-learning OR topic:llm OR topic:deep-learning`
  * **Frontend**: `q=topic:frontend OR topic:react OR topic:vue OR topic:angular OR topic:css`
  * **Backend**: `q=topic:backend OR topic:nodejs OR topic:golang OR topic:rust OR topic:python OR topic:java`
  * **DevOps**: `q=topic:devops OR topic:docker OR topic:kubernetes OR topic:ci-cd`
  * **Mobile**: `q=topic:ios OR topic:android OR topic:flutter OR topic:react-native`
  * **综合**: `q=stars:>5`（仅依靠创建时间过滤）
* **时间计算**：
  * 今日热门 (Daily)：`DATE = 今天 - 1天`
  * 本周热门 (Weekly)：`DATE = 今天 - 7天`
  * 本月热门 (Monthly)：`DATE = 今天 - 30天`

## 6. 异常与错误处理
* **限流提示 (Rate Limit)**：当 API 返回 403 状态码时，在界面上弹出友好提示，引导用户填入 GitHub Personal Access Token (PAT)。
* **空数据提示**：若某个分类或过滤条件下无结果，展示空状态插图与提示。
* **网络异常**：提供重试按钮。

## 7. 测试方案
* **功能测试**：验证 Token 配置是否生效、分类切换是否正确发起 API 请求。
* **响应式测试**：使用 Chrome DevTools 检查在不同屏幕尺寸下的布局表现。
