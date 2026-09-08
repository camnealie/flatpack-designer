import type { ProjectItem, CabinetItem, ShelvesItem } from './types';
import type { SheetMaterial, Supplier } from '../pricing/suppliers';
import { stockedThicknesses } from '../pricing/suppliers';
import { assessShelf, describeSag } from '../engineering/shelf';
import type { ShelfAssessment } from '../engineering/shelf';
import { planJoints } from '../engineering/fasteners';
import type { JointPlan } from '../engineering/fasteners';
import { shelfDepthFor } from '../geometry/parts';
import { openings } from '../engineering/openings';
import type { Opening } from '../engineering/openings';
import { shelfHeights, usablePinRows } from '../model3d/assembly';

/**
 * What we would tell someone about the thing they have just drawn.
 *
 * The app's whole problem is that its user knows what they want the furniture
 * to do and nothing about what plywood can do. So rather than leaving them to
 * discover that a metre-wide 16mm shelf sags, this works it out and says so in
 * millimetres, before they order the sheet.
 */

export interface ShelfAdvice extends ShelfAssessment {
  /** Clear span between whatever holds the shelf up */
  spanMm: number;
  sentence: string;
  /** Set when a thicker sheet would fix it and the supplier stocks one */
  upgradeToMm?: number;
}

export interface ItemAdvice {
  itemId: string;
  shelf?: ShelfAdvice;
  joints?: JointPlan;
  /** Clear heights between the shelves, bottom to top */
  openings?: Opening[];
  /**
   * Set when more shelves were asked for than there are pin rows to hold them.
   * A shelf has nowhere to sit between rows, so the extras simply do not exist.
   */
  shelvesCapped?: { asked: number; possible: number };
}

/**
 * The clear span a shelf in this item has to cross.
 *
 * In a carcass it is the gap between the side panels. A loose shelf has no
 * carcass, so the honest assumption is that it is held at its ends - which is
 * also the worst case, and the one worth warning about.
 */
function shelfSpan(item: CabinetItem | ShelvesItem, thickness: number): number {
  return item.kind === 'cabinet' ? item.width - 2 * thickness : item.width;
}

/**
 * The depth a shelf in this item actually ends up. An inset back takes a slice
 * off it, and a shallower shelf is a slightly springier one.
 */
function shelfDepth(
  item: CabinetItem | ShelvesItem,
  thickness: number
): number {
  return item.kind === 'cabinet' ? shelfDepthFor(item, thickness) : item.depth;
}

export function adviseItem(
  item: ProjectItem,
  supplier: Supplier,
  material: SheetMaterial
): ItemAdvice {
  const advice: ItemAdvice = { itemId: item.id };

  if (item.kind === 'panel') return advice;

  const spanMm = shelfSpan(item, material.thickness);
  const depthMm = shelfDepth(item, material.thickness);
  const hasShelves =
    item.kind === 'shelves'
      ? item.quantity > 0
      : item.adjustableShelves > 0 || item.fixedTop || item.fixedBottom;

  if (hasShelves && spanMm > 0 && depthMm > 0) {
    const assessment = assessShelf(
      {
        spanMm,
        depthMm,
        thicknessMm: material.thickness,
        modulusMPa: material.modulusMPa,
        duty: item.duty,
      },
      stockedThicknesses(supplier)
    );

    const upgrade =
      assessment.verdict !== 'fine' &&
      assessment.recommendedThicknessMm > material.thickness &&
      stockedThicknesses(supplier).includes(assessment.recommendedThicknessMm)
        ? assessment.recommendedThicknessMm
        : undefined;

    advice.shelf = {
      ...assessment,
      spanMm,
      sentence: describeSag(assessment),
      upgradeToMm: upgrade,
    };
  }

  if (item.kind === 'cabinet') {
    // The same shelf positions the 3D view uses, so the heights quoted here
    // are the heights you can see
    const t = material.thickness;
    const spanBottom = item.fixedBottom ? t : 0;
    const spanTop = item.fixedTop ? item.height - t : item.height;

    const rows = usablePinRows(item.height, spanBottom, spanTop, t);
    const placed = shelfHeights(
      item.height,
      item.adjustableShelves,
      spanBottom,
      spanTop,
      t
    );

    advice.openings = openings({
      spanBottomMm: spanBottom,
      spanTopMm: spanTop,
      shelfBottomsMm: placed,
      thicknessMm: t,
    });

    if (item.adjustableShelves > rows.length) {
      advice.shelvesCapped = {
        asked: item.adjustableShelves,
        possible: rows.length,
      };
    }

    const fixedJoints = (item.fixedTop ? 1 : 0) + (item.fixedBottom ? 1 : 0);
    advice.joints = planJoints({
      fixedJoints,
      jointLengthMm: item.depth,
      braceJoints: item.backBraces,
      thicknessMm: material.thickness,
    });
  }

  return advice;
}

export function adviseProject(
  items: ProjectItem[],
  supplier: Supplier,
  material: SheetMaterial
): ItemAdvice[] {
  return items.map((item) => adviseItem(item, supplier, material));
}

/**
 * The one-line version for the warnings strip.
 *
 * Only genuine problems make it here. A shelf that is merely worth watching
 * says so in its own panel rather than shouting from the top of the screen.
 */
/** Cabinets asked to hold more shelves than they have rows for. */
export function shelfCapWarnings(
  items: ProjectItem[],
  advice: ItemAdvice[]
): { itemId: string; message: string }[] {
  const byId = new Map(items.map((i) => [i.id, i]));

  return advice
    .filter((a) => a.shelvesCapped)
    .map((a) => {
      const capped = a.shelvesCapped!;
      const name = byId.get(a.itemId)?.name ?? 'This cabinet';

      return {
        itemId: a.itemId,
        message:
          `${name} is set to ${capped.asked} shelves but only has ` +
          `${capped.possible} pin rows to hang them on, so the extras are not ` +
          'there. Make it taller, or ask for fewer.',
      };
    });
}

export function sagWarnings(
  items: ProjectItem[],
  advice: ItemAdvice[],
  material: SheetMaterial
): { itemId: string; message: string }[] {
  const byId = new Map(items.map((i) => [i.id, i]));

  return advice
    .filter((a) => a.shelf?.verdict === 'toofar')
    .map((a) => {
      const item = byId.get(a.itemId);
      const shelf = a.shelf!;
      const fix = shelf.upgradeToMm
        ? `${shelf.upgradeToMm}mm would hold it.`
        : 'Shorten the span, add a centre support, or put a rail under the front edge.';

      return {
        itemId: a.itemId,
        message:
          `${item?.name ?? 'This item'} spans ${Math.round(shelf.spanMm)}mm in ` +
          `${material.thickness}mm ply. ${shelf.sentence} ${fix}`,
      };
    });
}
