import type { Part, PlacedPart, Sheet } from '../geometry/types';
import type { FreeRectangle, NestingConfig, NestingResult, NestedSheetResult } from './types';
import { findMaximalFreeRects } from './offcuts';

/**
 * Guillotine bin-packing algorithm.
 * Places parts using guillotine cuts (full horizontal or vertical splits).
 * This matches how CNC machines typically cut sheet materials.
 */

interface SheetState {
  sheet: Sheet;
  freeRects: FreeRectangle[];
  placements: PlacedPart[];
  usedArea: number;
}

/**
 * Find the best free rectangle for a part using "Best Short Side Fit" heuristic.
 * For each rectangle, prefers non-rotated unless rotation is required to fit
 * or gives a significantly better fit.
 */
function findBestFit(
  freeRects: FreeRectangle[],
  partWidth: number,
  partHeight: number,
  allowRotation: boolean
): { rectIndex: number; rotated: boolean } | null {
  let bestIndex = -1;
  let bestRotated = false;
  let bestScore = Infinity;

  for (let i = 0; i < freeRects.length; i++) {
    const rect = freeRects[i];

    const fitsNormal = partWidth <= rect.width && partHeight <= rect.height;
    const fitsRotated = allowRotation && partHeight <= rect.width && partWidth <= rect.height;

    if (!fitsNormal && !fitsRotated) continue;

    let useRotated = false;
    let shortSideFit: number;

    if (fitsNormal && fitsRotated) {
      // Both fit - calculate scores
      const normalFit = Math.min(rect.width - partWidth, rect.height - partHeight);
      const rotatedFit = Math.min(rect.width - partHeight, rect.height - partWidth);

      // Prefer non-rotated unless rotation is significantly better (50% smaller fit)
      if (rotatedFit < normalFit * 0.5) {
        useRotated = true;
        shortSideFit = rotatedFit;
      } else {
        useRotated = false;
        shortSideFit = normalFit;
      }
    } else if (fitsNormal) {
      useRotated = false;
      shortSideFit = Math.min(rect.width - partWidth, rect.height - partHeight);
    } else {
      // Only rotated fits
      useRotated = true;
      shortSideFit = Math.min(rect.width - partHeight, rect.height - partWidth);
    }

    if (shortSideFit < bestScore) {
      bestScore = shortSideFit;
      bestIndex = i;
      bestRotated = useRotated;
    }
  }

  return bestIndex >= 0 ? { rectIndex: bestIndex, rotated: bestRotated } : null;
}

/**
 * Attempt to merge two rectangles if they share a complete edge.
 * Returns merged rectangle if possible, null otherwise.
 */
function tryMerge(
  a: FreeRectangle,
  b: FreeRectangle
): FreeRectangle | null {
  // Check if rectangles can merge horizontally (same height, adjacent in X)
  if (a.y === b.y && a.height === b.height) {
    // a is to the left of b
    if (a.x + a.width === b.x) {
      return { x: a.x, y: a.y, width: a.width + b.width, height: a.height };
    }
    // b is to the left of a
    if (b.x + b.width === a.x) {
      return { x: b.x, y: b.y, width: a.width + b.width, height: a.height };
    }
  }

  // Check if rectangles can merge vertically (same width, adjacent in Y)
  if (a.x === b.x && a.width === b.width) {
    // a is below b
    if (a.y + a.height === b.y) {
      return { x: a.x, y: a.y, width: a.width, height: a.height + b.height };
    }
    // b is below a
    if (b.y + b.height === a.y) {
      return { x: b.x, y: b.y, width: b.width, height: a.height + b.height };
    }
  }

  return null;
}

/**
 * Merge adjacent free rectangles to maximize usable space.
 * Continues merging until no more merges are possible.
 */
function mergeRectangles(rects: FreeRectangle[]): FreeRectangle[] {
  let merged = [...rects];
  let didMerge = true;

  while (didMerge) {
    didMerge = false;

    for (let i = 0; i < merged.length && !didMerge; i++) {
      for (let j = i + 1; j < merged.length && !didMerge; j++) {
        const result = tryMerge(merged[i], merged[j]);
        if (result) {
          // Remove both rectangles and add merged one
          merged = [
            ...merged.slice(0, i),
            ...merged.slice(i + 1, j),
            ...merged.slice(j + 1),
            result,
          ];
          didMerge = true;
        }
      }
    }
  }

  return merged;
}

/**
 * Split a rectangle using guillotine cuts after placing a part.
 * Uses "Shorter Axis Split" rule to minimize waste.
 */
function splitRectangle(
  rect: FreeRectangle,
  partWidth: number,
  partHeight: number,
  spacing: number
): FreeRectangle[] {
  const newRects: FreeRectangle[] = [];

  // Calculate remaining space
  const rightWidth = rect.width - partWidth - spacing;
  const topHeight = rect.height - partHeight - spacing;

  // Use shorter axis split: split along the shorter remaining dimension
  if (rightWidth > 0 && topHeight > 0) {
    if (rightWidth <= topHeight) {
      // Horizontal split (split above the part first)
      // Right rectangle: full height of remaining
      if (rightWidth > 0) {
        newRects.push({
          x: rect.x + partWidth + spacing,
          y: rect.y,
          width: rightWidth,
          height: rect.height,
        });
      }
      // Top rectangle: only above the placed part
      if (topHeight > 0) {
        newRects.push({
          x: rect.x,
          y: rect.y + partHeight + spacing,
          width: partWidth + spacing,
          height: topHeight,
        });
      }
    } else {
      // Vertical split (split to the right of part first)
      // Top rectangle: full width of remaining
      if (topHeight > 0) {
        newRects.push({
          x: rect.x,
          y: rect.y + partHeight + spacing,
          width: rect.width,
          height: topHeight,
        });
      }
      // Right rectangle: only to the right of placed part
      if (rightWidth > 0) {
        newRects.push({
          x: rect.x + partWidth + spacing,
          y: rect.y,
          width: rightWidth,
          height: partHeight + spacing,
        });
      }
    }
  } else if (rightWidth > 0) {
    // Only right space remains
    newRects.push({
      x: rect.x + partWidth + spacing,
      y: rect.y,
      width: rightWidth,
      height: rect.height,
    });
  } else if (topHeight > 0) {
    // Only top space remains
    newRects.push({
      x: rect.x,
      y: rect.y + partHeight + spacing,
      width: rect.width,
      height: topHeight,
    });
  }

  return newRects;
}

/**
 * Create a new sheet state with initial free rectangle.
 */
function createSheet(config: NestingConfig): SheetState {
  const { sheetWidth, sheetHeight, sheetThickness, sheetMargin } = config;

  return {
    sheet: {
      width: sheetWidth,
      height: sheetHeight,
      thickness: sheetThickness,
    },
    freeRects: [
      {
        x: sheetMargin,
        y: sheetMargin,
        width: sheetWidth - 2 * sheetMargin,
        height: sheetHeight - 2 * sheetMargin,
      },
    ],
    placements: [],
    usedArea: 0,
  };
}

/**
 * Try to place a part on a sheet.
 */
function placePart(
  sheetState: SheetState,
  part: Part,
  config: NestingConfig
): boolean {
  const fit = findBestFit(
    sheetState.freeRects,
    part.width,
    part.height,
    config.allowRotation
  );

  if (!fit) {
    return false;
  }

  const { rectIndex, rotated } = fit;
  const rect = sheetState.freeRects[rectIndex];

  // Dimensions after potential rotation
  const placedWidth = rotated ? part.height : part.width;
  const placedHeight = rotated ? part.width : part.height;

  // Add placement
  sheetState.placements.push({
    part,
    x: rect.x,
    y: rect.y,
    rotated,
  });

  // Update used area
  sheetState.usedArea += placedWidth * placedHeight;

  // Remove used rectangle and add new ones from split
  sheetState.freeRects.splice(rectIndex, 1);
  const newRects = splitRectangle(rect, placedWidth, placedHeight, config.partSpacing);
  sheetState.freeRects.push(...newRects);

  // Merge adjacent rectangles to maximize usable space
  sheetState.freeRects = mergeRectangles(sheetState.freeRects);

  return true;
}

/**
 * Run nesting with a specific part order.
 */
function nestWithOrder(
  parts: Part[],
  config: NestingConfig
): { sheets: SheetState[]; unplacedParts: Part[] } {
  const sheets: SheetState[] = [];
  const unplacedParts: Part[] = [];

  for (const part of parts) {
    let placed = false;

    // Try to place on existing sheets
    for (const sheetState of sheets) {
      if (placePart(sheetState, part, config)) {
        placed = true;
        break;
      }
    }

    // If not placed, create new sheet
    if (!placed) {
      const newSheet = createSheet(config);
      if (placePart(newSheet, part, config)) {
        sheets.push(newSheet);
        placed = true;
      }
    }

    // Part doesn't fit anywhere (too large for sheet)
    if (!placed) {
      unplacedParts.push(part);
    }
  }

  return { sheets, unplacedParts };
}

/**
 * Main nesting function using guillotine algorithm.
 * Tries multiple sort strategies and returns the best result.
 */
export function nestParts(
  parts: Part[],
  config: NestingConfig
): NestingResult {
  // Strategy 1: Sort by largest dimension descending (big parts first)
  const largeFirst = [...parts].sort((a, b) => {
    const maxA = Math.max(a.width, a.height);
    const maxB = Math.max(b.width, b.height);
    return maxB - maxA;
  });

  // Strategy 2: Sort by largest dimension ascending (small parts first)
  const smallFirst = [...parts].sort((a, b) => {
    const maxA = Math.max(a.width, a.height);
    const maxB = Math.max(b.width, b.height);
    return maxA - maxB;
  });

  // Strategy 3: Sort by area descending
  const areaFirst = [...parts].sort((a, b) => {
    return (b.width * b.height) - (a.width * a.height);
  });

  // Strategy 4: Sort by width ascending (fills horizontal bands)
  const widthFirst = [...parts].sort((a, b) => {
    const minA = Math.min(a.width, a.height);
    const minB = Math.min(b.width, b.height);
    return minA - minB;
  });

  // Strategy 5: Sort by height ascending
  const heightFirst = [...parts].sort((a, b) => {
    return a.height - b.height;
  });

  // Try all strategies with rotation enabled
  const configWithRotation = { ...config, allowRotation: true };
  const configNoRotation = { ...config, allowRotation: false };

  const results = [
    nestWithOrder(largeFirst, configWithRotation),
    nestWithOrder(smallFirst, configWithRotation),
    nestWithOrder(areaFirst, configWithRotation),
    nestWithOrder(widthFirst, configWithRotation),
    nestWithOrder(heightFirst, configWithRotation),
    // Also try without rotation for different packing patterns
    nestWithOrder(largeFirst, configNoRotation),
    nestWithOrder(smallFirst, configNoRotation),
  ];

  // Pick the best result (prioritize: all parts placed, then fewer sheets, then more used area)
  let best = results[0];
  for (const result of results.slice(1)) {
    const bestUnplaced = best.unplacedParts.length;
    const resultUnplaced = result.unplacedParts.length;

    // First priority: fewer unplaced parts
    if (resultUnplaced < bestUnplaced) {
      best = result;
    } else if (resultUnplaced === bestUnplaced) {
      // Second priority: fewer sheets
      if (result.sheets.length < best.sheets.length) {
        best = result;
      } else if (result.sheets.length === best.sheets.length) {
        // Third priority: more used area (less waste)
        const bestUsed = best.sheets.reduce((sum, s) => sum + s.usedArea, 0);
        const resultUsed = result.sheets.reduce((sum, s) => sum + s.usedArea, 0);
        if (resultUsed > bestUsed) {
          best = result;
        }
      }
    }
  }

  const { sheets, unplacedParts } = best;

  // Calculate results
  const sheetResults: NestedSheetResult[] = sheets.map((state, index) => {
    const totalArea = state.sheet.width * state.sheet.height;
    return {
      index,
      sheet: state.sheet,
      placements: state.placements,
      usedArea: state.usedArea,
      totalArea,
      wastePercentage: ((totalArea - state.usedArea) / totalArea) * 100,
      // Recomputed from the placements rather than reusing the packer's own
      // split list, which fragments contiguous space by cut order.
      freeRects: findMaximalFreeRects(
        state.sheet.width,
        state.sheet.height,
        state.placements,
        config.sheetMargin,
        config.partSpacing
      ),
    };
  });

  // Calculate total waste
  const totalUsed = sheetResults.reduce((sum, s) => sum + s.usedArea, 0);
  const totalArea = sheetResults.reduce((sum, s) => sum + s.totalArea, 0);
  const totalWastePercentage = totalArea > 0 ? ((totalArea - totalUsed) / totalArea) * 100 : 0;

  return {
    sheets: sheetResults,
    totalWastePercentage,
    unplacedParts,
  };
}
