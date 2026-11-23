import { describe, it, expect } from 'vitest';
import { formatDuration, formatBytes, sanitizeFilename, truncateText } from '../lib/utils';

describe('Utility Functions', () => {
  describe('formatDuration', () => {
    it('formats milliseconds to mm:ss correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(65000)).toBe('1:05');
      expect(formatDuration(215000)).toBe('3:35');
      expect(formatDuration(3600000)).toBe('60:00');
    });

    it('handles negative or invalid values gracefully', () => {
      expect(formatDuration(-100)).toBe('0:00');
      expect(formatDuration(NaN)).toBe('0:00');
    });
  });

  describe('formatBytes', () => {
    it('formats bytes into KB, MB, GB properly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(10485760, 1)).toBe('10 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('sanitizeFilename', () => {
    it('removes directory traversal / ZIP Slip patterns', () => {
      expect(sanitizeFilename('../../etc/passwd')).toBe('etc-passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('windows-system32');
    });

    it('replaces illegal OS characters with underscores', () => {
      expect(sanitizeFilename('track: name <test> *?.mp3')).toBe('track_ name _test_ __.mp3');
    });

    it('falls back to default name if empty or only illegal chars', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('...')).toBe('track');
    });
  });

  describe('truncateText', () => {
    it('truncates long strings with ellipsis', () => {
      expect(truncateText('A very long song title indeed', 10)).toBe('A very lon...');
      expect(truncateText('Short', 10)).toBe('Short');
    });
  });
});
