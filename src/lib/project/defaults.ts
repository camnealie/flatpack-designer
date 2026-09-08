import type { Project, ProjectItem, ItemKind, CabinetItem } from './types';
import { DEFAULT_SUPPLIER_ID, getSupplier } from '../pricing/suppliers';

/**
 * Something to open on: one cabinet with doors, some loose shelves, and a
 * couple of panels cut from what is left of the sheet. Sized so the starting
 * job fits on a single sheet, since watching that hold or break as you change
 * things is most of what the app is for.
 */
export function defaultProject(): Project {
  const items: ProjectItem[] = [
    {
      id: 'cabinet-1',
      kind: 'cabinet',
      name: 'Shelving cabinet',
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
      doors: true,
      doorCount: 2,
      doorGap: 3,
      hingeStyle: 'no-bore',
      doorHingeSide: 'left',
    },
    {
      id: 'shelves-1',
      kind: 'shelves',
      name: 'Wall shelves',
      width: 1000,
      depth: 280,
      quantity: 2,
      duty: 'normal',
    },
    {
      id: 'panel-1',
      kind: 'panel',
      name: 'Bench top',
      width: 1200,
      height: 350,
      quantity: 1,
    },
    {
      id: 'panel-2',
      kind: 'panel',
      name: 'Bench strip',
      width: 1475,
      height: 190,
      quantity: 1,
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
