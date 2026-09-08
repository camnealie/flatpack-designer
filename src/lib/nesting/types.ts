import type { Part, Sheet, PlacedPart } from '../geometry/types';

// Rectangle representing available space on a sheet
export interface FreeRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Part with dimensions ready for nesting
export interface NestingPart {
  part: Part;
  width: number;
  height: number;
}

// Result of nesting operation
export interface NestingResult {
  sheets: NestedSheetResult[];
  totalWastePercentage: number;
  unplacedParts: Part[];
}

export interface NestedSheetResult {
  index: number;
  sheet: Sheet;
  placements: PlacedPart[];
  usedArea: number;
  totalArea: number;
  wastePercentage: number;
  freeRects: FreeRectangle[];  // Usable offcuts left on the sheet, largest first
}

// Nesting configuration
export interface NestingConfig {
  sheetWidth: number;
  sheetHeight: number;
  sheetThickness: number;
  sheetMargin: number;      // Margin from sheet edges
  partSpacing: number;      // Spacing between parts
  allowRotation: boolean;   // Whether parts can be rotated 90°
}
