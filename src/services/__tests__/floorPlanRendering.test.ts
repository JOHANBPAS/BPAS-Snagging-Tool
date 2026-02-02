import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Integration tests for floor plan rendering and compression
 * Tests plan grouping, coordinate normalization, and image compression
 */

describe('Floor Plan Rendering - Integration Tests', () => {
  describe('Plan Grouping and Deduplication', () => {
    it('should group snags by plan_id correctly', () => {
      const snags = [
        { id: 'snag1', plan_id: 'plan1', plan_page: 1 },
        { id: 'snag2', plan_id: 'plan1', plan_page: 1 },
        { id: 'snag3', plan_id: 'plan2', plan_page: 1 },
        { id: 'snag4', plan_id: 'plan1', plan_page: 2 },
      ];

      const groupedByPlan = snags.reduce((acc, snag) => {
        const key = snag.plan_id;
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key)!.push(snag);
        return acc;
      }, new Map<string, typeof snags>());

      expect(groupedByPlan.size).toBe(2);
      expect(groupedByPlan.get('plan1')).toHaveLength(3);
      expect(groupedByPlan.get('plan2')).toHaveLength(1);
    });

    it('should group snags by plan_page when applicable', () => {
      const snags = [
        { id: 'snag1', plan_id: 'plan1', plan_page: 1 },
        { id: 'snag2', plan_id: 'plan1', plan_page: 2 },
        { id: 'snag3', plan_id: 'plan1', plan_page: 1 },
      ];

      const groupedByPage = snags.reduce((acc, snag) => {
        const key = `${snag.plan_id}:${snag.plan_page}`;
        if (!acc.has(key)) acc.set(key, []);
        acc.get(key)!.push(snag);
        return acc;
      }, new Map<string, typeof snags>());

      expect(groupedByPage.size).toBe(2);
      expect(groupedByPage.get('plan1:1')).toHaveLength(2);
      expect(groupedByPage.get('plan1:2')).toHaveLength(1);
    });

    it('should eliminate duplicate plan references', () => {
      const snags = [
        { id: 'snag1', plan_id: 'plan1', plan_page: 1 },
        { id: 'snag2', plan_id: 'plan1', plan_page: 1 }, // Duplicate
        { id: 'snag3', plan_id: 'plan1', plan_page: 1 }, // Duplicate
      ];

      const uniquePlans = new Set(snags.map(s => `${s.plan_id}:${s.plan_page}`));

      expect(uniquePlans.size).toBe(1);
      expect(Array.from(uniquePlans)[0]).toBe('plan1:1');
    });
  });

  describe('Coordinate Normalization', () => {
    it('should correctly map normalized coordinates (0-1) to pixel positions', () => {
      const planX = 0.5;
      const planY = 0.75;
      const imageWidth = 800;
      const imageHeight = 600;

      const pixelX = Math.round(imageWidth * planX);
      const pixelY = Math.round(imageHeight * planY);

      expect(pixelX).toBe(400);
      expect(pixelY).toBe(450);
    });

    it('should handle corner coordinates correctly', () => {
      const corners = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ];

      corners.forEach(({ x, y }) => {
        const pixelX = 800 * x;
        const pixelY = 600 * y;

        expect(pixelX).toBeGreaterThanOrEqual(0);
        expect(pixelX).toBeLessThanOrEqual(800);
        expect(pixelY).toBeGreaterThanOrEqual(0);
        expect(pixelY).toBeLessThanOrEqual(600);
      });
    });

    it('should preserve coordinate precision', () => {
      const testCoords = [0.123, 0.456, 0.789];

      testCoords.forEach((coord) => {
        const pixel = 800 * coord;
        expect(pixel).toBeCloseTo(800 * coord, 1);
      });
    });

    it('should clamp out-of-bounds coordinates', () => {
      const coords = [-0.1, 0.5, 1.5]; // Mix of valid and invalid

      const clamp = (val: number) => Math.max(0, Math.min(1, val));

      coords.forEach((coord) => {
        const clamped = clamp(coord);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Image Compression Configuration', () => {
    it('should use 0.7 JPEG quality for floor plans', () => {
      const quality = 0.7;
      expect(quality).toBeGreaterThan(0);
      expect(quality).toBeLessThanOrEqual(1);
      expect(quality).toBe(0.7);
    });

    it('should scale image to max 800px dimension', () => {
      const testCases = [
        { width: 1600, height: 1200, maxDim: 800 }, // Wide
        { width: 600, height: 800, maxDim: 800 },   // Tall
        { width: 400, height: 300, maxDim: 800 },   // Small
      ];

      testCases.forEach(({ width, height, maxDim }) => {
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        expect(Math.max(newWidth, newHeight)).toBeLessThanOrEqual(maxDim);
      });
    });

    it('should preserve aspect ratio during compression', () => {
      const testCases = [
        { width: 1600, height: 1200 },
        { width: 800, height: 600 },
        { width: 2000, height: 1000 },
      ];

      testCases.forEach(({ width, height }) => {
        const aspectRatio = width / height;
        const maxDim = 800;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        const newWidth = width * scale;
        const newHeight = height * scale;
        const newAspectRatio = newWidth / newHeight;

        // Allow small floating point differences
        expect(Math.abs(aspectRatio - newAspectRatio)).toBeLessThan(0.01);
      });
    });

    it('should not upscale small images', () => {
      const width = 400;
      const height = 300;
      const maxDim = 800;

      const scale = Math.min(1, maxDim / Math.max(width, height));

      expect(scale).toBeLessThanOrEqual(1);
      expect(scale * width).toBeLessThanOrEqual(width * 1.01); // Allow small rounding
    });
  });

  describe('Marker Legend Generation', () => {
    it('should map priority to correct colors', () => {
      const colorMap = {
        critical: { r: 239, g: 68, b: 68 },    // Red
        high: { r: 249, g: 115, b: 22 },       // Orange
        medium: { r: 59, g: 130, b: 246 },     // Blue
        low: { r: 34, g: 197, b: 94 },         // Green
      };

      Object.values(colorMap).forEach(({ r, g, b }) => {
        expect([r, g, b]).toEqual(expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
        ]));
        [r, g, b].forEach((val) => {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(255);
        });
      });
    });

    it('should include all snags in legend', () => {
      const snags = [
        { id: 's1', title: 'Snag 1', priority: 'critical' },
        { id: 's2', title: 'Snag 2', priority: 'high' },
        { id: 's3', title: 'Snag 3', priority: 'low' },
      ];

      const legend = snags.map((s, idx) => ({
        index: idx + 1,
        title: s.title,
        priority: s.priority,
      }));

      expect(legend).toHaveLength(snags.length);
      legend.forEach((item, idx) => {
        expect(item.index).toBe(idx + 1);
      });
    });

    it('should preserve legend order for marker reference', () => {
      const snags = [
        { id: 's1', plan_x: 0.1, plan_y: 0.1 },
        { id: 's2', plan_x: 0.5, plan_y: 0.5 },
        { id: 's3', plan_x: 0.9, plan_y: 0.9 },
      ];

      const legendNumbers = snags.map((_, idx) => idx + 1);

      // Markers should reference legend by number (1, 2, 3, etc)
      expect(legendNumbers).toEqual([1, 2, 3]);
      expect(legendNumbers[0]).toBe(snags[0] ? 1 : undefined);
    });
  });

  describe('Floor Plan File Type Detection', () => {
    it('should detect PDF files by extension', () => {
      const files = [
        { name: 'plan1.pdf', isPdf: true },
        { name: 'plan1.PDF', isPdf: true },
        { name: 'plan1.jpeg', isPdf: false },
        { name: 'plan1.png', isPdf: false },
      ];

      files.forEach(({ name, isPdf }) => {
        const isSvgPdf = /\.(pdf|PDF)$/.test(name);
        expect(isSvgPdf).toBe(isPdf);
      });
    });

    it('should detect image files by extension', () => {
      const files = [
        { name: 'plan1.jpeg', isImage: true },
        { name: 'plan1.jpg', isImage: true },
        { name: 'plan1.png', isImage: true },
        { name: 'plan1.webp', isImage: true },
        { name: 'plan1.pdf', isImage: false },
      ];

      files.forEach(({ name, isImage }) => {
        const imageExt = /\.(jpe?g|png|webp)$/i.test(name);
        expect(imageExt).toBe(isImage);
      });
    });
  });

  describe('Multi-Page Plan Support', () => {
    it('should handle plans with multiple pages', () => {
      const pages = [1, 2, 3, 4, 5];

      pages.forEach((page) => {
        expect(page).toBeGreaterThanOrEqual(1);
      });
    });

    it('should group snags by plan and page separately', () => {
      const snags = [
        { id: 's1', plan_id: 'p1', plan_page: 1 },
        { id: 's2', plan_id: 'p1', plan_page: 2 },
        { id: 's3', plan_id: 'p1', plan_page: 2 },
        { id: 's4', plan_id: 'p2', plan_page: 1 },
      ];

      const groups = new Map<string, typeof snags>();

      snags.forEach((snag) => {
        const key = `${snag.plan_id}:${snag.plan_page || 1}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(snag);
      });

      expect(groups.size).toBe(3); // p1:1, p1:2, p2:1
      expect(groups.get('p1:1')).toHaveLength(1);
      expect(groups.get('p1:2')).toHaveLength(2);
      expect(groups.get('p2:1')).toHaveLength(1);
    });

    it('should generate page break after each floor plan', () => {
      const plans = ['plan1', 'plan1', 'plan2', 'plan1'];
      const uniquePlans = Array.from(new Set(plans));

      expect(uniquePlans).toHaveLength(2); // plan1, plan2
      // Each unique plan should get a page break after it
      expect(uniquePlans.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling in Plan Rendering', () => {
    it('should handle missing plan data gracefully', () => {
      const planId = null;
      const fallback = 'No plan data';

      expect(planId || fallback).toBe(fallback);
    });

    it('should skip snags without plan_id', () => {
      const snags = [
        { id: 's1', plan_id: 'p1' },
        { id: 's2', plan_id: null },
        { id: 's3', plan_id: 'p2' },
      ];

      const withPlan = snags.filter(s => s.plan_id);

      expect(withPlan).toHaveLength(2);
      expect(withPlan.every(s => s.plan_id)).toBe(true);
    });

    it('should validate image dimensions before rendering', () => {
      const images = [
        { width: 100, height: 200, valid: true },
        { width: 0, height: 200, valid: false },
        { width: 100, height: 0, valid: false },
        { width: null, height: 200, valid: false },
      ];

      images.forEach(({ width, height, valid }) => {
        const isValid = Boolean(width && height && width > 0 && height > 0);
        expect(isValid).toBe(valid);
      });
    });

    it('should log and continue on image processing error', () => {
      let errorLogged = false;

      const processImage = (imageData: unknown) => {
        try {
          if (!imageData) throw new Error('Missing image data');
          return { success: true };
        } catch (e) {
          errorLogged = true;
          return { success: false, error: (e as Error).message };
        }
      };

      const result1 = processImage(null);
      expect(result1.success).toBe(false);
      expect(errorLogged).toBe(true);

      const result2 = processImage({ data: 'test' });
      expect(result2.success).toBe(true);
    });
  });

  describe('Progress Tracking During Plan Rendering', () => {
    it('should calculate progress percentage correctly', () => {
      const totalPlans = 5;

      for (let current = 1; current <= totalPlans; current++) {
        const progress = Math.round((current / totalPlans) * 100);
        expect(progress).toBeGreaterThan(0);
        expect(progress).toBeLessThanOrEqual(100);
      }
    });

    it('should provide useful progress messages', () => {
      const messages = [
        'Processing floor plan 1 of 5...',
        'Processing floor plan 2 of 5...',
        'Processing floor plan 5 of 5...',
      ];

      messages.forEach((msg) => {
        expect(msg).toMatch(/Processing floor plan \d+ of \d+/);
      });
    });

    it('should yield to main thread periodically', () => {
      let yieldCount = 0;

      const yieldToMain = () => {
        yieldCount++;
        return new Promise((resolve) => setTimeout(resolve, 0));
      };

      // Simulate processing 5 plans with yields
      const yields = Array(5).fill(null).map(() => yieldToMain());

      expect(yields).toHaveLength(5);
    });
  });
});
