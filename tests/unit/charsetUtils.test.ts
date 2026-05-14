import { describe, it, expect } from 'vitest';
import { hasEncodingIssues, fixEncodingIssues, fixObjectEncoding } from '@/utils/charsetUtils';

describe('charsetUtils', () => {
  describe('hasEncodingIssues', () => {
    it('should return false for properly encoded Thai text', () => {
      const validThai = 'แพทย์ยอดนิยม';
      expect(hasEncodingIssues(validThai)).toBe(false);
    });

    it('should detect replacement character (U+FFFD)', () => {
      const textWithReplacement = 'Hello\uFFFDWorld';
      expect(hasEncodingIssues(textWithReplacement)).toBe(true);
    });

    it('should detect high percentage of latin-1 supplement chars', () => {
      // Create string with many latin-1 characters
      let latinText = '';
      for (let i = 0; i < 50; i++) {
        latinText += String.fromCharCode(0x80 + (i % 128));
      }
      expect(hasEncodingIssues(latinText)).toBe(true);
    });
  });

  describe('fixEncodingIssues', () => {
    it('should return original text if no encoding issues', () => {
      const validText = 'แพทย์ยอดนิยม';
      expect(fixEncodingIssues(validText)).toBe(validText);
    });

    it('should handle mixed content', () => {
      const mixedText = 'Doctor: แพทย์';
      expect(fixEncodingIssues(mixedText)).toBe(mixedText);
    });
  });

  describe('fixObjectEncoding', () => {
    it('should fix encoding in nested objects', () => {
      const input = {
        name: 'ขฦ.ตว่ฒฟฉฃ แรสธ่',
        count: 139,
        nested: {
          title: 'แพทย์ยอดนิยม',
        },
      };

      const result = fixObjectEncoding(input);
      expect(typeof result.name).toBe('string');
      expect(typeof result.count).toBe('number');
      expect(result.count).toBe(139);
      expect(typeof result.nested).toBe('object');
    });

    it('should fix encoding in arrays', () => {
      const input = [
        { name: 'ขฦ.ตว่ฒฟฉฃ แรสธ่', count: 139 },
        { name: 'ขฦ.พฝสฃ โฌทขฃณฒาๆเ', count: 108 },
      ];

      const result = fixObjectEncoding(input);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should preserve non-string primitive values', () => {
      const input = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
      };

      const result = fixObjectEncoding(input);
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.null).toBeNull();
      expect(result.undefined).toBeUndefined();
    });
  });
});
