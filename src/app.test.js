import { describe, it, expect } from 'vitest';
import { escapeHTML } from './app.js';

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
