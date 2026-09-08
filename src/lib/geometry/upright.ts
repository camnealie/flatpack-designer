import type { Part, Hole } from './types';
import { SYSTEM_32MM } from '../constants';
import { generateHingePlateHoles } from './hinge';

// Every other 32mm position - half the drilling, still plenty of adjustment
const PIN_ROW_SPACING = 64;

// No shelf is ever wanted this close to the floor or ceiling of the unit
const PIN_ZONE_MARGIN = 150;

/**
 * The heights at which a shelf can actually sit, measured from the bottom of
 * a panel this tall.
 *
 * This is the authority on shelf positions: the drill program bores these
 * rows, and the 3D model rests its adjustable shelves on them, so what you
 * see standing up is what the machine makes lying down.
 */
export function shelfPinRows(panelHeight: number): number[] {
  const rows: number[] = [];
  const end = panelHeight - PIN_ZONE_MARGIN;

  for (let y = PIN_ZONE_MARGIN; y <= end; y += PIN_ROW_SPACING) {
    rows.push(y);
  }

  return rows;
}

/**
 * Generate shelf pin holes for an upright panel using the 32mm system.
 * Holes are placed in two vertical columns (front and back).
 */
function generateShelfPinHoles(
  panelWidth: number,
  panelHeight: number
): Hole[] {
  const holes: Hole[] = [];

  const {
    HOLE_EDGE_INSET,
    SHELF_PIN_HOLE_DIAMETER,
    SHELF_PIN_HOLE_DEPTH,
  } = SYSTEM_32MM;

  // Front and back column X positions
  const frontColumnX = HOLE_EDGE_INSET;
  const backColumnX = panelWidth - HOLE_EDGE_INSET;

  for (const y of shelfPinRows(panelHeight)) {
    // Front column hole
    holes.push({
      x: frontColumnX,
      y,
      diameter: SHELF_PIN_HOLE_DIAMETER,
      depth: SHELF_PIN_HOLE_DEPTH,
      layer: 'DRILL_5MM',
    });

    // Back column hole
    holes.push({
      x: backColumnX,
      y,
      diameter: SHELF_PIN_HOLE_DIAMETER,
      depth: SHELF_PIN_HOLE_DEPTH,
      layer: 'DRILL_5MM',
    });
  }

  return holes;
}

export interface UprightOptions {
  /**
   * Hinge centre heights, from the bottom of the panel, for doors hanging off
   * this panel. Each one gets a pair of mounting-plate screw holes on the
   * front 32mm column. Empty means no doors hang here.
   */
  hingeHeights?: number[];
}

/**
 * Generate a side upright panel with shelf pin holes.
 * The upright stands vertically, so height = unit height, width = unit depth.
 *
 * Laid flat, x = 0 is the FRONT edge of the cabinet. The two side panels are
 * mirror images of each other, but a mirrored panel is just this one turned
 * face down, so an identical cut and drill program serves both - which is why
 * they stay a single part definition whenever their holes match.
 */
export function generateUpright(
  unitHeight: number,
  unitDepth: number,
  thickness: number,
  side: 'left' | 'right',
  options: UprightOptions = {}
): Part {
  // Upright dimensions when laid flat for CNC cutting
  // Width = depth of unit (front to back)
  // Height = height of unit
  const width = unitDepth;
  const height = unitHeight;

  const holes = generateShelfPinHoles(width, height);

  const { hingeHeights = [] } = options;
  if (hingeHeights.length > 0) {
    holes.push(...generateHingePlateHoles(width, hingeHeights, 'low'));
  }

  return {
    id: `upright-${side}`,
    name: `${side === 'left' ? 'Left' : 'Right'} Side`,
    width,
    height,
    thickness,
    holes,
    grooves: [],
  };
}

/**
 * Generate both left and right uprights.
 */
export function generateUprights(
  unitHeight: number,
  unitDepth: number,
  thickness: number,
  leftOptions: UprightOptions = {},
  rightOptions: UprightOptions = leftOptions
): Part[] {
  return [
    generateUpright(unitHeight, unitDepth, thickness, 'left', leftOptions),
    generateUpright(unitHeight, unitDepth, thickness, 'right', rightOptions),
  ];
}
