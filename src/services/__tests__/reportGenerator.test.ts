import { describe, it, expect } from 'vitest';
import { getPriorityColor, getStatusColor } from '../../services/reportGenerator';

/**
 * Unit tests for reportGenerator helper functions
 * Tests color mapping for status and priority values
 */

describe('reportGenerator - Color Helpers', () => {
  describe('getStatusColor', () => {
    it('should return correct RGB for open status', () => {
      expect(getStatusColor('open')).toEqual([239, 68, 68]); // Red
    });

    it('should return correct RGB for in_progress status', () => {
      expect(getStatusColor('in_progress')).toEqual([249, 115, 22]); // Orange
    });

    it('should return correct RGB for completed status', () => {
      expect(getStatusColor('completed')).toEqual([34, 197, 94]); // Green
    });

    it('should return correct RGB for verified status', () => {
      expect(getStatusColor('verified')).toEqual([59, 130, 246]); // Blue
    });

    it('should handle undefined status', () => {
      const result = getStatusColor(undefined as any);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct RGB for critical priority', () => {
      expect(getPriorityColor('critical')).toEqual([239, 68, 68]); // Red
    });

    it('should return correct RGB for high priority', () => {
      expect(getPriorityColor('high')).toEqual([249, 115, 22]); // Orange
    });

    it('should return correct RGB for medium priority', () => {
      expect(getPriorityColor('medium')).toEqual([59, 130, 246]); // Blue
    });

    it('should return correct RGB for low priority', () => {
      expect(getPriorityColor('low')).toEqual([34, 197, 94]); // Green
    });

    it('should handle undefined priority', () => {
      const result = getPriorityColor(undefined as any);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });
  });

  describe('RGB color values', () => {
    it('should have valid RGB values (0-255)', () => {
      const colors = [
        getStatusColor('open'),
        getStatusColor('in_progress'),
        getStatusColor('completed'),
        getStatusColor('verified'),
        getPriorityColor('critical'),
        getPriorityColor('high'),
        getPriorityColor('medium'),
        getPriorityColor('low'),
      ];

      colors.forEach((color) => {
        color.forEach((value) => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(255);
          expect(Number.isInteger(value)).toBe(true);
        });
      });
    });
  });
});
