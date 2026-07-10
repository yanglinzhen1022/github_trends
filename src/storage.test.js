import { describe, it, expect, beforeEach } from 'vitest';

// Redefine localStorage to bypass Node 22's experimental/broken built-in localStorage in vitest/jsdom env
const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] !== undefined ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key(index) {
      return Object.keys(store)[index] || null;
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

// Now import the storage functions which will use the mock
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
