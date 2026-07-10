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
export function buildQueryUrl(category, timeRange, language, forceDate = null) {
  const daysMap = { daily: 1, weekly: 7, monthly: 30 };
  const daysAgo = daysMap[timeRange] || 7;
  const dateStr = forceDate || calculateDate(daysAgo);

  let queryParts = [];

  // Category mapping
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
    // Custom category
    queryParts.push(`topic:${category}`);
  }

  if (language && language.toLowerCase() !== 'all') {
    queryParts.push(`language:${language}`);
  }

  // Filter out forks by requiring date and stars/topic filters.
  // Note: the prompt specified created:>${dateStr}
  queryParts.push(`created:>${dateStr}`);

  const q = queryParts.join(' ');
  const encodedQ = encodeURIComponent(q).replace(/%20/g, '+');
  return `https://api.github.com/search/repositories?q=${encodedQ}&sort=stars&order=desc&per_page=30`;
}

/**
 * Fetches trending repositories from the given GitHub API URL.
 * @param {string} url - The GitHub Search API URL.
 * @param {string} [token=null] - Optional GitHub Personal Access Token.
 * @returns {Promise<Array>} A promise resolving to the list of repositories.
 */
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
