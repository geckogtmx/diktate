/**
 * Tests for Settings Utilities
 */
import { describe, it, expect } from 'vitest';
import { formatBytes } from '../../../src/settings/utils';

describe('Settings Utils', () => {
  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes (< 1 KB)', () => {
      expect(formatBytes(100)).toBe('100 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10240)).toBe('10 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB'); // 1024^2
      expect(formatBytes(2097152)).toBe('2 MB');
      expect(formatBytes(5242880)).toBe('5 MB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB'); // 1024^3
      expect(formatBytes(2147483648)).toBe('2 GB');
      expect(formatBytes(5368709120)).toBe('5 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1099511627776)).toBe('1 TB'); // 1024^4
      expect(formatBytes(2199023255552)).toBe('2 TB');
    });

    it('should handle decimal precision correctly', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024 * 1.7)).toBe('1.7 MB');
      expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
    });

    it('should round to 1 decimal place', () => {
      expect(formatBytes(1536 + 512)).toBe('2 KB'); // 2048 bytes
      expect(formatBytes(1024 * 1.234)).toBe('1.2 KB');
      expect(formatBytes(1024 * 1.256)).toBe('1.3 KB');
    });

    it('should handle edge cases', () => {
      expect(formatBytes(1023)).toBe('1023 B');
      expect(formatBytes(1025)).toBe('1 KB');
      expect(formatBytes(1048575)).toBe('1024 KB');
      expect(formatBytes(1048577)).toBe('1 MB');
    });
  });
});
