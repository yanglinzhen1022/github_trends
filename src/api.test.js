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
    expect(url).toContain('q=stars%3A%3E5+pushed%3A%3E2026-07-03+fork%3Afalse+archived%3Afalse');
    expect(url).toContain('sort=stars');
  });

  it('should build correct query URL with forks sorting option', () => {
    const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03', 'forks');
    expect(url).toContain('sort=forks');
  });

  it('should build correct query URL for AI category with python filter', () => {
    const url = buildQueryUrl('ai', 'monthly', 'python', '2026-06-10');
    expect(url).toContain('q=ai+OR+%22machine+learning%22+OR+llm+OR+%22deep+learning%22+language%3Apython+pushed%3A%3E2026-06-10+fork%3Afalse+archived%3Afalse');
  });

  it('should build correct query URL for frontend category', () => {
    const url = buildQueryUrl('frontend', 'daily', 'javascript');
    expect(url).toContain('frontend+OR+react+OR+vue+OR+angular+OR+svelte');
    expect(url).toContain('language%3Ajavascript');
  });

  it('should build correct query URL for backend category', () => {
    const url = buildQueryUrl('backend', 'weekly', 'go');
    expect(url).toContain('backend+OR+nodejs+OR+golang+OR+rust+OR+python');
    expect(url).toContain('language%3Ago');
  });

  it('should build correct query URL for devops category', () => {
    const url = buildQueryUrl('devops', 'monthly', 'all');
    expect(url).toContain('devops+OR+docker+OR+kubernetes+OR+terraform+OR+%22ci-cd%22');
  });

  it('should build correct query URL for mobile category', () => {
    const url = buildQueryUrl('mobile', 'weekly', 'swift');
    expect(url).toContain('mobile+OR+ios+OR+android+OR+flutter+OR+%22react-native%22');
    expect(url).toContain('language%3Aswift');
  });

  it('should build correct query URL for database category', () => {
    const url = buildQueryUrl('database', 'weekly', 'all');
    expect(url).toContain('database+OR+%22data+science%22+OR+sql+OR+nosql+OR+postgres');
  });

  it('should build correct query URL for security category', () => {
    const url = buildQueryUrl('security', 'weekly', 'all');
    expect(url).toContain('security+OR+hacking+OR+pentest+OR+exploit+OR+malware');
  });

  it('should build correct query URL for game category', () => {
    const url = buildQueryUrl('game', 'weekly', 'all');
    expect(url).toContain('game+OR+unity+OR+unreal+OR+godot+OR+%22game+engine%22');
  });

  it('should build correct query URL for blockchain category', () => {
    const url = buildQueryUrl('blockchain', 'weekly', 'all');
    expect(url).toContain('blockchain+OR+ethereum+OR+bitcoin+OR+web3+OR+solidity');
  });

  it('should build correct query URL for custom category', () => {
    const url = buildQueryUrl('redis', 'weekly', 'all');
    expect(url).toContain('topic%3Aredis');
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
