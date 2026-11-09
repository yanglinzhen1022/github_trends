import { escapeHTML, decodeBase64Utf8, formatCount, applyGrowthRanking } from './app.js';

describe('escapeHTML Utility function', () => {
  it('should return an empty string for undefined/null/empty inputs', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML(undefined)).toBe('');
    expect(escapeHTML('')).toBe('');
  });

  it('should escape HTML special characters correctly', () => {
    expect(escapeHTML('<div>Hello & "World" / \'us\'</div>')).toBe(
      '&lt;div&gt;Hello &amp; &quot;World&quot; / &#039;us&#039;&lt;/div&gt;'
    );
  });

  it('should not alter normal text without HTML special characters', () => {
    expect(escapeHTML('Simple text 123')).toBe('Simple text 123');
  });
});

describe('decodeBase64Utf8 Utility function', () => {
  it('should decode basic ASCII base64 strings', () => {
    expect(decodeBase64Utf8('SGVsbG8gV29ybGQ=')).toBe('Hello World');
  });

  it('should decode UTF-8 base64 strings with multi-byte characters', () => {
    // '你好，世界' in base64 is '5L2g5aW977yM5LiW55WM'
    expect(decodeBase64Utf8('5L2g5aW977yM5LiW55WM')).toBe('你好，世界');
  });

  it('should handle whitespace in the base64 string', () => {
    expect(decodeBase64Utf8('SGVsbG8g V29ybGQ=\n')).toBe('Hello World');
  });

  it('should return fallback message for invalid base64 input', () => {
    expect(decodeBase64Utf8('invalid-base64-content!!!')).toBe('解析 README 失败。');
  });
});

describe('formatCount Utility function', () => {
  it('should format numbers below 1000 as plain integers', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(5)).toBe('5');
    expect(formatCount(999)).toBe('999');
  });

  it('should format thousands with a k suffix', () => {
    expect(formatCount(1000)).toBe('1k');
    expect(formatCount(1200)).toBe('1.2k');
    expect(formatCount(12345)).toBe('12.3k');
    expect(formatCount(999999)).toBe('1000k');
  });

  it('should format millions with an m suffix', () => {
    expect(formatCount(1500000)).toBe('1.5m');
    expect(formatCount(23000000)).toBe('23m');
  });

  it('should treat invalid input as 0', () => {
    expect(formatCount(undefined)).toBe('0');
    expect(formatCount(null)).toBe('0');
    expect(formatCount('abc')).toBe('0');
  });
});

describe('applyGrowthRanking', () => {
  const repos = [
    { id: 1, full_name: 'old/popular', stargazers_count: 5000 },
    { id: 2, full_name: 'new/rising', stargazers_count: 300 },
    { id: 3, full_name: 'new/moderate', stargazers_count: 200 },
  ];

  it('should sort repos by window star growth in descending order', () => {
    const growthMap = { 'old/popular': 5, 'new/rising': 80, 'new/moderate': 30 };
    const ranked = applyGrowthRanking(repos, growthMap);
    expect(ranked.map(r => r.full_name)).toEqual(['new/rising', 'new/moderate', 'old/popular']);
  });

  it('should treat missing growth data as zero', () => {
    const growthMap = { 'new/rising': 10 };
    const ranked = applyGrowthRanking(repos, growthMap);
    expect(ranked.map(r => r.full_name)).toEqual(['new/rising', 'old/popular', 'new/moderate']);
  });

  it('should return a new array without mutating the input', () => {
    const growthMap = { 'new/rising': 10 };
    const snapshot = repos.map(r => r.full_name);
    applyGrowthRanking(repos, growthMap);
    expect(repos.map(r => r.full_name)).toEqual(snapshot);
  });

  it('should attach growth count to each repo for display', () => {
    const growthMap = { 'new/rising': 42 };
    const ranked = applyGrowthRanking(repos, growthMap);
    const rising = ranked.find(r => r.full_name === 'new/rising');
    expect(rising.growth_count).toBe(42);
  });
});
