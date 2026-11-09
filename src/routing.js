const VALID_TIME_RANGES = ['daily', 'weekly', 'monthly'];
// 与 index.html 中 lang-select 的选项保持一致
const VALID_LANGUAGES = ['all', 'python', 'javascript', 'typescript', 'go', 'rust', 'cpp'];
const VALID_SORTS = ['stars', 'forks'];
const VALID_MODES = ['new', 'growth'];
const BUILTIN_CATEGORIES = [
  'general', 'ai', 'frontend', 'backend', 'devops',
  'mobile', 'database', 'security', 'game', 'blockchain'
];
// 自定义分类必须是合法的 GitHub Topic slug
const TOPIC_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;

const DEFAULT_CATEGORY = 'general';
const DEFAULT_TIME_RANGE = 'weekly';
const DEFAULT_LANGUAGE = 'all';
const DEFAULT_SORT = 'stars';
const DEFAULT_MODE = 'new';

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

function sanitizeCategory(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (BUILTIN_CATEGORIES.includes(value)) return value;
  if (TOPIC_PATTERN.test(value)) return value;
  return DEFAULT_CATEGORY;
}

function sanitizeChoice(raw, allowed, fallback) {
  const value = String(raw || '').trim().toLowerCase();
  return allowed.includes(value) ? value : fallback;
}

/**
 * Parses a location hash into app state.
 * Supported formats:
 *   #/<category>
 *   #/<category>/<timeRange>
 *   #/<category>/<timeRange>/<language>
 *   plus optional query params: ?sort=stars|forks&mode=new|growth
 * When the second segment is not a valid timeRange (e.g. '#/ai/python'), it is
 * treated as the language. All segments are decoded and validated against
 * whitelists; invalid values fall back to defaults, so arbitrary hash input
 * can never inject query syntax or break the URL structure.
 * @param {string} hash - The location.hash string (e.g. '#/ai/monthly/python?sort=forks').
 * @returns {Object|null} Parsed state ({category, timeRange, language, sortBy,
 *          trendMode}) or null when the hash is empty/invalid.
 */
export function parseHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#/')) {
    return null;
  }

  const raw = hash.slice(2);
  const pathEnd = raw.indexOf('?');
  const pathPart = pathEnd === -1 ? raw : raw.slice(0, pathEnd);
  const queryPart = pathEnd === -1 ? '' : raw.slice(pathEnd + 1);

  const segments = pathPart.split('/')
    .map(decodeSegment)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (segments.length === 0) {
    return null;
  }

  const [category, second, third] = segments;

  let timeRange = DEFAULT_TIME_RANGE;
  let language = DEFAULT_LANGUAGE;
  if (second) {
    if (VALID_TIME_RANGES.includes(second)) {
      timeRange = second;
      if (third) {
        language = sanitizeChoice(third, VALID_LANGUAGES, DEFAULT_LANGUAGE);
      }
    } else {
      language = sanitizeChoice(second, VALID_LANGUAGES, DEFAULT_LANGUAGE);
    }
  }

  const params = new URLSearchParams(queryPart);
  const sortBy = sanitizeChoice(params.get('sort'), VALID_SORTS, DEFAULT_SORT);
  const trendMode = sanitizeChoice(params.get('mode'), VALID_MODES, DEFAULT_MODE);

  return {
    category: sanitizeCategory(category),
    timeRange,
    language,
    sortBy,
    trendMode
  };
}

/**
 * Serializes app filter state into a compact location hash string.
 * Default values (timeRange 'weekly', language 'all', sortBy 'stars',
 * trendMode 'new') are omitted for cleaner URLs.
 * @param {string} category - Current category id.
 * @param {string} timeRange - 'daily' | 'weekly' | 'monthly'.
 * @param {string} language - Language filter or 'all'.
 * @param {string} [sortBy='stars'] - 'stars' | 'forks'.
 * @param {string} [trendMode='new'] - 'new' | 'growth'.
 * @returns {string} Hash string such as '#/ai/monthly/python?sort=forks'.
 */
export function serializeState(category, timeRange, language, sortBy = DEFAULT_SORT, trendMode = DEFAULT_MODE) {
  let hash = `#/${encodeURIComponent(category)}`;
  if (VALID_TIME_RANGES.includes(timeRange) && timeRange !== DEFAULT_TIME_RANGE) {
    hash += `/${encodeURIComponent(timeRange)}`;
  }
  if (language && language !== DEFAULT_LANGUAGE) {
    hash += `/${encodeURIComponent(language)}`;
  }
  const params = [];
  if (VALID_SORTS.includes(sortBy) && sortBy !== DEFAULT_SORT) {
    params.push(`sort=${sortBy}`);
  }
  if (VALID_MODES.includes(trendMode) && trendMode !== DEFAULT_MODE) {
    params.push(`mode=${trendMode}`);
  }
  if (params.length > 0) {
    hash += `?${params.join('&')}`;
  }
  return hash;
}
