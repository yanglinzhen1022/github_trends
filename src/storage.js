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
    const list = JSON.parse(localStorage.getItem('favorite_repos') || '[]');
    return Array.isArray(list) ? list : [];
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
    const list = JSON.parse(localStorage.getItem('custom_categories') || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addCustomCategory(categoryName) {
  if (typeof categoryName !== 'string') {
    return;
  }
  const list = getCustomCategories();
  const cleanName = categoryName.trim().toLowerCase();
  if (cleanName && !list.includes(cleanName)) {
    list.push(cleanName);
    localStorage.setItem('custom_categories', JSON.stringify(list));
  }
}
