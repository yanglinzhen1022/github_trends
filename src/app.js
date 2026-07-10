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
  sortBy: 'stars',
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
    
    // 重置收藏按钮的激活状态
    document.getElementById('fav-toggle-view').classList.remove('btn-primary');
    
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
  const handleAddCustom = () => {
    const val = customInput.value.trim();
    if (val) {
      addCustomCategory(val);
      initCategories();
      customInput.value = '';

      // Auto-switch to the newly added custom category
      const cleanVal = val.toLowerCase();
      state.currentCategory = cleanVal;
      state.showingFavorites = false;

      // Reset favorites button styling
      document.getElementById('fav-toggle-view').classList.remove('btn-primary');

      // Update sidebar active class
      categoryContainer.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
      setTimeout(() => {
        const newItem = categoryContainer.querySelector(`[data-id="${cleanVal}"]`);
        if (newItem) {
          newItem.classList.add('active');
        }
      }, 0);

      loadRepos();
    }
  };

  document.getElementById('custom-add-btn').addEventListener('click', handleAddCustom);

  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddCustom();
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
  renderSkeletons();
  const token = getToken();
  const url = buildQueryUrl(state.currentCategory, state.timeRange, state.language, null, state.sortBy);

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
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const rawUrl = repo.html_url || '';
    const htmlUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? escapeHTML(rawUrl) : '#';

    card.innerHTML = `
      <button class="favorite-btn ${favClass}" data-id="${repo.id}">★</button>
      <div class="repo-title">
        <a href="${htmlUrl}" target="_blank">${name}</a>
      </div>
      <div class="repo-desc" title="${desc}">${desc}</div>
      <div class="repo-meta">
        <span class="repo-lang">${lang}</span>
        <div class="repo-stats">
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
        readmeTitle.textContent = `${escapeHTML(repo.name || '')} README 预览`;
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
  reposGrid.innerHTML = `
    <div class="error-message">
      <p>⚠️ 请求异常: ${escapeHTML(message)}</p>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">如果触发了 GitHub API 的速率限制，请点击顶部 "配置 Token" 按钮填入您的 GitHub Token 以恢复访问。</p>
      <button class="btn" id="retry-btn">重新尝试</button>
    </div>
  `;
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', loadRepos);
  }
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

