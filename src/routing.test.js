import { describe, it, expect } from 'vitest';
import { parseHash, serializeState } from './routing.js';

const FULL_DEFAULTS = {
  category: 'general',
  timeRange: 'weekly',
  language: 'all',
  sortBy: 'stars',
  trendMode: 'new'
};

describe('parseHash', () => {
  it('should parse a full valid hash with category, timeRange and language', () => {
    expect(parseHash('#/ai/weekly/python')).toEqual({
      category: 'ai',
      timeRange: 'weekly',
      language: 'python',
      sortBy: 'stars',
      trendMode: 'new'
    });
  });

  it('should parse hash with only category and apply defaults', () => {
    expect(parseHash('#/frontend')).toEqual({
      category: 'frontend',
      timeRange: 'weekly',
      language: 'all',
      sortBy: 'stars',
      trendMode: 'new'
    });
  });

  it('should parse hash with category and timeRange only', () => {
    expect(parseHash('#/game/monthly')).toEqual({
      category: 'game',
      timeRange: 'monthly',
      language: 'all',
      sortBy: 'stars',
      trendMode: 'new'
    });
  });

  it('should parse sort and trend mode from query params', () => {
    expect(parseHash('#/ai/monthly/python?sort=forks&mode=growth')).toEqual({
      category: 'ai',
      timeRange: 'monthly',
      language: 'python',
      sortBy: 'forks',
      trendMode: 'growth'
    });
  });

  it('should fall back to defaults for invalid query param values', () => {
    expect(parseHash('#/general?sort=bogus&mode=whatever')).toEqual(FULL_DEFAULTS);
  });

  it('should return null for empty hash', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#/')).toBeNull();
  });

  it('should return null when hash does not start with #/', () => {
    expect(parseHash('ai/weekly/python')).toBeNull();
    expect(parseHash('random-text')).toBeNull();
  });

  it('should fall back to general for an invalid category', () => {
    expect(parseHash('#/Bad Topic!').category).toBe('general');
    expect(parseHash('#/../etc/passwd').category).toBe('general');
    expect(parseHash('#/<script>').category).toBe('general');
  });

  it('should accept a valid custom topic as category', () => {
    expect(parseHash('#/webgpu').category).toBe('webgpu');
    expect(parseHash('#/react-native').category).toBe('react-native');
  });

  it('should fall back to all for an unknown language', () => {
    // 旧格式中非时间范围的第二段被视为语言，但不在白名单内则回退为 all
    expect(parseHash('#/ai/yearly')).toEqual({
      category: 'ai',
      timeRange: 'weekly',
      language: 'all',
      sortBy: 'stars',
      trendMode: 'new'
    });
  });

  it('should decode percent-encoded segments safely', () => {
    // 'web gpu' 解码后不是合法 Topic，回退为 general
    expect(parseHash('#/web%20gpu').category).toBe('general');
  });
});

describe('serializeState', () => {
  it('should serialize full state with all non-default values', () => {
    expect(serializeState('ai', 'monthly', 'python', 'forks', 'growth')).toBe('#/ai/monthly/python?sort=forks&mode=growth');
  });

  it('should omit both default timeRange and default language', () => {
    expect(serializeState('frontend', 'weekly', 'all')).toBe('#/frontend');
    expect(serializeState('general', 'weekly', 'all')).toBe('#/general');
  });

  it('should keep non-default timeRange while omitting default language', () => {
    expect(serializeState('general', 'daily', 'all')).toBe('#/general/daily');
    expect(serializeState('backend', 'monthly', 'all')).toBe('#/backend/monthly');
  });

  it('should include language only when non-default', () => {
    expect(serializeState('backend', 'daily', 'go')).toBe('#/backend/daily/go');
    expect(serializeState('backend', 'weekly', 'go')).toBe('#/backend/go');
  });

  it('should append only non-default sort and mode params', () => {
    expect(serializeState('ai', 'weekly', 'all', 'forks', 'new')).toBe('#/ai?sort=forks');
    expect(serializeState('ai', 'weekly', 'all', 'stars', 'growth')).toBe('#/ai?mode=growth');
  });

  it('should omit all defaults entirely', () => {
    expect(serializeState('general', 'weekly', 'all', 'stars', 'new')).toBe('#/general');
  });

  it('should round-trip through parseHash', () => {
    const hash = serializeState('backend', 'daily', 'go', 'forks', 'growth');
    expect(parseHash(hash)).toEqual({
      category: 'backend',
      timeRange: 'daily',
      language: 'go',
      sortBy: 'forks',
      trendMode: 'growth'
    });
  });

  it('should round-trip old-style links without query params', () => {
    expect(parseHash(serializeState('ai', 'monthly', 'python'))).toEqual({
      category: 'ai',
      timeRange: 'monthly',
      language: 'python',
      sortBy: 'stars',
      trendMode: 'new'
    });
  });
});
