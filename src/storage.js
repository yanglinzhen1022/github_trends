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
