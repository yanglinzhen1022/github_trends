/**
 * Calculates the ISO date string (YYYY-MM-DD) for a given number of days ago.
 * @param {number} daysAgo - Number of days ago to calculate.
 * @param {Date} [baseDate=new Date()] - The base date from which to subtract days.
 * @returns {string} The formatted date string (YYYY-MM-DD).
 */
export function calculateDate(daysAgo, baseDate = new Date()) {
  const targetDate = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Builds the GitHub search API URL for trending repositories based on category, timeRange, language and optional forced date.
 * @param {string} category - Category (e.g., 'ai', 'frontend', 'backend', 'devops', 'mobile', 'general').
 * @param {string} timeRange - Time range ('daily', 'weekly', 'monthly').
 * @param {string} language - Programming language filter.
 * @param {string} [forceDate=null] - Overrides date calculation with a specific YYYY-MM-DD string.
 * @returns {string} The fully constructed GitHub Search API URL.
 */
export function buildQueryUrl(category, timeRange, language, forceDate = null, sortBy = 'stars', mode = 'new') {
  const daysMap = { daily: 1, weekly: 7, monthly: 30 };
  const daysAgo = daysMap[timeRange] || 7;
  const dateStr = forceDate || calculateDate(daysAgo);

  // 'new' mode (default): repositories created within the window with enough stars.
  // 'growth' mode: candidates pushed within the window, refined by fetchStarGrowth.
  const isNewMode = mode !== 'growth';
  const starThresholds = { daily: 20, weekly: 50, monthly: 100 };
  const starThreshold = isNewMode ? (starThresholds[timeRange] || 50) : 100;
  const dateFilter = isNewMode ? `created:>${dateStr}` : `pushed:>${dateStr}`;

  let queryParts = [];

  // Category mapping
  if (!category || typeof category !== 'string') {
    // no keyword, star threshold is applied below
  } else if (category === 'general') {
    // no keyword, star threshold is applied below
  } else if (category === 'ai') {
    queryParts.push('ai OR "machine learning" OR llm OR "deep learning"');
  } else if (category === 'frontend') {
    queryParts.push('frontend OR react OR vue OR angular OR svelte');
  } else if (category === 'backend') {
    queryParts.push('backend OR nodejs OR golang OR rust OR python');
  } else if (category === 'devops') {
    queryParts.push('devops OR docker OR kubernetes OR terraform OR "ci-cd"');
  } else if (category === 'mobile') {
    queryParts.push('mobile OR ios OR android OR flutter OR "react-native"');
  } else if (category === 'database') {
    queryParts.push('database OR "data science" OR sql OR nosql OR postgres');
  } else if (category === 'security') {
    queryParts.push('security OR hacking OR pentest OR exploit OR malware');
  } else if (category === 'game') {
    queryParts.push('game OR unity OR unreal OR godot OR "game engine"');
  } else if (category === 'blockchain') {
    queryParts.push('blockchain OR ethereum OR bitcoin OR web3 OR solidity');
  } else {
    // Custom category
    queryParts.push(`topic:${category}`);
  }

  if (language && typeof language === 'string' && language.toLowerCase() !== 'all') {
    queryParts.push(`language:${language}`);
  }

  queryParts.push(`stars:>${starThreshold}`);
  queryParts.push(dateFilter);
  queryParts.push('fork:false');
  queryParts.push('archived:false');

  const q = queryParts.join(' ');
  const encodedQ = encodeURIComponent(q).replace(/%20/g, '+');
  const perPage = isNewMode ? 30 : 50;
  return `https://api.github.com/search/repositories?q=${encodedQ}&sort=${sortBy}&order=desc&per_page=${perPage}`;
}

/**
 * Fetches trending repositories from the given GitHub API URL.
 * @param {string} url - The GitHub Search API URL.
 * @param {string} [token=null] - Optional GitHub Personal Access Token.
 * @param {AbortSignal} [signal=null] - Optional AbortSignal to cancel the in-flight request.
 * @returns {Promise<Array>} A promise resolving to the list of repositories.
 */
/**
 * Builds an Error that includes the API's own message when the response
 * body is JSON (e.g. rate limit details), so users see the real cause.
 */
async function buildApiError(response) {
  const base = `GitHub API Error: ${response.status} ${response.statusText || ''}`.trim();
  try {
    const body = await response.json();
    if (body && typeof body.message === 'string' && body.message) {
      return new Error(`${base} - ${body.message}`);
    }
  } catch {
    // 非 JSON 响应体，仅使用状态码信息
  }
  return new Error(base);
}

export async function fetchTrendingRepos(url, token = null, signal = null) {
  const headers = {};
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  const options = { headers };
  if (signal) {
    options.signal = signal;
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    throw await buildApiError(response);
  }
  const data = await response.json();
  return data.items || [];
}

/**
 * Extracts the URL of the last page from a GitHub Link header.
 * @param {string|null} linkHeader - The raw Link header value.
 * @returns {string|null} The last page URL, or null when not paginated.
 */
function parseLastPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="last"/);
  return match ? match[1] : null;
}

/**
 * Derives the previous page URL by decrementing its page parameter.
 * @param {string} url - A paginated API URL containing a page parameter.
 * @returns {string|null} The previous page URL, or null when already on page 1.
 */
function previousPageUrl(url) {
  const match = url.match(/([?&])page=(\d+)/);
  if (!match) return null;
  const num = parseInt(match[2], 10);
  if (num <= 1) return null;
  return url.replace(/([?&])page=\d+/, `${match[1]}page=${num - 1}`);
}

/**
 * Counts stars a repository gained since a given date by walking the
 * stargazers list backwards from the newest page.
 * @param {string} fullName - Repository full name (e.g., 'owner/repo').
 * @param {string} sinceDate - Window start date (YYYY-MM-DD).
 * @param {string} [token=null] - Optional GitHub Personal Access Token.
 * @param {AbortSignal} [signal=null] - Optional AbortSignal to cancel requests.
 * @returns {Promise<number>} Number of stars gained since the given date.
 */
// 向后翻页的安全上限：单仓库最多回看 40 页（约 4000 Star）。
// 超出后停止统计（结果可能偏小），避免单仓库消耗过多配额。
const MAX_GROWTH_PAGES = 40;

export async function fetchStarGrowth(fullName, sinceDate, token = null, signal = null) {
  const headers = { Accept: 'application/vnd.github.star+json' };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  const options = { headers };
  if (signal) {
    options.signal = signal;
  }

  const baseUrl = `https://api.github.com/repos/${fullName}/stargazers?per_page=100`;
  const sinceMs = new Date(`${sinceDate}T00:00:00Z`).getTime();

  async function fetchPage(url) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw await buildApiError(response);
    }
    const items = await response.json();
    const linkHeader = response.headers ? response.headers.get('link') : null;
    return { items: Array.isArray(items) ? items : [], lastPageUrl: parseLastPageUrl(linkHeader) };
  }

  // Probe the first page to discover pagination info.
  const probe = await fetchPage(baseUrl);
  if (!probe.lastPageUrl) {
    let count = 0;
    for (let i = probe.items.length - 1; i >= 0; i--) {
      if (new Date(probe.items[i].starred_at).getTime() >= sinceMs) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  // Walk backwards from the last (newest) page, bounded by MAX_GROWTH_PAGES.
  let count = 0;
  let pagesWalked = 0;
  let pageUrl = probe.lastPageUrl;
  while (pageUrl && pagesWalked < MAX_GROWTH_PAGES) {
    const { items } = await fetchPage(pageUrl);
    let crossedBoundary = false;
    for (let i = items.length - 1; i >= 0; i--) {
      if (new Date(items[i].starred_at).getTime() >= sinceMs) {
        count++;
      } else {
        crossedBoundary = true;
        break;
      }
    }
    if (crossedBoundary) break;
    pagesWalked++;
    pageUrl = previousPageUrl(pageUrl);
  }
  return count;
}
