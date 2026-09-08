import type { Project, ProjectItem, ItemKind, CabinetItem } from './types';
import { DEFAULT_SUPPLIER_ID, getSupplier } from '../pricing/suppliers';

/**
 * What someone sees before they have done anything.
 *
 * One plain bookcase, no doors. A first screen has to be read before it can be
 * used, so it holds one thing rather than four, and that thing is open at the
 * front - the 3D view is the app's explanation of itself, and doors close it.
 * Everything else is one click away under Add.
 */
export function defaultProject(): Project {
  const items: ProjectItem[] = [
    {
      id: 'cabinet-1',
      kind: 'cabinet',
      name: 'Shelving cabinet',
      // An ordinary bookcase, sized to land on a single sheet. Taller than
      // about 1600 and the two long sides stop leaving room for the shelves
      // beside them, which tips the job onto a second sheet - a first screen
      // reading "2 sheets, 56% waste" says the tool is bad at its job rather
      // than that the design is.
      width: 800,
      height: 1600,
      depth: 280,
      adjustableShelves: 4,
      duty: 'normal',
      fixedTop: true,
      fixedBottom: true,
      backStyle: 'rails',
      backBraces: 2,
      backBraceHeight: 100,
      // Off to begin with. Doors are the one thing that hides the inside of
      // the model, and hiding it is a poor way to open.
      doors: false,
      doorCount: 2,
      doorGap: 3,
      hingeStyle: 'no-bore',
      doorHingeSide: 'left',
    },
  ];

  return {
    items,
    selectedItemId: items[0].id,
    supplierId: DEFAULT_SUPPLIER_ID,
    materialId: getSupplier(DEFAULT_SUPPLIER_ID).materials[0].id,
    routerBit: '6mm',
    packTight: true,
    includeFreight: true,
  };
}

// Monotonic, so a newly added item keeps a stable React key and a stable part
// id prefix for the whole session
let nextItemId = 1;

/** A sensible starting point for each kind of thing you can add. */
export function newItem(kind: ItemKind, existing: ProjectItem[]): ProjectItem {
  const id = `${kind}-new-${nextItemId++}`;
  const name = uniqueName(defaultName(kind), existing);

  switch (kind) {
    case 'cabinet':
      return {
        id,
        kind,
        name,
        width: 600,
        height: 700,
        depth: 280,
        adjustableShelves: 1,
        duty: 'normal',
        fixedTop: true,
        fixedBottom: true,
        backStyle: 'rails',
        backBraces: 2,
        backBraceHeight: 100,
        doors: false,
        doorCount: 2,
        doorGap: 3,
        hingeStyle: 'no-bore',
        doorHingeSide: 'left',
      } satisfies CabinetItem;

    case 'shelves':
      return { id, kind, name, width: 800, depth: 280, quantity: 2, duty: 'normal' };

    case 'panel':
      return { id, kind, name, width: 600, height: 300, quantity: 1 };
  }
}

function defaultName(kind: ItemKind): string {
  return { cabinet: 'Cabinet', shelves: 'Shelves', panel: 'Panel' }[kind];
}

/** "Cabinet", then "Cabinet 2" - so the item list stays readable. */
function uniqueName(base: string, existing: ProjectItem[]): string {
  const taken = new Set(existing.map((i) => i.name));
  if (!taken.has(base)) return base;

  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
