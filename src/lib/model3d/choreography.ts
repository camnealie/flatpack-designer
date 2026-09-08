import * as THREE from 'three';
import type { Assembly, AssemblyPart } from './assembly';
import type { NestedSheetResult } from '../nesting/types';
import type { PlacedPart } from '../geometry/types';

/**
 * The same panel in two places: lying on the sheet, and standing in the piece.
 *
 * This is the leap the app exists to explain. Someone who has never ordered
 * cut-to-size knows what they want the cabinet to look like and has no picture
 * at all of it as rectangles on a 2440 x 1220 sheet. Showing one turn into the
 * other, with the same panel keeping its identity the whole way, does more than
 * any amount of explaining.
 *
 * Every panel is drawn from a single box - face width along local X, thickness
 * along local Y, face height along local Z - so the flat pose is the geometry's
 * natural orientation and the assembled pose is a rotation of it. That is what
 * lets one mesh travel between the two.
 */

/** A bore in a panel, in the panel's own coordinates. */
export interface PanelHole {
  /** Across the panel's width, from its centre */
  x: number;
  /** Across the panel's height, from its centre */
  z: number;
  diameter: number;
  depth: number;
  /** Which face it is bored into: +1 or -1 along the panel's thickness */
  face: 1 | -1;
  kind: 'pin' | 'cup';
}

export interface PanelMove {
  id: string;
  itemId: string;
  label: string;
  /** Face width, thickness, face height - the box the mesh is built from */
  size: { w: number; t: number; h: number };
  holes: PanelHole[];
  /** Lying on the sheet */
  from: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  /** Standing in the piece */
  to: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  role: AssemblyPart['role'];
  /** Position in the build order, 0 first */
  order: number;
}

export interface Choreography {
  panels: PanelMove[];
  /** Sheet outlines to draw under the flat pose */
  sheets: { width: number; height: number; origin: THREE.Vector3 }[];
  /** Bounds of the flat layout and of the finished piece, for framing */
  flatBounds: THREE.Box3;
  builtBounds: THREE.Box3;
}

// Gap between sheets when the job needs more than one, laid out on the floor
const SHEET_GAP = 200;

/**
 * The order a person would actually build it in.
 *
 * Bottom first because everything stands on it, then the sides, then whatever
 * ties the back together, then the shelves, and the doors last because you
 * cannot reach past them once they are on.
 */
const BUILD_ORDER: AssemblyPart['role'][] = [
  'fixed',
  'side',
  'back',
  'brace',
  'shelf',
  'door',
  'hinge',
];

export function buildChoreography(
  assembly: Assembly,
  sheets: NestedSheetResult[],
  thickness: number
): Choreography {
  const flatBounds = new THREE.Box3();
  const builtBounds = new THREE.Box3();

  const sheetOrigins = sheets.map((sheet, index) => {
    const x = index * (sheet.sheet.width + SHEET_GAP);
    return new THREE.Vector3(x, 0, 0);
  });

  const sheetOutlines = sheets.map((sheet, index) => ({
    width: sheet.sheet.width,
    height: sheet.sheet.height,
    origin: sheetOrigins[index],
  }));

  // Every placed rectangle, with where it lies on the floor
  const placements: { placement: PlacedPart; origin: THREE.Vector3 }[] = [];
  sheets.forEach((sheet, index) => {
    for (const placement of sheet.placements) {
      placements.push({ placement, origin: sheetOrigins[index] });
    }
  });

  const used = new Set<number>();
  const panels: PanelMove[] = [];

  const standing = assembly.parts.filter((p) => p.role !== 'hinge');
  const itemCentres = centresByItem(standing);

  for (const part of standing) {
    const index = matchPlacement(part, placements, used);
    if (index === undefined) continue;
    used.add(index);

    const { placement, origin } = placements[index];
    const laid = laidDimensions(placement);

    // The box is the flat part's own rectangle, so a hole drilled at (x, y) on
    // the cut list lands at the same spot on the mesh with no re-mapping. The
    // rotation below is then whatever stands that particular rectangle up.
    const boxWidth = placement.part.width;
    const boxHeight = placement.part.height;

    const from = {
      // Flat: the sheet lies in the floor plane, its own y running away from us
      position: new THREE.Vector3(
        origin.x + placement.x + laid.width / 2,
        thickness / 2,
        origin.z + placement.y + laid.height / 2
      ),
      // The nester may have turned the rectangle to make it fit, and if so the
      // flat pose starts a quarter turn round to sit in its slot
      quaternion: placement.rotated
        ? new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.PI / 2
          )
        : new THREE.Quaternion(),
    };

    const quaternion = standingRotation(part, boxWidth, boxHeight);
    const to = {
      position: new THREE.Vector3(part.position.x, part.position.y, part.position.z),
      quaternion,
    };

    panels.push({
      id: part.id,
      itemId: part.itemId,
      label: part.label,
      size: { w: boxWidth, t: thickness, h: boxHeight },
      holes: panelHoles(placement, boxWidth, boxHeight, quaternion, part, itemCentres),
      from,
      to,
      role: part.role,
      order: BUILD_ORDER.indexOf(part.role),
    });

    flatBounds.expandByPoint(from.position);
    builtBounds.expandByPoint(to.position);
  }

  // Pad the bounds by the panels themselves so framing does not clip them
  for (const sheet of sheetOutlines) {
    flatBounds.expandByPoint(sheet.origin);
    flatBounds.expandByPoint(
      new THREE.Vector3(
        sheet.origin.x + sheet.width,
        thickness,
        sheet.origin.z + sheet.height
      )
    );
  }
  builtBounds.expandByPoint(
    new THREE.Vector3(assembly.bounds.min.x, assembly.bounds.min.y, assembly.bounds.min.z)
  );
  builtBounds.expandByPoint(
    new THREE.Vector3(assembly.bounds.max.x, assembly.bounds.max.y, assembly.bounds.max.z)
  );

  panels.sort((a, b) => a.order - b.order || a.to.position.y - b.to.position.y);

  return { panels, sheets: sheetOutlines, flatBounds, builtBounds };
}

/** Width and height of a placement as it actually lies on the sheet. */
function laidDimensions(placement: PlacedPart) {
  return {
    width: placement.rotated ? placement.part.height : placement.part.width,
    height: placement.rotated ? placement.part.width : placement.part.height,
  };
}

/** A standing panel's thickness axis, and its two face axes smallest first. */
function faceDimensions(part: AssemblyPart) {
  const axes = [
    { axis: 'x' as const, extent: part.size.x },
    { axis: 'y' as const, extent: part.size.y },
    { axis: 'z' as const, extent: part.size.z },
  ].sort((a, b) => a.extent - b.extent);

  // Thinnest is the thickness; the other two are the face
  return { thin: axes[0], face: [axes[1], axes[2]] as const };
}

const UNIT = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const;

/**
 * The rotation that stands a flat panel up into its place.
 *
 * The panel's own width has to end up along whichever world axis is that long,
 * and its height along the other; the thickness takes the axis that is left.
 * Deriving the basis from the extents this way handles shelves, sides, backs
 * and doors without a case for each.
 */
function standingRotation(
  part: AssemblyPart,
  boxWidth: number,
  boxHeight: number
): THREE.Quaternion {
  const { thin, face } = faceDimensions(part);

  // Of the two face axes, the panel's width goes on whichever it matches
  const [a, b] = face;
  const widthOnA =
    Math.abs(a.extent - boxWidth) + Math.abs(b.extent - boxHeight) <=
    Math.abs(b.extent - boxWidth) + Math.abs(a.extent - boxHeight);

  const localX = UNIT[widthOnA ? a.axis : b.axis].clone();
  const localZ = UNIT[widthOnA ? b.axis : a.axis].clone();
  const localY = UNIT[thin.axis].clone();

  const matrix = new THREE.Matrix4().makeBasis(localX, localY, localZ);

  // makeBasis can hand back a mirror rather than a rotation, which would turn
  // the panel inside out. Flipping one axis puts it back on the right hand.
  if (matrix.determinant() < 0) {
    matrix.makeBasis(localX.negate(), localY, localZ);
  }

  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

/** Roughly where each item sits, so a panel can tell its inside from its out. */
function centresByItem(parts: AssemblyPart[]): Map<string, THREE.Vector3> {
  const sums = new Map<string, { total: THREE.Vector3; count: number }>();

  for (const part of parts) {
    const entry = sums.get(part.itemId) ?? {
      total: new THREE.Vector3(),
      count: 0,
    };
    entry.total.add(new THREE.Vector3(part.position.x, part.position.y, part.position.z));
    entry.count++;
    sums.set(part.itemId, entry);
  }

  return new Map(
    [...sums].map(([id, { total, count }]) => [id, total.divideScalar(count)])
  );
}

/**
 * Where a panel's holes sit on the mesh, and which way they face.
 *
 * Shelf pins are bored into the inside of a side panel and hinge cups into the
 * back of a door - never the show face. Rather than special-casing each, the
 * face is chosen by standing the panel up and taking whichever side then looks
 * toward the middle of the item. That is the inside, by definition.
 */
function panelHoles(
  placement: PlacedPart,
  boxWidth: number,
  boxHeight: number,
  quaternion: THREE.Quaternion,
  part: AssemblyPart,
  itemCentres: Map<string, THREE.Vector3>
): PanelHole[] {
  const holes = placement.part.holes;
  if (holes.length === 0) return [];

  const centre = itemCentres.get(part.itemId);
  const position = new THREE.Vector3(part.position.x, part.position.y, part.position.z);

  // The panel's own thickness direction, once it is standing up
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
  const inward = centre ? centre.clone().sub(position) : new THREE.Vector3(0, 1, 0);
  const face: 1 | -1 = normal.dot(inward) >= 0 ? 1 : -1;

  return holes.map((hole) => ({
    x: hole.x - boxWidth / 2,
    z: hole.y - boxHeight / 2,
    diameter: hole.diameter,
    depth: hole.depth,
    face,
    kind: hole.layer === 'DRILL_35MM' ? ('cup' as const) : ('pin' as const),
  }));
}

/**
 * Find the rectangle on the sheet that became this panel.
 *
 * Nothing links the two lists directly - one is generated by the parts code
 * and the other by the assembly code - so they are matched on what they have
 * in common: the item they belong to and their size. Matching within an item
 * keeps two cabinets with identical shelves from stealing each other's parts.
 */
function matchPlacement(
  part: AssemblyPart,
  placements: { placement: PlacedPart; origin: THREE.Vector3 }[],
  used: Set<number>
): number | undefined {
  const face = faceDimensions(part);
  const wanted = [face.face[0].extent, face.face[1].extent].sort((a, b) => a - b);

  let best: number | undefined;
  let bestError = Infinity;

  for (let i = 0; i < placements.length; i++) {
    if (used.has(i)) continue;

    const { placement } = placements[i];
    if (placement.part.itemId !== part.itemId) continue;

    const dims = [placement.part.width, placement.part.height].sort((a, b) => a - b);
    const error = Math.abs(dims[0] - wanted[0]) + Math.abs(dims[1] - wanted[1]);

    if (error < bestError) {
      bestError = error;
      best = i;
    }
  }

  // A millimetre or two of rounding is fine; anything more is a different panel
  return bestError <= 2 ? best : undefined;
}
