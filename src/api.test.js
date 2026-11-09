import { describe, it, expect, afterEach } from 'vitest';
import { calculateDate, buildQueryUrl, fetchTrendingRepos, fetchStarGrowth } from './api.js';

describe('API Utility Tests', () => {
  it('should calculate correct past date string', () => {
    const baseDate = new Date('2026-07-10T12:00:00Z');
    expect(calculateDate(1, baseDate)).toBe('2026-07-09');
    expect(calculateDate(7, baseDate)).toBe('2026-07-03');
    expect(calculateDate(30, baseDate)).toBe('2026-06-10');
  });

  it('should build correct query URL for general category (new mode default)', () => {
    const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03');
    expect(url).toContain('q=stars%3A%3E50+created%3A%3E2026-07-03+fork%3Afalse+archived%3Afalse');
    expect(url).toContain('sort=stars');
  });

  it('should build correct query URL with forks sorting option', () => {
    const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03', 'forks');
    expect(url).toContain('sort=forks');
  });

  it('should build correct query URL for AI category with python filter', () => {
    const url = buildQueryUrl('ai', 'monthly', 'python', '2026-06-10');
    expect(url).toContain('q=ai+OR+%22machine+learning%22+OR+llm+OR+%22deep+learning%22+language%3Apython+stars%3A%3E100+created%3A%3E2026-06-10+fork%3Afalse+archived%3Afalse');
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
    expect(urlNull).toContain('q=stars%3A%3E50');
    const urlNum = buildQueryUrl(12345, 'weekly', 'all');
    expect(urlNum).toContain('q=stars%3A%3E50');
  });

  it('should handle non-string language gracefully', () => {
    const urlNumLang = buildQueryUrl('general', 'weekly', 12345);
    expect(urlNumLang).not.toContain('language:');
  });

  it('should apply daily star threshold in new mode', () => {
    const url = buildQueryUrl('general', 'daily', 'all', '2026-07-09');
    expect(url).toContain('stars%3A%3E20');
    expect(url).toContain('created%3A%3E2026-07-09');
  });

  it('should apply monthly star threshold in new mode', () => {
    const url = buildQueryUrl('general', 'monthly', 'all', '2026-06-10');
    expect(url).toContain('stars%3A%3E100');
  });

  it('should build growth mode query with pushed filter and candidate threshold', () => {
    const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03', 'stars', 'growth');
    expect(url).toContain('q=stars%3A%3E100+pushed%3A%3E2026-07-03+fork%3Afalse+archived%3Afalse');
  });

  it('should keep category keywords and language in growth mode', () => {
    const url = buildQueryUrl('ai', 'daily', 'python', '2026-07-09', 'stars', 'growth');
    expect(url).toContain('ai+OR+%22machine+learning%22');
    expect(url).toContain('language%3Apython');
    expect(url).toContain('pushed%3A%3E2026-07-09');
  });

  it('should fall back to new mode for unknown mode value', () => {
    const url = buildQueryUrl('general', 'weekly', 'all', '2026-07-03', 'stars', 'bogus');
    expect(url).toContain('created%3A%3E2026-07-03');
    expect(url).not.toContain('pushed%3A%3E');
  });
});

describe('fetchStarGrowth', () => {
  const since = '2026-07-03';
  const originalFetch = globalThis.fetch;
  let fetchCalls = [];

  function stargazerPage(starredAtList) {
    return starredAtList.map(at => ({ starred_at: at, user: { login: 'u' } }));
  }

  function mockResponse(items, linkHeader = null) {
    return {
      ok: true,
      json: async () => items,
      headers: {
        get: (name) => (name.toLowerCase() === 'link' ? linkHeader : null),
      },
    };
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    fetchCalls = [];
  });

  it('should count stars since date on a single page (no Link header)', async () => {
    globalThis.fetch = async (url, options) => {
      fetchCalls.push(url);
      expect(url).toBe('https://api.github.com/repos/owner/repo/stargazers?per_page=100');
      expect(options.headers['Accept']).toBe('application/vnd.github.star+json');
      expect(options.headers['Authorization']).toBe('token my-token');
      return mockResponse(stargazerPage([
        '2026-07-01T10:00:00Z',
        '2026-07-04T10:00:00Z',
        '2026-07-05T10:00:00Z',
      ]));
    };

    const count = await fetchStarGrowth('owner/repo', since, 'my-token');
    expect(count).toBe(2);
    expect(fetchCalls.length).toBe(1);
  });

  it('should page backwards from last page and stop at window boundary', async () => {
    const pages = {
      'https://api.github.com/repos/owner/repo/stargazers?per_page=100': stargazerPage([
        '2026-06-01T10:00:00Z',
      ]),
      'https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=3': stargazerPage([
        '2026-07-04T10:00:00Z',
        '2026-07-05T10:00:00Z',
      ]),
      'https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=2': stargazerPage([
        '2026-07-01T10:00:00Z',
        '2026-07-02T10:00:00Z',
        '2026-07-04T10:00:00Z',
      ]),
      'https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=1': stargazerPage([
        '2026-06-20T10:00:00Z',
      ]),
    };
    const linkHeader = '<https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=2>; rel="next", <https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=3>; rel="last"';

    globalThis.fetch = async (url) => {
      fetchCalls.push(url);
      return mockResponse(pages[url], linkHeader);
    };

    const count = await fetchStarGrowth('owner/repo', since, null);
    // probe (page 1, ignored) then last page 3: 2 new stars; page 2: 1 new star, then older -> stop
    expect(count).toBe(3);
    // Must NOT fetch page=1 explicitly (probe URL has no page param)
    expect(fetchCalls).not.toContain('https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=1');
    expect(fetchCalls.length).toBe(3);
  });

  it('should throw GitHub API error when request fails', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 403, statusText: 'Forbidden' });
    await expect(fetchStarGrowth('owner/repo', since, null)).rejects.toThrow('GitHub API Error: 403 Forbidden');
  });

  it('should cap backward pagination at a bounded number of pages', async () => {
    const linkHeader = '<https://api.github.com/repos/owner/repo/stargazers?per_page=100&page=50>; rel="last"';
    let fetched = 0;
    globalThis.fetch = async () => {
      fetched += 1;
      // 每页的 Star 都在窗口期内，永远遇不到边界 → 必须由页数上限熔断
      return mockResponse(stargazerPage(['2026-07-05T10:00:00Z', '2026-07-06T10:00:00Z']), linkHeader);
    };

    const count = await fetchStarGrowth('owner/repo', since, null);
    // 1 次探测 + 最多 40 页回看
    expect(fetched).toBe(41);
    expect(count).toBe(80);
  });

  it('should include the API-provided message in errors', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'API rate limit exceeded for 1.2.3.4' })
    });
    await expect(fetchStarGrowth('owner/repo', since, null)).rejects.toThrow(
      'GitHub API Error: 403 Forbidden - API rate limit exceeded for 1.2.3.4'
    );
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

  it('should include the API-provided message in errors when available', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'API rate limit exceeded for 1.2.3.4' })
      };
    };

    try {
      await expect(fetchTrendingRepos('https://api.github.com/some-url')).rejects.toThrow(
        'GitHub API Error: 403 Forbidden - API rate limit exceeded for 1.2.3.4'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should pass an abort signal through to fetch', async () => {
    const controller = new AbortController();
    const originalFetch = globalThis.fetch;
    let receivedSignal = null;
    globalThis.fetch = async (url, options) => {
      receivedSignal = options.signal;
      return {
        ok: true,
        json: async () => ({ items: [] }),
      };
    };

    try {
      await fetchTrendingRepos('https://api.github.com/some-url', null, controller.signal);
      expect(receivedSignal).toBe(controller.signal);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should not set a signal option when none is provided', async () => {
    const originalFetch = globalThis.fetch;
    let receivedOptions = null;
    globalThis.fetch = async (url, options) => {
      receivedOptions = options;
      return {
        ok: true,
        json: async () => ({ items: [] }),
      };
    };

    try {
      await fetchTrendingRepos('https://api.github.com/some-url');
      expect(receivedOptions.signal).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
