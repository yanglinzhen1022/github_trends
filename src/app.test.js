import { escapeHTML, decodeBase64Utf8 } from './app.js';

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
