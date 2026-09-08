import type { PlacedPart } from '../geometry/types';
import type { NestedSheetResult } from '../nesting/types';

/**
 * How many cuts a layout takes on a panel saw.
 *
 * A panel saw is charged per cut, so on that kind of job the cutting can rival
 * the material for cost. That makes the count worth deriving rather than
 * guessing.
 *
 * A panel saw only makes guillotine cuts: every cut runs edge to edge across
 * whatever piece is on the bed, splitting it in two. So counting cuts means
 * recursively splitting the sheet along lines that miss every part, and adding
 * the trims needed to free the last part in each region. That is exactly how
 * the cutting plan supplied with the quote reads - nineteen entries, each one
 * an `x=` or `y=` on the piece left over from the cut before.
 *
 * A layout that cannot be cut this way (parts interlocked so no clean line
 * exists) gets a stated fallback rather than a wrong number, and the caller is
 * told the count is approximate.
 */

export interface CutOptions {
  /** Blade width. A cut consumes this much material, not zero. */
  kerf: number;
  /** Unused border the nester keeps clear of the sheet's edges. */
  sheetMargin: number;
}

export interface CutEstimate {
  cuts: number;
  /**
   * False when some region had no valid guillotine cut and had to be
   * approximated - the layout is not one a panel saw can produce as drawn.
   */
  exact: boolean;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Positions closer than this are the same line as far as a saw is concerned
const EPSILON = 0.5;

export function estimateCuts(
  sheets: NestedSheetResult[],
  options: CutOptions
): CutEstimate {
  let cuts = 0;
  let exact = true;

  for (const sheet of sheets) {
    // Work inside the margin the nester keeps clear. Parts sit flush to the
    // near corner of it, so nothing gets charged a cut for the border.
    const m = options.sheetMargin;
    const region: Rect = {
      x: m,
      y: m,
      width: sheet.sheet.width - 2 * m,
      height: sheet.sheet.height - 2 * m,
    };

    const result = cutsForRegion(region, sheet.placements.map(boundsOf), options);
    cuts += result.cuts;
    exact = exact && result.exact;
  }

  return { cuts, exact };
}

function boundsOf(placement: PlacedPart): Rect {
  const { part, x, y, rotated } = placement;

  return {
    x,
    y,
    width: rotated ? part.height : part.width,
    height: rotated ? part.width : part.height,
  };
}

function cutsForRegion(
  region: Rect,
  parts: Rect[],
  options: CutOptions
): CutEstimate {
  // Nothing in it: this is offcut, and offcut costs no cuts to not make
  if (parts.length === 0) return { cuts: 0, exact: true };

  if (parts.length === 1) {
    return { cuts: trimCuts(region, parts[0], options), exact: true };
  }

  const split = findSplit(region, parts, options);

  if (!split) {
    // Not a guillotine layout. Fall back to freeing each part with two trims,
    // and say so rather than reporting a number the saw cannot deliver.
    return { cuts: parts.length * 2, exact: false };
  }

  const near = cutsForRegion(split.nearRegion, split.nearParts, options);
  const far = cutsForRegion(split.farRegion, split.farParts, options);

  return {
    cuts: 1 + near.cuts + far.cuts,
    exact: near.exact && far.exact,
  };
}

/**
 * Cuts to free a single part from the piece it is sitting in.
 *
 * The nester puts every part against the bottom-left of its space, so only the
 * far edges normally need trimming - one cut each, and none where the part
 * already runs to the edge. A part inset from a near edge by more than a blade
 * width was not freed by the cut that made this piece, so it costs another one.
 */
function trimCuts(region: Rect, part: Rect, options: CutOptions): number {
  let cuts = 0;

  if (region.x + region.width - (part.x + part.width) > EPSILON) cuts++;
  if (region.y + region.height - (part.y + part.height) > EPSILON) cuts++;

  if (part.x - region.x > options.kerf + EPSILON) cuts++;
  if (part.y - region.y > options.kerf + EPSILON) cuts++;

  return cuts;
}

interface Split {
  nearRegion: Rect;
  farRegion: Rect;
  nearParts: Rect[];
  farParts: Rect[];
}

/**
 * The best full-width or full-height line through this region that splits the
 * parts into two non-empty groups without crossing any of them.
 *
 * The line is where the blade starts, and the blade is `kerf` wide, so the far
 * piece begins a blade width along. That is what makes one cut do two jobs -
 * it finishes the part behind it and squares up the one in front - and getting
 * it wrong roughly doubles the count.
 *
 * Candidates are the parts' own far edges, since a cut anywhere else either
 * crosses a part or strands a strip. Of the valid ones, take the most even
 * split: it keeps the recursion shallow and matches how a sawyer works, taking
 * the sheet down in big pieces first.
 */
function findSplit(region: Rect, parts: Rect[], options: CutOptions): Split | null {
  let best: Split | null = null;
  let bestBalance = Infinity;

  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? 'width' : 'height';

    const candidates = new Set<number>();
    for (const part of parts) {
      candidates.add(part[axis] + part[size]);
    }

    for (const line of candidates) {
      // A cut at the very edge of the region splits nothing off
      if (
        line <= region[axis] + EPSILON ||
        line >= region[axis] + region[size] - EPSILON
      ) {
        continue;
      }

      // Anything overlapping the blade's path rules the line out
      const blocked = parts.some(
        (part) =>
          part[axis] < line + options.kerf - EPSILON &&
          part[axis] + part[size] > line + EPSILON
      );
      if (blocked) continue;

      const near = parts.filter((part) => part[axis] + part[size] <= line + EPSILON);
      const far = parts.filter(
        (part) => part[axis] >= line + options.kerf - EPSILON
      );
      if (near.length + far.length !== parts.length) continue;
      if (near.length === 0 || far.length === 0) continue;

      const balance = Math.abs(near.length - far.length);
      if (balance >= bestBalance) continue;

      bestBalance = balance;
      // The blade eats [line, line + kerf], so the far piece starts past it
      const farStart = line + options.kerf;
      best = {
        nearRegion: subRegion(region, axis, region[axis], line - region[axis]),
        farRegion: subRegion(
          region,
          axis,
          farStart,
          region[axis] + region[size] - farStart
        ),
        nearParts: near,
        farParts: far,
      };
    }
  }

  return best;
}

function subRegion(
  region: Rect,
  axis: 'x' | 'y',
  start: number,
  extent: number
): Rect {
  return axis === 'x'
    ? { x: start, y: region.y, width: extent, height: region.height }
    : { x: region.x, y: start, width: region.width, height: extent };
}
