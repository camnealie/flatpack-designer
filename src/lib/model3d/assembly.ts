import type { HingeSide } from '../geometry/types';
import type { Project, ProjectItem, CabinetItem } from '../project/types';
import { shelfPinRows } from '../geometry/upright';
import { planHinges } from '../geometry/door';
import { canBoreCups } from '../geometry/hinge';
import { shelfDepthFor } from '../geometry/parts';
import { HINGES } from '../constants';

/**
 * The job, standing up.
 *
 * This is the counterpart to `geometry/parts.ts`: the same items seen as
 * furniture rather than as rectangles to cut. Nothing here feeds the saw - its
 * whole job is to let you look at what you are about to cut and catch the
 * mistake a parts list hides, like a shelf that cannot reach the pin row you
 * assumed, or doors that swing into each other.
 *
 * Coordinates are millimetres in three.js's frame:
 *   +X right, +Y up, +Z toward the viewer (out of the cabinet's face).
 * Items stand in a row, left to right, in the order you added them; the viewer
 * recentres on the returned bounds.
 *
 * It is deliberately pure - no three.js, no React - so it stays cheap to run
 * on every keystroke and easy to reason about on its own.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type AssemblyRole =
  | 'side'
  | 'fixed'
  | 'shelf'
  | 'door'
  | 'back'
  | 'brace'
  | 'hinge';

export interface AssemblyPart {
  id: string;
  label: string;
  /** The item this belongs to, so selecting one can pick it out of the scene */
  itemId: string;
  role: AssemblyRole;
  shape: 'box' | 'cylinder';
  /** Full extents along each axis (not half-extents). */
  size: Vec3;
  /** Centre of the part, in world millimetres. */
  position: Vec3;
  /**
   * Doors only: the vertical axis they swing about, and which way. `direction`
   * is the sign applied to the open angle, so a left-hung door opens left.
   */
  swing?: { pivotX: number; direction: 1 | -1 };
  /** Hinges only: the door this rides on, so it swings with it. */
  attachedTo?: string;
  /**
   * Drawn see-through: cut and counted, but with no fixed place in the
   * assembly, like a loose shelf destined for brackets.
   */
  ghost?: boolean;
}

export interface Assembly {
  parts: AssemblyPart[];
  bounds: { min: Vec3; max: Vec3 };
}

// Items stand as separate pieces rather than fused into a run
const ITEM_GAP = 150;

// Lay the job out in rows about this wide. In a single row a couple of bench
// tops push everything else off into the distance and the cabinet you are
// actually editing ends up a thumbnail; wrapping keeps the scene roughly
// square, so every item stays big enough to judge.
const ROW_WIDTH = 2600;

// Loose shelves have no carcass, so they stack at a believable pitch rather
// than spreading over a wall's worth of height
const LOOSE_SHELF_PITCH = 340;
const LOOSE_SHELF_BASE = 380;

export function buildAssembly(project: Project, thickness: number): Assembly {
  const parts: AssemblyPart[] = [];

  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;

  for (const item of project.items) {
    const built = buildItem(item, thickness);
    if (built.parts.length === 0) continue;

    // Start a new row behind this one rather than running off to the right
    if (cursorX > 0 && cursorX + built.width > ROW_WIDTH) {
      cursorZ -= rowDepth + ITEM_GAP;
      cursorX = 0;
      rowDepth = 0;
    }

    parts.push(...translate(built.parts, cursorX, cursorZ));
    cursorX += built.width + ITEM_GAP;
    rowDepth = Math.max(rowDepth, built.depth);
  }

  return { parts, bounds: boundsOf(parts) };
}

/** Slide a finished item into its place in the layout. */
function translate(parts: AssemblyPart[], dx: number, dz: number): AssemblyPart[] {
  if (dx === 0 && dz === 0) return parts;

  return parts.map((part) => ({
    ...part,
    position: {
      ...part.position,
      x: part.position.x + dx,
      z: part.position.z + dz,
    },
    swing: part.swing
      ? { ...part.swing, pivotX: part.swing.pivotX + dx }
      : undefined,
  }));
}

/** Everything in one item, built at the origin, and the footprint it takes. */
function buildItem(
  item: ProjectItem,
  thickness: number
): { parts: AssemblyPart[]; width: number; depth: number } {
  switch (item.kind) {
    case 'cabinet':
      return buildCabinet(item, thickness);

    case 'shelves':
      // Loose boards have no carcass to sit in, so they stack at a plausible
      // pitch to show how many there are and how far they run.
      return {
        width: item.width,
        depth: item.depth,
        parts: Array.from(
          { length: Math.max(0, Math.round(item.quantity)) },
          (_, i) => ({
            id: `${item.id}-shelf-${i}`,
            label: item.name,
            itemId: item.id,
            role: 'shelf' as const,
            shape: 'box' as const,
            size: { x: item.width, y: thickness, z: item.depth },
            position: {
              x: item.width / 2,
              y: LOOSE_SHELF_BASE + i * LOOSE_SHELF_PITCH + thickness / 2,
              z: item.depth / 2,
            },
            ghost: true,
          })
        ),
      };

    case 'panel':
      // A plain rectangle has no orientation in the job, so it lies flat where
      // its real size reads against everything standing up.
      return {
        width: item.width,
        depth: item.height,
        parts: Array.from(
          { length: Math.max(0, Math.round(item.quantity)) },
          (_, i) => ({
            id: `${item.id}-panel-${i}`,
            label: item.name,
            itemId: item.id,
            role: 'shelf' as const,
            shape: 'box' as const,
            size: { x: item.width, y: thickness, z: item.height },
            position: {
              x: item.width / 2,
              y: thickness / 2 + i * (thickness + 2),
              z: item.height / 2,
            },
          })
        ),
      };
  }
}

function buildCabinet(
  item: CabinetItem,
  t: number
): { parts: AssemblyPart[]; width: number; depth: number } {
  const { width: W, height: H, depth: D } = item;

  // Guard against the half-typed dimensions that arrive while a field is still
  // being edited - a zero-width box makes three.js draw nothing useful.
  if (W <= 2 * t || H <= 2 * t || D <= 0) {
    return { parts: [], width: 0, depth: 0 };
  }

  const parts: AssemblyPart[] = [];
  const innerWidth = W - 2 * t;

  const box = (
    id: string,
    label: string,
    role: AssemblyRole,
    size: Vec3,
    position: Vec3
  ): AssemblyPart => ({
    id: `${item.id}-${id}`,
    label,
    itemId: item.id,
    role,
    shape: 'box',
    size,
    position,
  });

  (['left', 'right'] as const).forEach((side) => {
    parts.push(
      box(
        `side-${side}`,
        `${side === 'left' ? 'Left' : 'Right'} side`,
        'side',
        { x: t, y: H, z: D },
        {
          x: side === 'left' ? t / 2 : W - t / 2,
          y: H / 2,
          z: D / 2,
        }
      )
    );
  });

  if (item.fixedBottom) {
    parts.push(
      box(
        'fixed-bottom',
        'Fixed bottom',
        'fixed',
        { x: innerWidth, y: t, z: D },
        { x: W / 2, y: t / 2, z: D / 2 }
      )
    );
  }

  if (item.fixedTop) {
    parts.push(
      box(
        'fixed-top',
        'Fixed top',
        'fixed',
        { x: innerWidth, y: t, z: D },
        { x: W / 2, y: H - t / 2, z: D / 2 }
      )
    );
  }

  const spanBottom = item.fixedBottom ? t : 0;
  const spanTop = item.fixedTop ? H - t : H;

  // An inset back takes a slice off the rear, so the shelves stop short of it
  const shelfZ = shelfDepthFor(item, t);

  shelfHeights(H, item.adjustableShelves, spanBottom, spanTop, t).forEach((y, i) => {
    parts.push(
      box(
        `shelf-${i}`,
        `Adjustable shelf ${i + 1}`,
        'shelf',
        { x: innerWidth, y: t, z: shelfZ },
        { x: W / 2, y: y + t / 2, z: D - shelfZ / 2 }
      )
    );
  });

  if (item.backStyle === 'rails' && item.backBraces > 0 && item.backBraceHeight > 0) {
    const braceH = item.backBraceHeight;
    const travel = Math.max(0, spanTop - spanBottom - braceH);

    for (let i = 0; i < item.backBraces; i++) {
      const fraction = item.backBraces === 1 ? 0 : i / (item.backBraces - 1);
      const bottom = spanTop - braceH - fraction * travel;
      parts.push(
        box(
          `brace-${i}`,
          'Back brace',
          'brace',
          { x: innerWidth, y: braceH, z: t },
          { x: W / 2, y: bottom + braceH / 2, z: t / 2 }
        )
      );
    }
  }

  if (item.backStyle === 'inset') {
    const bottom = item.fixedBottom ? t : 0;
    const top = item.fixedTop ? H - t : H;

    parts.push(
      box(
        'back',
        'Back panel',
        'back',
        { x: innerWidth, y: top - bottom, z: t },
        { x: W / 2, y: (bottom + top) / 2, z: t / 2 }
      )
    );
  }

  if (item.backStyle === 'overlay') {
    // Laid on the back edges rather than housed between them, so it sits
    // proud of the carcass instead of inside it
    parts.push(
      box(
        'back',
        'Back panel',
        'back',
        { x: W, y: H, z: t },
        { x: W / 2, y: H / 2, z: -t / 2 }
      )
    );
  }

  parts.push(...buildDoors(item, t));

  return { parts, width: W, depth: D + t };
}

/** Full-overlay doors across the face, plus any hinges worth drawing. */
function buildDoors(item: CabinetItem, t: number): AssemblyPart[] {
  if (!item.doors || item.doorCount <= 0) return [];

  const { width: W, height: H, depth: D, doorCount, doorGap } = item;
  const doorWidth = (W - (doorCount - 1) * doorGap) / doorCount;
  if (doorWidth <= 0) return [];

  const hinges = planHinges(H, doorCount, item.doorHingeSide);

  // The no-bore hinge has no cup, so nothing is drawn on the back of the door
  // for it - a disc there would imply machining that is not happening.
  const showCups = item.hingeStyle === 'euro-35' && canBoreCups(doorWidth, t);

  return Array.from({ length: doorCount }, (_, i) => {
    const left = i * (doorWidth + doorGap);
    const side: HingeSide = hinges.find((h) => h.doorIndex === i)?.side ?? 'left';
    const pivotX = side === 'left' ? left : left + doorWidth;
    const id = `${item.id}-door-${i}`;

    const door: AssemblyPart = {
      id,
      label: doorCount > 1 ? `Door ${i + 1}` : 'Door',
      itemId: item.id,
      role: 'door',
      shape: 'box',
      size: { x: doorWidth, y: H, z: t },
      position: { x: left + doorWidth / 2, y: H / 2, z: D + t / 2 },
      swing: { pivotX, direction: side === 'left' ? -1 : 1 },
    };

    if (!showCups) return [door];

    const cupX =
      side === 'left'
        ? left + HINGES.CUP_EDGE_INSET
        : left + doorWidth - HINGES.CUP_EDGE_INSET;

    const cups = hinges
      .filter((h) => h.doorIndex === i)
      .map<AssemblyPart>((h, k) => ({
        id: `${id}-hinge-${k}`,
        label: 'Hinge',
        itemId: item.id,
        role: 'hinge',
        shape: 'cylinder',
        size: {
          x: HINGES.CUP_DIAMETER,
          y: HINGES.CUP_DIAMETER,
          z: HINGES.CUP_DEPTH,
        },
        position: { x: cupX, y: h.y, z: D - HINGES.CUP_DEPTH / 2 },
        attachedTo: id,
      }));

    return [door, ...cups];
  }).flat();
}

/**
 * The pin rows a shelf could actually sit on inside this carcass.
 *
 * A shelf rests on pins, so its choices are the bored rows and nothing else.
 * The count of them is also a hard ceiling on how many shelves the cabinet can
 * hold, which is worth knowing before someone asks for ten.
 */
export function usablePinRows(
  panelHeight: number,
  spanBottom: number,
  spanTop: number,
  thickness: number
): number[] {
  return shelfPinRows(panelHeight).filter(
    (y) => y >= spanBottom && y + thickness <= spanTop
  );
}

/**
 * Where the adjustable shelves actually land.
 *
 * Shelves can only sit on bored rows, so this picks which rows to use - and it
 * picks them together rather than one at a time. Snapping each shelf to its
 * own nearest row is the obvious approach and it goes wrong in exactly the
 * case that matters: several shelves compete for the same row, get bumped
 * apart one by one, and the spacing ends up lopsided.
 *
 * Instead this searches for the set of rows whose resulting gaps sit closest
 * to equal, by dynamic programming over (row, shelves placed so far). The cost
 * of a gap is its squared difference from the ideal, which punishes one badly
 * wrong gap harder than several slightly wrong ones - the right trade, since a
 * single tight shelf is what people notice.
 *
 * Asking for more shelves than there are rows is not possible, so the extras
 * are dropped rather than stacked on top of each other. `usablePinRows` is how
 * the UI knows to say so.
 */
export function shelfHeights(
  panelHeight: number,
  count: number,
  spanBottom: number,
  spanTop: number,
  thickness: number
): number[] {
  if (count <= 0 || spanTop - spanBottom < thickness) return [];

  const rows = usablePinRows(panelHeight, spanBottom, spanTop, thickness);
  if (rows.length === 0) return [];

  const wanted = Math.min(Math.round(count), rows.length);
  const ideal = (spanTop - spanBottom - wanted * thickness) / (wanted + 1);

  const n = rows.length;
  const cost: number[][] = Array.from({ length: wanted + 1 }, () =>
    new Array<number>(n).fill(Infinity)
  );
  const cameFrom: number[][] = Array.from({ length: wanted + 1 }, () =>
    new Array<number>(n).fill(-1)
  );

  // First shelf: the gap below it is measured from the floor of the span
  for (let i = 0; i < n; i++) {
    cost[1][i] = squared(rows[i] - spanBottom - ideal);
  }

  for (let placed = 2; placed <= wanted; placed++) {
    for (let i = 0; i < n; i++) {
      for (let previous = 0; previous < i; previous++) {
        if (cost[placed - 1][previous] === Infinity) continue;

        const gap = rows[i] - (rows[previous] + thickness);
        if (gap < 0) continue;

        const total = cost[placed - 1][previous] + squared(gap - ideal);
        if (total < cost[placed][i]) {
          cost[placed][i] = total;
          cameFrom[placed][i] = previous;
        }
      }
    }
  }

  // Close off with the gap above the topmost shelf
  let best = Infinity;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (cost[wanted][i] === Infinity) continue;

    const total =
      cost[wanted][i] + squared(spanTop - (rows[i] + thickness) - ideal);
    if (total < best) {
      best = total;
      last = i;
    }
  }

  if (last < 0) return [];

  const chosen: number[] = [];
  for (let placed = wanted, i = last; placed >= 1 && i >= 0; placed--) {
    chosen.unshift(rows[i]);
    i = cameFrom[placed][i];
  }

  return chosen;
}

function squared(value: number): number {
  return value * value;
}

function boundsOf(parts: AssemblyPart[]): Assembly['bounds'] {
  if (parts.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const part of parts) {
    (['x', 'y', 'z'] as const).forEach((axis) => {
      const half = part.size[axis] / 2;
      min[axis] = Math.min(min[axis], part.position[axis] - half);
      max[axis] = Math.max(max[axis], part.position[axis] + half);
    });
  }

  return { min, max };
}
