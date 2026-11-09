import { buildQueryUrl, calculateDate, fetchTrendingRepos, fetchStarGrowth } from './api.js';
import { parseHash, serializeState } from './routing.js';
import {
  saveToken, getToken, getTokenSource, toggleFavorite, isFavorite, getFavorites,
  addCustomCategory, isValidTopic, getCustomCategories, removeCustomCategory
} from './storage.js';

// 应用当前状态
const state = {
  currentCategory: 'general',
  timeRange: 'weekly',
  language: 'all',
  sortBy: 'stars',
  trendMode: 'new', // 'new' 新秀模式 | 'growth' 增量模式
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
const growthStatusEl = document.getElementById('growth-status');

// 当前进行中的请求控制器（用于取消过期的竞态请求）
let requestController = null;

// 增量模式的成本控制：候选上限 + 并发池 + 会话内缓存，
// 避免一次刷新产生几十上百个 Stargazers 请求而瞬间耗尽配额。
const GROWTH_CANDIDATE_LIMIT = 15;
const GROWTH_CONCURRENCY = 4;
const GROWTH_CACHE_KEY = 'growth_cache';

function loadGrowthCache() {
  try {
    const cache = JSON.parse(sessionStorage.getItem(GROWTH_CACHE_KEY) || '{}');
    return (cache && typeof cache === 'object' && !Array.isArray(cache)) ? cache : {};
  } catch {
    return {};
  }
}

function saveGrowthCache(cache, sinceDate) {
  // 只保留当前窗口的缓存条目，避免 sessionStorage 无限膨胀
  const suffix = `|${sinceDate}`;
  const filtered = {};
  Object.keys(cache).forEach(key => {
    if (key.endsWith(suffix)) {
      filtered[key] = cache[key];
    }
  });
  try {
    sessionStorage.setItem(GROWTH_CACHE_KEY, JSON.stringify(filtered));
  } catch {
    // 隐私模式 / 配额已满时忽略
  }
}

/**
 * 以受限并发统计候选仓库在窗口期内的真实新增 Star 数。
 * 遇到 403（配额耗尽）会停止发起新请求并返回已统计的部分结果；
 * 权限不足的 403 会单独标记为 permissionDenied。
 * @param {Array} repos - 候选仓库列表（已按搜索排序截取）。
 * @param {string} sinceDate - 窗口起始日期 (YYYY-MM-DD)。
 * @param {string} token - GitHub Token（可为空）。
 * @param {AbortSignal} signal - 取消信号。
 * @param {Function} [onProgress] - 进度回调 (done, total)。
 * @returns {Promise<{growthMap: Object, rateLimited: boolean, permissionDenied: boolean}>}
 */
async function computeGrowthRanking(repos, sinceDate, token, signal, onProgress) {
  const cache = loadGrowthCache();
  const growthMap = {};
  const pending = [];

  repos.forEach(repo => {
    const key = `${repo.full_name}|${sinceDate}`;
    const cached = cache[key];
    if (typeof cached === 'number') {
      growthMap[repo.full_name] = cached;
    } else {
      pending.push(repo);
    }
  });

  const total = repos.length;
  let done = total - pending.length;
  let rateLimited = false;
  let permissionDenied = false;
  let nextIndex = 0;

  if (onProgress) onProgress(done, total);

  const worker = async () => {
    while (nextIndex < pending.length && !rateLimited && !permissionDenied) {
      const repo = pending[nextIndex++];
      try {
        const count = await fetchStarGrowth(repo.full_name, sinceDate, token, signal);
        growthMap[repo.full_name] = count;
        cache[`${repo.full_name}|${sinceDate}`] = count;
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
        const msg = String((err && err.message) || '');
        if (msg.includes('403')) {
          if (msg.toLowerCase().includes('rate limit')) {
            rateLimited = true; // 配额耗尽，不再发起新请求
          } else {
            permissionDenied = true; // Token 权限不足（常见于 Fine-grained PAT 未勾选只读权限）
          }
        }
        growthMap[repo.full_name] = 0;
      }
      done += 1;
      if (onProgress) onProgress(done, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(GROWTH_CONCURRENCY, pending.length) }, () => worker())
  );

  saveGrowthCache(cache, sinceDate);
  return { growthMap, rateLimited, permissionDenied };
}

function showGrowthStatus(text) {
  if (!growthStatusEl) return;
  growthStatusEl.textContent = text;
  growthStatusEl.hidden = false;
}

function hideGrowthStatus() {
  if (!growthStatusEl) return;
  growthStatusEl.hidden = true;
  growthStatusEl.textContent = '';
}

/**
 * Reads the remaining unauthenticated core quota via the free /rate_limit
 * endpoint (this call itself does not count against the limit).
 * @returns {Promise<number|null>} Remaining requests this hour, or null when
 *          the probe fails (in which case we proceed optimistically).
 */
async function getRemainingCoreQuota(signal) {
  try {
    const response = await fetch('https://api.github.com/rate_limit', { signal });
    if (!response.ok) return null;
    const data = await response.json();
    const remaining = data && data.resources && data.resources.core && data.resources.core.remaining;
    return typeof remaining === 'number' ? remaining : null;
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return null;
  }
}

// 初始化应用程序
document.addEventListener('DOMContentLoaded', () => {
  applyHashToState();
  syncFilterSelects();
  initCategories();
  highlightCurrentCategory();
  updateTokenButton();
  initEventListeners();
  loadRepos();
});

// 根据是否已保存 Token 更新顶部按钮文字，让用户一眼看出 Token 状态
function updateTokenButton() {
  const btn = document.getElementById('token-btn');
  if (!btn) return;
  btn.textContent = getToken() ? '🔑 Token ✓' : '🔑 配置 Token';
}

// 从 URL hash 恢复状态（如 #/ai/daily/python?sort=forks&mode=growth）
function applyHashToState() {
  const parsed = parseHash(window.location.hash);
  if (!parsed) return;
  state.currentCategory = parsed.category;
  state.timeRange = parsed.timeRange;
  state.language = parsed.language;
  state.sortBy = parsed.sortBy;
  state.trendMode = parsed.trendMode;
}

// 将当前筛选状态写入 URL hash（省略默认值），并保持浏览器历史记录
function syncHash() {
  const newHash = serializeState(
    state.currentCategory,
    state.timeRange,
    state.language,
    state.sortBy,
    state.trendMode
  );
  if (newHash !== window.location.hash) {
    history.pushState(null, '', newHash);
  }
}

// 同步下拉框显示与当前状态
function syncFilterSelects() {
  timeRangeSelect.value = state.timeRange;
  langSelect.value = state.language;
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = state.sortBy;
  }
  const trendModeSelect = document.getElementById('trend-mode');
  if (trendModeSelect) {
    trendModeSelect.value = state.trendMode;
  }
}

// 高亮侧边栏中当前分类项（安全遍历比对，避免选择器注入）
function highlightCurrentCategory() {
  const items = Array.from(categoryContainer.querySelectorAll('.category-item'));
  const target = items.find(el => el.dataset.id === state.currentCategory);
  if (!target) return;
  items.forEach(el => el.classList.remove('active'));
  target.classList.add('active');
}

// 初始化分类栏（加载自定义分类）
function initCategories() {
  // 移除已有的自定义分类 DOM
  const items = categoryContainer.querySelectorAll('.category-item');
  items.forEach(item => {
    if (item.classList.contains('custom-item')) {
      item.remove();
    }
  });

  // 过滤掉历史上未校验而存入的非法 Topic，避免点击后拼出非法查询
  const customs = getCustomCategories().filter(isValidTopic);
  customs.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item custom-item';
    li.dataset.id = cat;
    li.textContent = `# ${cat}`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'category-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = '删除该分类';
    deleteBtn.setAttribute('aria-label', `删除自定义分类 ${cat}`);
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCustomCategory(cat);
      initCategories();
      // 若删除的是当前分类，回退到综合趋势
      if (state.currentCategory === cat) {
        state.currentCategory = 'general';
        state.showingFavorites = false;
        document.getElementById('fav-toggle-view').classList.remove('btn-primary');
        highlightCurrentCategory();
        loadRepos();
      }
    });
    li.appendChild(deleteBtn);

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
    
    // 重置收藏按钮的激活状态
    document.getElementById('fav-toggle-view').classList.remove('btn-primary');
    
    loadRepos();
  });

  // 过滤与排序改变
  timeRangeSelect.addEventListener('change', (e) => {
    state.timeRange = e.target.value;
    if (!state.showingFavorites) loadRepos();
  });

  // 趋势模式切换（新秀/增量）
  const trendModeSelect = document.getElementById('trend-mode');
  if (trendModeSelect) {
    trendModeSelect.addEventListener('change', (e) => {
      state.trendMode = e.target.value === 'growth' ? 'growth' : 'new';
      if (!state.showingFavorites) loadRepos();
    });
  }

  langSelect.addEventListener('change', (e) => {
    state.language = e.target.value;
    if (!state.showingFavorites) loadRepos();
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      if (!state.showingFavorites) loadRepos();
    });
  }

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
      if (generalItem) {
        generalItem.classList.add('active');
      }
      state.currentCategory = 'general';
      loadRepos();
    }
  });

  // 添加自定义分类
  const customHintEl = document.getElementById('custom-input-hint');
  const showCustomHint = (msg) => {
    if (customHintEl) {
      customHintEl.textContent = msg;
      customHintEl.hidden = false;
    }
  };
  const clearCustomHint = () => {
    if (customHintEl) {
      customHintEl.textContent = '';
      customHintEl.hidden = true;
    }
  };

  const handleAddCustom = () => {
    const val = customInput.value.trim().toLowerCase();
    if (!val) return;

    if (!isValidTopic(val)) {
      showCustomHint('Topic 仅支持小写字母、数字和连字符，长度 1-50，且需以字母或数字开头。');
      return;
    }
    if (getCustomCategories().includes(val)) {
      showCustomHint(`#${val} 已存在于分类列表中。`);
      return;
    }
    if (!addCustomCategory(val)) {
      showCustomHint('保存失败，请稍后重试。');
      return;
    }
    clearCustomHint();

    initCategories();
    customInput.value = '';

    // Auto-switch to the newly added custom category
    state.currentCategory = val;
    state.showingFavorites = false;

    // Reset favorites button styling
    document.getElementById('fav-toggle-view').classList.remove('btn-primary');

    // Update sidebar active class (safe: iterate and compare, no selector interpolation)
    categoryContainer.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    const newItem = Array.from(categoryContainer.querySelectorAll('.category-item'))
      .find(el => el.dataset.id === val);
    if (newItem) {
      newItem.classList.add('active');
    }

    loadRepos();
  };

  document.getElementById('custom-add-btn').addEventListener('click', handleAddCustom);

  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddCustom();
    }
  });

  // Token Modal 弹出/关闭/保存（保存时即时验证 Token 是否有效）
  const sessionTokenCheckbox = document.getElementById('token-session-only');
  const tokenVerifyHint = document.getElementById('token-verify-hint');
  const tokenBtn = document.getElementById('token-btn');

  const showVerifyHint = (text, isError) => {
    if (!tokenVerifyHint) return;
    tokenVerifyHint.textContent = text;
    tokenVerifyHint.classList.toggle('success', !isError);
    tokenVerifyHint.hidden = false;
  };

  const resetVerifyHint = () => {
    if (!tokenVerifyHint) return;
    tokenVerifyHint.textContent = '';
    tokenVerifyHint.classList.remove('success');
    tokenVerifyHint.hidden = true;
  };

  tokenBtn.addEventListener('click', () => {
    tokenInput.value = getToken();
    if (sessionTokenCheckbox) {
      sessionTokenCheckbox.checked = getTokenSource() === 'session';
    }
    resetVerifyHint();
    tokenModal.classList.add('active');
  });

  document.getElementById('token-modal-close').addEventListener('click', () => {
    tokenModal.classList.remove('active');
  });

  document.getElementById('token-save-btn').addEventListener('click', async () => {
    const value = tokenInput.value.trim();
    saveToken(value, {
      sessionOnly: !!(sessionTokenCheckbox && sessionTokenCheckbox.checked)
    });
    updateTokenButton();

    // 清空 Token：直接关闭并刷新
    if (!value) {
      tokenModal.classList.remove('active');
      if (!state.showingFavorites) loadRepos();
      return;
    }

    // 保存了 Token：先用免费接口验证有效性，让用户立刻知道结果
    showVerifyHint('⏳ 正在验证 Token…', false);
    try {
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: { Authorization: `token ${value}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        showVerifyHint(`❌ Token 验证失败（${response.status}）：${(body && body.message) || '凭证无效'}。请确认完整复制，或重新生成后再试。`, true);
        return;
      }
      const data = await response.json();
      const core = (data && data.resources && data.resources.core) || {};
      showVerifyHint(`✅ Token 有效，当前配额 ${core.remaining ?? '?'}/${core.limit ?? ''} 次/小时。关闭此窗口即可生效。`, false);
      if (!state.showingFavorites) loadRepos();
    } catch (err) {
      showVerifyHint('⚠️ 验证请求失败（网络异常），Token 已保存，稍后会自动生效。', true);
    }
  });

  document.getElementById('token-clear-btn').addEventListener('click', () => {
    saveToken('');
    tokenInput.value = '';
    updateTokenButton();
    resetVerifyHint();
    tokenModal.classList.remove('active');
    if (!state.showingFavorites) loadRepos();
  });

  // README Modal 关闭
  const readmeModal = document.getElementById('readme-modal');
  const readmeModalClose = document.getElementById('readme-modal-close');
  if (readmeModal && readmeModalClose) {
    readmeModalClose.addEventListener('click', () => {
      readmeModal.classList.remove('active');
    });
    readmeModal.addEventListener('click', (e) => {
      if (e.target === readmeModal) {
        readmeModal.classList.remove('active');
      }
    });
  }

  // 浏览器前进/后退或手动修改 hash 时同步状态
  window.addEventListener('hashchange', () => {
    const parsed = parseHash(window.location.hash);
    if (!parsed) return;
    if (
      parsed.category === state.currentCategory &&
      parsed.timeRange === state.timeRange &&
      parsed.language === state.language &&
      parsed.sortBy === state.sortBy &&
      parsed.trendMode === state.trendMode
    ) {
      return;
    }

    state.currentCategory = parsed.category;
    state.timeRange = parsed.timeRange;
    state.language = parsed.language;
    state.sortBy = parsed.sortBy;
    state.trendMode = parsed.trendMode;
    state.showingFavorites = false;
    document.getElementById('fav-toggle-view').classList.remove('btn-primary');
    syncFilterSelects();
    highlightCurrentCategory();
    loadRepos();
  });

  // ESC 键关闭所有已打开的 Modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      tokenModal.classList.remove('active');
      const openReadme = document.getElementById('readme-modal');
      if (openReadme) {
        openReadme.classList.remove('active');
      }
    }
  });

  // 点击 Token Modal 遮罩区域关闭
  tokenModal.addEventListener('click', (e) => {
    if (e.target === tokenModal) {
      tokenModal.classList.remove('active');
    }
  });

  // 点击 Logo 返回主页
  document.getElementById('logo-btn').addEventListener('click', () => {
    state.showingFavorites = false;
    document.getElementById('fav-toggle-view').classList.remove('btn-primary');
    categoryContainer.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
    const generalItem = categoryContainer.querySelector('[data-id="general"]');
    if (generalItem) {
      generalItem.classList.add('active');
    }
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
  // 发起新请求前取消上一个未完成的请求，避免竞态导致旧数据覆盖新数据
  if (requestController) {
    requestController.abort();
  }
  requestController = new AbortController();

  // 将当前筛选状态持久化到 URL hash
  syncHash();

  renderSkeletons();
  hideGrowthStatus();
  const token = getToken();
  const isGrowthMode = state.trendMode === 'growth';
  const url = buildQueryUrl(state.currentCategory, state.timeRange, state.language, null, state.sortBy, state.trendMode);

  try {
    const repos = await fetchTrendingRepos(url, token, requestController.signal);

    // 增量模式：对前 N 个候选仓库统计窗口内真实新增 Star 数并重排序。
    // 请求量受 GROWTH_CANDIDATE_LIMIT / GROWTH_CONCURRENCY / 页数上限约束，
    // 结果缓存在 sessionStorage 中，避免重复切换时反复消耗配额。
    if (isGrowthMode && repos.length > 0) {
      const daysMap = { daily: 1, weekly: 7, monthly: 30 };
      const sinceDate = calculateDate(daysMap[state.timeRange] || 7);
      const candidates = repos.slice(0, GROWTH_CANDIDATE_LIMIT);

      // 未配置 Token 时先探测剩余配额（探测本身免费）。未登录额度仅 60 次/小时，
      // 一次增量统计需要数十次请求，配额不足时直接降级，避免“烧光配额后什么都不显示”。
      if (!token) {
        const remaining = await getRemainingCoreQuota(requestController.signal);
        if (remaining !== null && remaining < candidates.length * 2) {
          showGrowthStatus(`⚠️ 当前未登录 API 配额仅剩 ${remaining} 次/小时，不足以完成增量统计（约需 ${candidates.length * 2} 次以上）。请点击右上角「配置 Token」（额度 5000 次/小时）后重试；已先按 Star 总数展示候选仓库。`);
          renderRepos(candidates);
          return;
        }
      }

      showGrowthStatus('🔥 正在统计窗口期内真实新增 Star…');

      try {
        const { growthMap, rateLimited, permissionDenied } = await computeGrowthRanking(
          candidates,
          sinceDate,
          token,
          requestController.signal,
          (done, total) => showGrowthStatus(`🔥 正在统计窗口期内真实新增 Star（${done}/${total}）…`)
        );
        if (permissionDenied) {
          showGrowthStatus('⚠️ Token 已保存，但没有读取 Stargazers 的权限（403）。若是 Fine-grained PAT，请到 GitHub → Settings → Developer settings 编辑该 Token，勾选 Stargazers、Contents、Metadata（均选只读）后保存；或改用「不勾任何 Scope」的 Classic Token。');
        } else if (rateLimited) {
          showGrowthStatus('⚠️ GitHub API 配额不足，仅统计到部分仓库的增量。建议点击右上角「配置 Token」后重试（额度可提升至 5000 次/小时）。');
        } else {
          hideGrowthStatus();
        }
        renderRepos(applyGrowthRanking(candidates, growthMap));
        return;
      } catch (growthErr) {
        if (growthErr && growthErr.name === 'AbortError') {
          return;
        }
        hideGrowthStatus();
        renderError(growthErr.message);
        return;
      }
    }

    renderRepos(repos);
  } catch (err) {
    // 被新请求取消的旧请求静默退出，不当作错误处理
    if (err && err.name === 'AbortError') {
      return;
    }
    renderError(err.message);
  }
}

// 渲染收藏列表
function renderFavorites() {
  hideGrowthStatus();
  const list = getFavorites();
  if (list.length === 0) {
    reposGrid.innerHTML = `
      <div class="error-message" style="background: rgba(255, 255, 255, 0.02); border-color: rgba(255,255,255,0.05);">
        <p style="color: var(--text-secondary); margin-bottom: 0;">您还没有收藏任何仓库哦~</p>
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
        <p style="color: var(--text-secondary); margin-bottom: 0;">没有找到匹配的热点项目，请尝试更换时间范围或语言。</p>
      </div>
    `;
    return;
  }

  repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card';

    const isFav = isFavorite(repo.id);
    const favClass = isFav ? 'active' : '';

    const name = escapeHTML(repo.full_name || repo.name);
    const desc = escapeHTML(repo.description || '暂无描述。');
    const lang = escapeHTML(repo.language || 'Markdown');
    const stars = formatCount(repo.stargazers_count);
    const forks = formatCount(repo.forks_count);
    const growth = Number(repo.growth_count) > 0 ? formatCount(repo.growth_count) : '';
    const rawUrl = repo.html_url || '';
    const htmlUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? escapeHTML(rawUrl) : '#';

    card.innerHTML = `
      <button class="favorite-btn ${favClass}" data-id="${repo.id}">★</button>
      <div class="repo-title">
        <a href="${htmlUrl}" target="_blank" rel="noopener noreferrer">${name}</a>
      </div>
      <div class="repo-desc" title="${desc}">${desc}</div>
      <div class="repo-meta">
        <span class="repo-lang">${lang}</span>
        <div class="repo-stats">
          ${growth ? `<div class="stat-item" title="窗口期内新增 Star">🔥 +${growth}</div>` : ''}
          <div class="stat-item">⭐ ${stars}</div>
          <div class="stat-item">🍴 ${forks}</div>
        </div>
      </div>
      <button class="btn btn-readme" data-owner="${escapeHTML(repo.owner?.login || '')}" data-name="${escapeHTML(repo.name || '')}" style="margin-top: 12px; width: 100%; font-size: 13px; padding: 6px 12px;">📖 预览 README</button>
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

    // README 按钮点击逻辑
    card.querySelector('.btn-readme').addEventListener('click', async (e) => {
      e.stopPropagation();
      const owner = repo.owner?.login || '';
      const name = repo.name || '';
      const readmeModal = document.getElementById('readme-modal');
      const readmeBody = document.getElementById('readme-modal-body');
      const readmeTitle = document.getElementById('readme-modal-title');
      
      if (readmeTitle) {
        readmeTitle.textContent = `${repo.name || ''} README 预览`;
      }
      if (readmeBody) {
        readmeBody.textContent = '正在加载...';
      }
      if (readmeModal) {
        readmeModal.classList.add('active');
      }

      try {
        const token = getToken();
        const headers = {};
        if (token) {
          headers['Authorization'] = `token ${token}`;
        }
        const response = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`, { headers });
        if (!response.ok) {
          throw new Error('Fetch failed');
        }
        const data = await response.json();
        const content = data.content || '';
        if (readmeBody) {
          readmeBody.textContent = decodeBase64Utf8(content);
        }
      } catch (err) {
        if (readmeBody) {
          readmeBody.textContent = '该仓库未提供 README 文件，或加载失败。';
        }
      }
    });

    reposGrid.appendChild(card);
  });
}

// 错误信息显示
function renderError(message) {
  hideGrowthStatus();
  reposGrid.innerHTML = `
    <div class="error-message">
      <p>⚠️ 请求异常: ${escapeHTML(message)}</p>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">${escapeHTML(friendlyErrorHint(message))}</p>
      <button class="btn" id="retry-btn">重新尝试</button>
    </div>
  `;
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', loadRepos);
  }
}

/**
 * Maps a raw API error message to a human-friendly, actionable hint.
 * @param {string} message - Raw error message.
 * @returns {string} Friendly hint text.
 */
function friendlyErrorHint(message) {
  const msg = String(message || '').toLowerCase();
  if (msg.includes('401')) {
    return 'Token 无效或已过期：请点击顶部「配置 Token」更新或清除后重试。';
  }
  if (msg.includes('403') || msg.includes('rate limit') || msg.includes('abuse detection')) {
    return '可能触发了 GitHub API 速率限制：请配置 Token（未登录限 60 次/小时，配置后 5000 次/小时）并稍后重试。';
  }
  if (msg.includes('422')) {
    return 'GitHub 无法解析该查询：请更换时间范围、语言或自定义 Topic。';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return '网络连接异常：请检查网络后重试。';
  }
  return '如果反复失败，可点击顶部「配置 Token」按钮填入 GitHub Token 以恢复访问。';
}

/**
 * Formats a large number into a compact human-readable string (e.g. 12345 -> '12.3k').
 * @param {number} count - The raw count value.
 * @returns {string} The formatted count string, or '0' for invalid input.
 */
export function formatCount(count) {
  const num = Number(count);
  if (!Number.isFinite(num) || num <= 0) {
    return '0';
  }
  if (num >= 1000000) {
    return trimDecimal(num / 1000000) + 'm';
  }
  if (num >= 1000) {
    return trimDecimal(num / 1000) + 'k';
  }
  return String(Math.floor(num));
}

function trimDecimal(value) {
  const rounded = value.toFixed(1);
  return rounded.replace(/\.0$/, '');
}

/**
 * Re-ranks candidate repositories by the number of stars gained within the
 * trend window (growth mode). Repos without growth data are treated as zero
 * and sorted to the bottom while keeping the original relative order.
 * @param {Array} repos - Candidate repositories from the search API.
 * @param {Object} growthMap - Map of repo full_name to star growth count.
 * @returns {Array} A new array sorted by growth count descending, with a
 *                  growth_count property attached to each repo.
 */
export function applyGrowthRanking(repos, growthMap) {
  return repos
    .map((repo, index) => ({
      ...repo,
      growth_count: (growthMap && repo.full_name && growthMap[repo.full_name]) || 0,
      __index: index,
    }))
    .sort((a, b) => b.growth_count - a.growth_count || a.__index - b.__index)
    .map(({ __index, ...repo }) => repo);
}

// HTML 转义辅助函数，防止 XSS 注入
export function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Robust base64 UTF-8 decoder.
 * @param {string} str - Base64 encoded string.
 * @returns {string} Decoded plain text or fallback error message.
 */
export function decodeBase64Utf8(str) {
  try {
    const binary = atob(str.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return '解析 README 失败。';
  }
}

