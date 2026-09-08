import type { PlacedPart } from '../geometry/types';
import type { FreeRectangle } from './types';

/**
 * Find the usable offcuts left on a nested sheet.
 *
 * The guillotine packer keeps its own list of free rectangles, but that list is
 * an artefact of the order parts were placed - it splits space at every cut and
 * never re-joins regions that are physically contiguous. Reported as-is it
 * understates what is actually left on the sheet.
 *
 * This recomputes the leftovers from the placements themselves and returns the
 * *maximal* empty rectangles: every rectangle that cannot be grown in any
 * direction without hitting a part or the sheet margin. Rectangles overlap each
 * other by design - they are alternative ways to use the same space, so cutting
 * one consumes the others it intersects.
 */

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function findMaximalFreeRects(
  sheetWidth: number,
  sheetHeight: number,
  placements: PlacedPart[],
  margin: number,
  spacing: number,
  minSize = 1
): FreeRectangle[] {
  const left = margin;
  const bottom = margin;
  const right = sheetWidth - margin;
  const top = sheetHeight - margin;

  if (right <= left || top <= bottom) return [];

  // Grow each part by the cut spacing so anything found is genuinely cuttable.
  const blocked: Box[] = placements.map((p) => {
    const w = p.rotated ? p.part.height : p.part.width;
    const h = p.rotated ? p.part.width : p.part.height;
    return {
      x0: p.x - spacing,
      y0: p.y - spacing,
      x1: p.x + w + spacing,
      y1: p.y + h + spacing,
    };
  });

  // A maximal rectangle's edges always butt against a part edge or the margin.
  const uniq = (xs: number[]) => Array.from(new Set(xs)).sort((a, b) => a - b);
  const lefts = uniq([left, ...blocked.map((b) => b.x1)].filter((v) => v >= left && v < right));
  const rights = uniq([right, ...blocked.map((b) => b.x0)].filter((v) => v > left && v <= right));
  const bottoms = uniq([bottom, ...blocked.map((b) => b.y1)].filter((v) => v >= bottom && v < top));
  const tops = uniq([top, ...blocked.map((b) => b.y0)].filter((v) => v > bottom && v <= top));

  const isEmpty = (r: Box) =>
    !blocked.some((b) => b.x0 < r.x1 && b.x1 > r.x0 && b.y0 < r.y1 && b.y1 > r.y0);

  const candidates: Box[] = [];
  for (const x0 of lefts) {
    for (const x1 of rights) {
      if (x1 - x0 < minSize) continue;
      for (const y0 of bottoms) {
        for (const y1 of tops) {
          if (y1 - y0 < minSize) continue;
          const r = { x0, y0, x1, y1 };
          if (isEmpty(r)) candidates.push(r);
        }
      }
    }
  }

  // Drop any rectangle fully contained in another - only the maximal ones matter.
  const contains = (a: Box, b: Box) =>
    a.x0 <= b.x0 && a.y0 <= b.y0 && a.x1 >= b.x1 && a.y1 >= b.y1;

  const maximal = candidates.filter(
    (r, i) => !candidates.some((o, j) => j !== i && contains(o, r) && area(o) > area(r))
  );

  return maximal
    .map((r) => ({ x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 }))
    .sort((a, b) => b.width * b.height - a.width * a.height);
}

function area(b: Box): number {
  return (b.x1 - b.x0) * (b.y1 - b.y0);
}
