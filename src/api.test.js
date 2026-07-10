import { describe, it, expect } from 'vitest';
import { calculateDate, buildQueryUrl, fetchTrendingRepos } from './api.js';

describe('API Utility Tests', () => {
  it('should calculate correct past date string', () => {
    const baseDate = new Date('2026-07-10T12:00:00Z');
    expect(calculateDate(1, baseDate)).toBe('2026-07-09');
    expect(calculateDate(7, baseDate)).toBe('2026-07-03');
    expect(calculateDate(30, baseDate)).toBe('2026-06-10');
  });

  it('should build correct query URL for general category', () => {
    const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03');
    expect(url).toContain('q=stars%3A%3E5+created%3A%3E2026-07-03');
    expect(url).toContain('sort=stars');
  });

  it('should build correct query URL for AI category with python filter', () => {
    const url = buildQueryUrl('ai', 'monthly', 'python', '2026-06-10');
    expect(url).toContain('q=topic%3Aai+OR+topic%3Amachine-learning+OR+topic%3Allm+OR+topic%3Adeep-learning+language%3Apython+created%3A%3E2026-06-10');
  });

  it('should build correct query URL for frontend category', () => {
    const url = buildQueryUrl('frontend', 'daily', 'javascript');
    expect(url).toContain('topic%3Afrontend+OR+topic%3Areact+OR+topic%3Avue+OR+topic%3Aangular+OR+topic%3Acss');
    expect(url).toContain('language%3Ajavascript');
  });

  it('should build correct query URL for backend category', () => {
    const url = buildQueryUrl('backend', 'weekly', 'go');
    expect(url).toContain('topic%3Abackend+OR+topic%3Anodejs+OR+topic%3Agolang+OR+topic%3Arust+OR+topic%3Apython+OR+topic%3Ajava');
    expect(url).toContain('language%3Ago');
  });

  it('should build correct query URL for devops category', () => {
    const url = buildQueryUrl('devops', 'monthly', 'all');
    expect(url).toContain('topic%3Adevops+OR+topic%3Adocker+OR+topic%3Akubernetes+OR+topic%3Aci-cd');
  });

  it('should build correct query URL for mobile category', () => {
    const url = buildQueryUrl('mobile', 'weekly', 'swift');
    expect(url).toContain('topic%3Aios+OR+topic%3Aandroid+OR+topic%3Aflutter+OR+topic%3Areact-native');
    expect(url).toContain('language%3Aswift');
  });

  it('should build correct query URL for custom category', () => {
    const url = buildQueryUrl('database', 'weekly', 'all');
    expect(url).toContain('topic%3Adatabase');
  });

  it('should handle undefined or non-string category gracefully', () => {
    const urlNull = buildQueryUrl(null, 'weekly', 'all');
    expect(urlNull).toContain('q=stars%3A%3E5');
    const urlNum = buildQueryUrl(12345, 'weekly', 'all');
    expect(urlNum).toContain('q=stars%3A%3E5');
  });

  it('should handle non-string language gracefully', () => {
    const urlNumLang = buildQueryUrl('general', 'weekly', 12345);
    expect(urlNumLang).not.toContain('language:');
  });
});

describe('fetchTrendingRepos', () => {
  it('should fetch repos successfully with optional token', async () => {
    const mockItems = [{ id: 1, name: 'repo-1' }];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      expect(url).toBe('https://api.github.com/some-url');
      expect(options.headers['Authorization']).toBe('token my-token');
      return {
        ok: true,
        json: async () => ({ items: mockItems }),
      };
    };

    try {
      const repos = await fetchTrendingRepos('https://api.github.com/some-url', 'my-token');
      expect(repos).toEqual(mockItems);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should fetch repos successfully without token', async () => {
    const mockItems = [{ id: 2, name: 'repo-2' }];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      expect(url).toBe('https://api.github.com/some-url-no-token');
      expect(options.headers['Authorization']).toBeUndefined();
      return {
        ok: true,
        json: async () => ({ items: mockItems }),
      };
    };

    try {
      const repos = await fetchTrendingRepos('https://api.github.com/some-url-no-token');
      expect(repos).toEqual(mockItems);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw error when API call fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };
    };

    try {
      await expect(fetchTrendingRepos('https://api.github.com/some-url')).rejects.toThrow('GitHub API Error: 401 Unauthorized');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
