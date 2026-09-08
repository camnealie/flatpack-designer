import type { Part, PartDefinition, HingePlacement } from './types';
import type { CabinetItem, ProjectItem } from '../project/types';
import { generateUpright } from './upright';
import { generateShelves } from './shelf';
import { generateDoors, planHinges } from './door';
import { canBoreCups } from './hinge';

/**
 * Flat parts for one item in the job.
 *
 * Each item is generated independently and every part is stamped with the item
 * it came from, so the nesting, the cut list and the 3D view can all agree on
 * which rectangle belongs to which thing you are building.
 */
export function generateItemParts(
  item: ProjectItem,
  thickness: number
): PartDefinition[] {
  const defs =
    item.kind === 'cabinet'
      ? generateCabinetParts(item, thickness)
      : item.kind === 'shelves'
        ? [loosePart(item.name, item.width, item.depth, thickness, item.quantity)]
        : [loosePart(item.name, item.width, item.height, thickness, item.quantity)];

  // Ids have to be unique across the whole job, not just within an item, or two
  // items with the same shelf in them would collide in the nesting.
  return defs
    .filter(({ part, quantity }) => part.width > 0 && part.height > 0 && quantity > 0)
    .map(({ part, quantity }) => ({
      quantity,
      part: { ...part, id: `${item.id}:${part.id}`, itemId: item.id },
    }));
}

/** A plain rectangle with no machining - a shelf, a bench top, a filler. */
function loosePart(
  name: string,
  width: number,
  height: number,
  thickness: number,
  quantity: number
): PartDefinition {
  return {
    part: {
      id: 'panel',
      name: name.trim() || 'Panel',
      width,
      height,
      thickness,
      holes: [],
      grooves: [],
    },
    quantity: Math.max(0, Math.round(quantity)),
  };
}

function generateCabinetParts(
  item: CabinetItem,
  thickness: number
): PartDefinition[] {
  const { width, height, depth } = item;
  const defs: PartDefinition[] = [];

  if (width <= 2 * thickness || height <= 0 || depth <= 0) return defs;

  const doorCount = item.doors ? item.doorCount : 0;

  // Only the concealed hinge needs anything machined. The sprung no-bore hinge
  // screws straight to the face, so those panels come off the saw ready to
  // assemble - which matters when the supplier does not run a CNC.
  const boring = doorCount > 0 && item.hingeStyle === 'euro-35';
  const hinges = boring ? planHinges(height, doorCount, item.doorHingeSide) : [];

  // Only the outermost doors hang off the side panels. An inner door hinging
  // mid-carcass needs a divider this model does not generate, so its plate
  // holes are left off rather than drilled into the wrong panel.
  const leftPanelHinges = hingeHeightsOnPanel(hinges, 'left', 0);
  const rightPanelHinges = hingeHeightsOnPanel(hinges, 'right', doorCount - 1);

  // Side panels are mirror images, so one drill program serves both - but only
  // while their holes match. Hang a door off just one side and they become two
  // genuinely different parts.
  const panelHolesMatch =
    leftPanelHinges.length === rightPanelHinges.length &&
    leftPanelHinges.every((y, i) => y === rightPanelHinges[i]);

  if (panelHolesMatch) {
    const panel = generateUpright(height, depth, thickness, 'left', {
      hingeHeights: leftPanelHinges,
    });
    defs.push({ part: { ...panel, id: 'side', name: 'Side panel' }, quantity: 2 });
  } else {
    defs.push({
      part: generateUpright(height, depth, thickness, 'left', {
        hingeHeights: leftPanelHinges,
      }),
      quantity: 1,
    });
    defs.push({
      part: generateUpright(height, depth, thickness, 'right', {
        hingeHeights: rightPanelHinges,
      }),
      quantity: 1,
    });
  }

  // Fixed top and bottom bound an inset back rather than sitting behind it, so
  // they keep the full depth; only the adjustable shelves have to stop short.
  const fixed = generateShelves(
    width,
    depth,
    thickness,
    0,
    item.fixedTop,
    item.fixedBottom
  );
  fixed.forEach((shelf) => defs.push({ part: shelf, quantity: 1 }));

  const adjustable = generateShelves(
    width,
    shelfDepthFor(item, thickness),
    thickness,
    item.adjustableShelves,
    false,
    false
  );
  if (adjustable.length > 0) {
    defs.push({
      part: { ...adjustable[0], id: 'shelf', name: 'Adjustable shelf' },
      quantity: adjustable.length,
    });
  }

  // Doors. Left- and right-hung doors are the same rectangle with their cups on
  // opposite edges, so they only split into two definitions when cups are
  // actually being bored.
  const doors = generateDoors(
    width,
    height,
    thickness,
    doorCount,
    item.doorGap,
    boring,
    item.doorHingeSide
  );

  if (doors.length > 0) {
    const sides = Array.from(new Set(doors.map((d) => d.side)));

    if (!boring || sides.length === 1) {
      defs.push({
        part: { ...doors[0].part, id: 'door', name: 'Door' },
        quantity: doors.length,
      });
    } else {
      sides.forEach((side) => {
        const group = doors.filter((d) => d.side === side);
        defs.push({
          part: {
            ...group[0].part,
            id: `door-${side}`,
            name: `Door (${side}-hung)`,
          },
          quantity: group.length,
        });
      });
    }
  }

  if (item.backStyle === 'rails' && item.backBraces > 0 && item.backBraceHeight > 0) {
    defs.push({
      part: {
        id: 'brace',
        name: 'Back brace',
        width: width - 2 * thickness,
        height: item.backBraceHeight,
        thickness,
        holes: [],
        grooves: [],
      },
      quantity: item.backBraces,
    });
  }

  if (item.backStyle === 'inset' || item.backStyle === 'overlay') {
    // Inset has to fit the opening between the sides and the fixed panels.
    // Overlay covers the whole back, so it only has to be no bigger than the
    // carcass - far easier to live with if the cut is a millimetre out.
    const inset = item.backStyle === 'inset';

    defs.push({
      part: {
        id: 'back',
        name: inset ? 'Back panel (inset)' : 'Back panel',
        width: inset ? width - 2 * thickness : width,
        height: inset
          ? height - (item.fixedTop ? thickness : 0) - (item.fixedBottom ? thickness : 0)
          : height,
        thickness,
        holes: [],
        grooves: [],
      },
      quantity: 1,
    });
  }

  return defs;
}

/**
 * Hinge heights that land on one of the side panels.
 *
 * A hinge only reaches a side panel when it belongs to the door at the end of
 * the run swinging that way. Anything in between hinges onto a divider, which
 * this model does not generate, so those plate holes are deliberately left off.
 */
function hingeHeightsOnPanel(
  hinges: HingePlacement[],
  side: 'left' | 'right',
  doorIndex: number
): number[] {
  return hinges
    .filter((h) => h.side === side && h.doorIndex === doorIndex)
    .map((h) => h.y);
}

/**
 * Expand part definitions into individual parts for nesting.
 */
export function expandParts(partDefs: PartDefinition[]): Part[] {
  const parts: Part[] = [];

  partDefs.forEach(({ part, quantity }) => {
    for (let i = 0; i < quantity; i++) {
      parts.push({
        ...part,
        id: quantity > 1 ? `${part.id}-${i + 1}` : part.id,
      });
    }
  });

  return parts;
}

/** Whether this cabinet's doors are big enough to take a 35mm cup. */
export function cupsWouldFit(item: CabinetItem, thickness: number): boolean {
  if (item.doorCount <= 0) return false;
  const doorWidth =
    (item.width - (item.doorCount - 1) * item.doorGap) / item.doorCount;
  return canBoreCups(doorWidth, thickness);
}

/**
 * How deep a shelf in this carcass can actually be.
 *
 * An inset back sits inside the carcass at the rear, so anything behind it has
 * nowhere to go: the shelves have to stop short by the thickness of the back.
 * Every other back leaves the full depth alone - rails sit between the shelves
 * rather than behind them, and an overlay panel is outside the box entirely.
 *
 * Getting this wrong is not a drawing error, it is a shelf that will not go in.
 */
export function shelfDepthFor(item: CabinetItem, thickness: number): number {
  return item.backStyle === 'inset'
    ? Math.max(0, item.depth - thickness)
    : item.depth;
}
