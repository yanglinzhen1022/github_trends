import { describe, it, expect, beforeEach } from 'vitest';

// Redefine localStorage/sessionStorage to bypass Node's experimental built-in
// localStorage in the vitest/jsdom env
function createStorageMock() {
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
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
});

import {
  saveToken, getToken, getTokenSource, toggleFavorite, isFavorite, getFavorites,
  addCustomCategory, getCustomCategories, removeCustomCategory, isValidTopic
} from './storage.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Storage Utility Tests', () => {
  it('should save and get github token', () => {
    saveToken('ghp_test_token');
    expect(getToken()).toBe('ghp_test_token');
    expect(getTokenSource()).toBe('local');
  });

  it('should trim token whitespace on save', () => {
    saveToken('  ghp_test_token  ');
    expect(getToken()).toBe('ghp_test_token');
  });

  it('should save token to sessionStorage only when sessionOnly is set', () => {
    saveToken('ghp_session_token', { sessionOnly: true });
    expect(getToken()).toBe('ghp_session_token');
    expect(getTokenSource()).toBe('session');
    expect(localStorage.getItem('github_pat')).toBeNull();
  });

  it('should prefer session token over persisted token', () => {
    saveToken('ghp_persisted');
    saveToken('ghp_session', { sessionOnly: true });
    expect(getToken()).toBe('ghp_session');
    expect(getTokenSource()).toBe('session');
  });

  it('should clear the token from all stores when saving an empty value', () => {
    saveToken('ghp_persisted');
    saveToken('ghp_session', { sessionOnly: true });
    saveToken('');
    expect(getToken()).toBe('');
    expect(getTokenSource()).toBeNull();
    expect(localStorage.getItem('github_pat')).toBeNull();
    expect(sessionStorage.getItem('github_pat_session')).toBeNull();
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

  it('should return empty array if favorites or custom categories are not arrays in localStorage', () => {
    localStorage.setItem('favorite_repos', '"not an array"');
    localStorage.setItem('custom_categories', '{"key": "value"}');

    expect(getFavorites()).toEqual([]);
    expect(getCustomCategories()).toEqual([]);
  });

  it('should validate topic names', () => {
    expect(isValidTopic('webgpu')).toBe(true);
    expect(isValidTopic('react-native')).toBe(true);
    expect(isValidTopic('go2')).toBe(true);
    expect(isValidTopic('WebGPU')).toBe(true); // 大小写不敏感
    expect(isValidTopic('')).toBe(false);
    expect(isValidTopic('hello world')).toBe(false);
    expect(isValidTopic('a'.repeat(51))).toBe(false);
    expect(isValidTopic('../evil')).toBe(false);
    expect(isValidTopic('-leading-hyphen')).toBe(false);
    expect(isValidTopic(12345)).toBe(false);
    expect(isValidTopic(null)).toBe(false);
  });

  it('should reject invalid custom category names', () => {
    expect(addCustomCategory('Web GPU')).toBe(false);
    expect(addCustomCategory('hello world')).toBe(false);
    expect(addCustomCategory('a'.repeat(51))).toBe(false);
    expect(addCustomCategory('../evil')).toBe(false);
    expect(addCustomCategory('')).toBe(false);
    expect(getCustomCategories()).toEqual([]);
  });

  it('should not add duplicate custom categories', () => {
    expect(addCustomCategory('webgpu')).toBe(true);
    expect(addCustomCategory('webgpu')).toBe(false);
    expect(getCustomCategories()).toEqual(['webgpu']);
  });

  it('should handle non-string custom category gracefully', () => {
    expect(addCustomCategory(12345)).toBe(false);
    expect(addCustomCategory(null)).toBe(false);
    expect(getCustomCategories()).not.toContain('12345');
    expect(getCustomCategories()).not.toContain('null');
  });

  it('should remove an existing custom category and keep others intact', () => {
    addCustomCategory('webgpu');
    addCustomCategory('wasm');
    addCustomCategory('redis');

    removeCustomCategory('wasm');
    expect(getCustomCategories()).toEqual(['webgpu', 'redis']);

    // 大小写不敏感
    removeCustomCategory('WebGPU');
    expect(getCustomCategories()).toEqual(['redis']);
  });

  it('should be a no-op when removing a non-existent custom category', () => {
    addCustomCategory('redis');

    removeCustomCategory('not-exist');
    expect(getCustomCategories()).toEqual(['redis']);
  });

  it('should ignore non-string input when removing custom category', () => {
    addCustomCategory('redis');

    removeCustomCategory(12345);
    removeCustomCategory(null);
    expect(getCustomCategories()).toEqual(['redis']);
  });
});
