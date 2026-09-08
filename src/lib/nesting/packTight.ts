import type { Part } from '../geometry/types';
import type { NestingConfig, NestingResult } from './types';
import { nestParts } from './guillotine';
import { findMaximalFreeRects } from './offcuts';

/**
 * Nest everything hard against one side of the sheet so the leftover ends up as
 * a single full-height rectangle instead of several scattered fragments.
 *
 * Same total waste either way - this only changes its shape. Useful when the
 * drop is wanted as one usable panel rather than as offcuts.
 *
 * Works by binary-searching the narrowest sheet the parts still fit on, then
 * presenting those placements back on the real sheet.
 */
export function nestPackedTight(
  parts: Part[],
  config: NestingConfig
): NestingResult {
  const full = nestParts(parts, config);

  // Only meaningful when the job already lands on exactly one sheet - with
  // several sheets there is no single drop to consolidate.
  if (full.sheets.length !== 1 || full.unplacedParts.length > 0) return full;

  let lo = 2 * config.sheetMargin;
  let hi = config.sheetWidth;
  let packed = full;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const attempt = nestParts(parts, { ...config, sheetWidth: mid });
    if (attempt.sheets.length === 1 && attempt.unplacedParts.length === 0) {
      packed = attempt;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // Re-present the packed placements on the full-width sheet.
  const s = packed.sheets[0];
  const totalArea = config.sheetWidth * config.sheetHeight;

  return {
    sheets: [
      {
        ...s,
        sheet: { ...s.sheet, width: config.sheetWidth },
        totalArea,
        wastePercentage: ((totalArea - s.usedArea) / totalArea) * 100,
        freeRects: findMaximalFreeRects(
          config.sheetWidth,
          config.sheetHeight,
          s.placements,
          config.sheetMargin,
          config.partSpacing
        ),
      },
    ],
    totalWastePercentage: ((totalArea - s.usedArea) / totalArea) * 100,
    unplacedParts: [],
  };
}
