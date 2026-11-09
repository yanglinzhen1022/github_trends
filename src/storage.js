const TOKEN_KEY = 'github_pat';
const SESSION_TOKEN_KEY = 'github_pat_session';
const FAVORITES_KEY = 'favorite_repos';
const CUSTOM_CATEGORIES_KEY = 'custom_categories';

// GitHub Topic 命名规则：小写字母、数字、连字符，1-50 字符，以字母或数字开头
const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;

// localStorage / sessionStorage 在隐私模式或配额满时会抛异常，统一安全包裹
function safeGetItem(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    // 隐私模式 / 配额已满时静默失败
  }
}

function safeRemoveItem(store, key) {
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

function readJSONList(store, key) {
  try {
    const list = JSON.parse(safeGetItem(store, key) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeJSONList(store, key, list) {
  safeSetItem(store, key, JSON.stringify(list));
}

/**
 * Saves the GitHub Personal Access Token locally.
 * @param {string} token - Token value. Passing an empty value clears the token from all stores.
 * @param {Object} [options]
 * @param {boolean} [options.sessionOnly=false] - When true, keep the token in
 *        sessionStorage only (cleared when the browser session ends).
 */
export function saveToken(token, options = {}) {
  const value = typeof token === 'string' ? token.trim() : '';
  // 先清理所有存储位置，避免同时存在两份
  safeRemoveItem(localStorage, TOKEN_KEY);
  safeRemoveItem(sessionStorage, SESSION_TOKEN_KEY);
  if (!value) return;
  if (options.sessionOnly) {
    safeSetItem(sessionStorage, SESSION_TOKEN_KEY, value);
  } else {
    safeSetItem(localStorage, TOKEN_KEY, value);
  }
}

/**
 * Reads the saved token. Session-scoped tokens take priority.
 * @returns {string} The token or '' when none is saved.
 */
export function getToken() {
  return safeGetItem(sessionStorage, SESSION_TOKEN_KEY) || safeGetItem(localStorage, TOKEN_KEY) || '';
}

/**
 * Reports where the token currently lives.
 * @returns {'session'|'local'|null} 'session', 'local' or null when no token is saved.
 */
export function getTokenSource() {
  if (safeGetItem(sessionStorage, SESSION_TOKEN_KEY)) return 'session';
  if (safeGetItem(localStorage, TOKEN_KEY)) return 'local';
  return null;
}

export function getFavorites() {
  return readJSONList(localStorage, FAVORITES_KEY);
}

export function isFavorite(repoId) {
  return getFavorites().some(item => item.id === repoId);
}

export function toggleFavorite(repo) {
  let list = getFavorites();
  if (isFavorite(repo.id)) {
    list = list.filter(item => item.id !== repo.id);
  } else {
    list.push(repo);
  }
  writeJSONList(localStorage, FAVORITES_KEY, list);
}

/**
 * Checks whether a name is a valid GitHub topic slug.
 * @param {string} name - Candidate topic name.
 * @returns {boolean}
 */
export function isValidTopic(name) {
  return typeof name === 'string' && TOPIC_PATTERN.test(name.trim().toLowerCase());
}

export function getCustomCategories() {
  return readJSONList(localStorage, CUSTOM_CATEGORIES_KEY);
}

/**
 * Adds a custom category (GitHub topic) after validation.
 * @param {string} categoryName
 * @returns {boolean} true when the category was added; false for invalid or
 *          duplicate names (or when storage is unavailable).
 */
export function addCustomCategory(categoryName) {
  if (!isValidTopic(categoryName)) return false;
  const cleanName = categoryName.trim().toLowerCase();
  const list = getCustomCategories();
  if (list.includes(cleanName)) return false;
  list.push(cleanName);
  writeJSONList(localStorage, CUSTOM_CATEGORIES_KEY, list);
  return true;
}

export function removeCustomCategory(categoryName) {
  if (typeof categoryName !== 'string') {
    return;
  }
  const cleanName = categoryName.trim().toLowerCase();
  if (!cleanName) {
    return;
  }
  writeJSONList(
    localStorage,
    CUSTOM_CATEGORIES_KEY,
    getCustomCategories().filter(item => item !== cleanName)
  );
}
