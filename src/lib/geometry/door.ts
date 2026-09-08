import type { Part, HingeSide, HingePlacement } from './types';
import {
  generateHingeCups,
  hingeCountForHeight,
  hingeHeights,
  hingeSideForDoor,
} from './hinge';

export interface DoorSpec {
  part: Part;
  side: HingeSide;
  index: number;
}

/**
 * Generate door parts for a cabinet.
 *
 * Doors are full-overlay: together they cover the full carcass face,
 * separated by a reveal gap between adjacent doors.
 *
 *   doorWidth = (unitWidth - (count - 1) x gap) / count
 *   doorHeight = unitHeight (flush top and bottom - trim if a reveal is wanted)
 *
 * With `withCups` on, each door is bored for 35mm concealed hinges on the
 * edge it swings from; the matching plate screws go into the side panels (see
 * `upright.ts`). With it off the doors are cut blank and the cups are bored at
 * assembly to suit whatever hardware turns up.
 */
export function generateDoors(
  unitWidth: number,
  unitHeight: number,
  thickness: number,
  count: number,
  gap: number,
  withCups: boolean = false,
  singleDoorSide: HingeSide = 'left'
): DoorSpec[] {
  if (count <= 0) return [];

  const doorWidth = round((unitWidth - (count - 1) * gap) / count);
  const doorHeight = round(unitHeight);

  return Array.from({ length: count }, (_, i) => {
    const side = hingeSideForDoor(i, count, singleDoorSide);

    return {
      index: i,
      side,
      part: {
        id: `door-${i + 1}`,
        name: count > 1 ? `Door ${i + 1}` : 'Door',
        width: doorWidth,
        height: doorHeight,
        thickness,
        holes: withCups
          ? generateHingeCups(doorWidth, doorHeight, thickness, side)
          : [],
        grooves: [],
      },
    };
  });
}

/**
 * Every hinge on the piece: which door it belongs to, which side panel its
 * plate screws to, and how high up it sits.
 *
 * This is the single source of truth for hinge positions - the door cups, the
 * side panel plate holes, the hardware count in the parts list and the hinges
 * drawn on the 3D model all read from it, so they cannot drift apart.
 */
export function planHinges(
  unitHeight: number,
  doorCount: number,
  singleDoorSide: HingeSide
): HingePlacement[] {
  if (doorCount <= 0) return [];

  const perDoor = hingeCountForHeight(unitHeight);
  const heights = hingeHeights(unitHeight, perDoor);

  return Array.from({ length: doorCount }, (_, doorIndex) => {
    const side = hingeSideForDoor(doorIndex, doorCount, singleDoorSide);
    return heights.map((y) => ({ doorIndex, side, y }));
  }).flat();
}

/** Round to 0.1mm - keeps DXF output clean when gaps divide unevenly. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
