import type { PartDefinition } from '../geometry/types';
import type { Project, CabinetItem } from './types';
import type { Supplier } from '../pricing/suppliers';
import { generateItemParts, cupsWouldFit } from '../geometry/parts';
import { planHinges } from '../geometry/door';
import { hingeCountForHeight } from '../geometry/hinge';

export interface HardwareItem {
  name: string;
  quantity: number;
  note?: string;
}

export interface Warning {
  itemId?: string;
  message: string;
}

/** Every part in the job, in item order. */
export function generateProjectParts(
  project: Project,
  thickness: number
): PartDefinition[] {
  return project.items.flatMap((item) => generateItemParts(item, thickness));
}

/**
 * Hardware to buy alongside the sheets.
 *
 * Counted across the whole job, since you order it in one go, but the note
 * says which hinge it is - the two styles are not interchangeable and only one
 * of them needs anything machined.
 */
export function summariseHardware(project: Project): HardwareItem[] {
  const items: HardwareItem[] = [];

  let noBore = 0;
  let euro = 0;
  let shelfPins = 0;

  for (const item of project.items) {
    if (item.kind !== 'cabinet') continue;

    shelfPins += item.adjustableShelves * 4;

    if (!item.doors || item.doorCount <= 0) continue;

    const perDoor = hingeCountForHeight(item.height);
    const total = item.doorCount * perDoor;

    if (item.hingeStyle === 'no-bore') noBore += total;
    else euro += planHinges(item.height, item.doorCount, item.doorHingeSide).length;
  }

  if (noBore > 0) {
    items.push({
      name: '90° no-drill hydraulic hinge',
      quantity: noBore,
      note: 'Full overlay, sprung. Screws to the face - nothing to bore.',
    });
  }

  if (euro > 0) {
    items.push({
      name: 'Concealed hinge, 35mm cup',
      quantity: euro,
      note: 'Full overlay. Needs the cup bored and the plate screwed on.',
    });
    items.push({
      name: 'Hinge mounting plate',
      quantity: euro,
      note: '37mm from the front edge of the side panel',
    });
  }

  if (shelfPins > 0) {
    items.push({
      name: 'Shelf pin, 5mm',
      quantity: shelfPins,
      note: '4 per adjustable shelf',
    });
  }

  return items;
}

/**
 * A last sheet with almost nothing on it.
 *
 * This is the most expensive thing that can quietly happen to a job: one part
 * over the line and you buy a whole extra sheet, plus whatever the supplier
 * charges per sheet on top. It is also the easiest to fix, because a few
 * millimetres off almost anything usually pulls it back. Worth interrupting for.
 */
export function spilloverWarning(
  sheets: { placements: unknown[] }[],
  marginalCost: string
): Warning | null {
  if (sheets.length < 2) return null;

  const last = sheets[sheets.length - 1];
  const parts = last.placements.length;
  const busiest = Math.max(...sheets.map((s) => s.placements.length));

  // Only worth saying when the last sheet is nearly bare - a genuinely full
  // second sheet is just a big job
  if (parts > Math.max(2, busiest * 0.25)) return null;

  return {
    message:
      `The last sheet carries ${parts === 1 ? 'a single part' : `only ${parts} parts`}, ` +
      `and it costs ${marginalCost}. Taking a few millimetres off something, or ` +
      'dropping one spare panel, would very likely save the whole sheet.',
  };
}

/** Anything about this job that will bite at the saw or during assembly. */
export function projectWarnings(project: Project, thickness: number): Warning[] {
  const warnings: Warning[] = [];

  for (const item of project.items) {
    if (item.kind !== 'cabinet') continue;

    if (item.width <= 2 * thickness) {
      warnings.push({
        itemId: item.id,
        message: `${item.name} is only ${item.width}mm wide, which is not enough for two ${thickness}mm sides.`,
      });
      continue;
    }

    if (!item.doors || item.doorCount <= 0) continue;

    if (item.hingeStyle === 'euro-35' && !cupsWouldFit(item as CabinetItem, thickness)) {
      const doorWidth =
        (item.width - (item.doorCount - 1) * item.doorGap) / item.doorCount;
      warnings.push({
        itemId: item.id,
        message:
          `A ${Math.round(doorWidth)}mm door in ${thickness}mm material is too ` +
          'small for a 35mm cup, so the cups are left off. Switch to no-drill ' +
          'hinges, or use fewer doors.',
      });
    }

    if (item.doorCount > 2) {
      warnings.push({
        itemId: item.id,
        message:
          `${item.doorCount} doors need a centre divider to hinge the inner ` +
          'ones onto, which this design does not include.',
      });
    }
  }

  return warnings;
}

/**
 * What is left for you once the pack arrives.
 *
 * This is the sharpest difference between the two suppliers. A panel saw makes
 * rectangles and nothing else, so every hole in the exported DXF is a drawing
 * to work from at home. A CNC makes the file, so the same holes come back
 * bored. Both leave the edges to you, since neither finishes them unless you
 * ask for edge banding.
 */
export function manualSteps(
  partDefs: PartDefinition[],
  supplier: Supplier
): string[] {
  const steps: string[] = [];

  const holes = partDefs.reduce(
    (sum, { part, quantity }) => sum + part.holes.length * quantity,
    0
  );

  if (holes > 0) {
    steps.push(
      supplier.cnc
        ? `${supplier.name} machine the file, so all ${holes} holes come back ` +
          'bored. Check the DXF before you send it - what is in it is what ' +
          'you get.'
        : `Drill ${holes} holes yourself. ${supplier.name} cut to size only, ` +
          'so the holes in the DXF are a drawing to work from, not something ' +
          'the saw will make.'
    );
  }

  steps.push(
    supplier.cnc
      ? 'Sand the cut edges. A router leaves them cleaner than a blade, but ' +
        'not finished.'
      : 'Sand the sawn edges - they come off the blade, not finished.'
  );

  steps.push(
    'Round over or edge-band any edge that will be seen or touched. The ply ' +
      'core shows on every cut edge; only the faces are laminated.'
  );

  return steps;
}
