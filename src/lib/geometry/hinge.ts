import type { Hole, HingeSide } from './types';
import { HINGES } from '../constants';

/**
 * Concealed cabinet hinges (35mm cup, "Euro" hinges).
 *
 * Two machining operations come out of a hinge, on two different parts:
 *
 *   1. A 35mm blind cup bored into the BACK of the door, its centre set in
 *      from the door's hinge edge.
 *   2. Two 5mm mounting-plate screw holes in the INSIDE face of the side
 *      panel, on the front 32mm column, 32mm apart and straddling the hinge.
 *
 * Both are drilled at the same heights, so the door hangs square. Everything
 * here works in each part's own laid-flat coordinate system, ready for
 * nesting - see `door.ts` and `upright.ts` for how they get applied.
 */

/**
 * How many hinges a door of this height needs.
 *
 * Standard hardware guidance: two hinges carry a door up to about 900mm, then
 * one more for roughly every 600mm after that. Erring high costs a few pounds
 * of hardware; erring low lets the door sag and pull its screws.
 */
export function hingeCountForHeight(doorHeight: number): number {
  if (doorHeight <= 0) return 0;
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1600) return 3;
  if (doorHeight <= 2000) return 4;
  return 5;
}

/**
 * Hinge centre heights on a door, measured from its bottom edge.
 *
 * The top and bottom hinges sit a fixed offset in from the door ends; any
 * remaining hinges are spread evenly between them. On a door too short to
 * hold both end offsets the pair collapses toward the centre rather than
 * crossing over, which keeps the geometry valid even mid-typing when a user
 * is part way through entering a dimension.
 */
export function hingeHeights(doorHeight: number, count: number): number[] {
  if (count <= 0 || doorHeight <= 0) return [];

  const offset = Math.min(HINGES.END_OFFSET, doorHeight / 2);
  const first = offset;
  const last = doorHeight - offset;

  if (count === 1 || last <= first) {
    return Array.from({ length: count }, () => round(doorHeight / 2));
  }

  const step = (last - first) / (count - 1);
  return Array.from({ length: count }, (_, i) => round(first + i * step));
}

/**
 * The 35mm cups for one door, in the door's laid-flat coordinates.
 *
 * A door lies on the sheet face down for boring, so x runs across the door's
 * width and y up its height. The cup sits `CUP_EDGE_INSET` in from whichever
 * vertical edge the hinges are on.
 *
 * Returns nothing if the door is too narrow to take a cup without breaking
 * out of the edge, or the material too thin to bore into without coming
 * through the face - better no holes than holes that ruin the panel.
 */
export function generateHingeCups(
  doorWidth: number,
  doorHeight: number,
  thickness: number,
  side: HingeSide,
  count = hingeCountForHeight(doorHeight)
): Hole[] {
  if (!canBoreCups(doorWidth, thickness)) return [];

  const x =
    side === 'left'
      ? HINGES.CUP_EDGE_INSET
      : doorWidth - HINGES.CUP_EDGE_INSET;

  return hingeHeights(doorHeight, count).map((y) => ({
    x: round(x),
    y,
    diameter: HINGES.CUP_DIAMETER,
    depth: cupDepthFor(thickness),
    layer: 'DRILL_35MM' as const,
  }));
}

/**
 * Mounting-plate screw holes in a side panel, in the panel's laid-flat
 * coordinates: x runs front-to-back across the unit's depth, y up its height.
 *
 * `frontEdge` says which side of the laid-flat panel the cabinet's front is
 * on. The two side panels are mirror images of each other once hinges are
 * involved, and this is the parameter that mirrors them.
 */
export function generateHingePlateHoles(
  panelWidth: number,
  hingeYPositions: number[],
  frontEdge: 'low' | 'high'
): Hole[] {
  const x =
    frontEdge === 'low'
      ? HINGES.PLATE_EDGE_INSET
      : panelWidth - HINGES.PLATE_EDGE_INSET;

  const halfSpacing = HINGES.PLATE_SCREW_SPACING / 2;

  return hingeYPositions.flatMap((y) =>
    [y - halfSpacing, y + halfSpacing].map((screwY) => ({
      x: round(x),
      y: round(screwY),
      diameter: HINGES.PLATE_SCREW_DIAMETER,
      depth: HINGES.PLATE_SCREW_DEPTH,
      layer: 'DRILL_5MM' as const,
    }))
  );
}

/**
 * Whether a door of this size and material can take a 35mm cup at all.
 */
export function canBoreCups(doorWidth: number, thickness: number): boolean {
  return (
    doorWidth >= HINGES.MIN_DOOR_WIDTH &&
    thickness >= HINGES.MIN_MATERIAL_BEHIND_CUP + 6
  );
}

/**
 * Cup depth, held back far enough that the Forstner bit does not show
 * through the face of a thin door.
 */
export function cupDepthFor(thickness: number): number {
  return round(
    Math.min(HINGES.CUP_DEPTH, thickness - HINGES.MIN_MATERIAL_BEHIND_CUP)
  );
}

/**
 * Which edge each door in a run swings from.
 *
 * A single door takes whichever side the user asked for. Beyond that doors
 * alternate, so they read as facing pairs opening from the middle out - the
 * usual look for a two- or four-door run.
 */
export function hingeSideForDoor(
  index: number,
  count: number,
  singleDoorSide: HingeSide
): HingeSide {
  if (count === 1) return singleDoorSide;
  return index % 2 === 0 ? 'left' : 'right';
}

/** Round to 0.1mm - keeps DXF output clean. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
