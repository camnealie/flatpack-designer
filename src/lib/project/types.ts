import type { HingeSide } from '../geometry/types';
import type { RouterBitKey } from '../constants';
import type { ShelfDuty } from '../engineering/shelf';

/**
 * A job is a list of things to make, cut from one material.
 *
 * That framing is the point: you set out to build a cabinet, then notice there
 * is most of a sheet left over, so you add a couple of shelves and a bench top
 * to use it up. Each thing is configured on its own and they all nest together,
 * because they all come off the same sheets and get charged as one job.
 */

export type ItemKind = 'cabinet' | 'shelves' | 'panel';

/**
 * How the doors hang.
 *
 * `no-bore` is the sprung, clip-on hinge that screws to the face of the side
 * panel and the back of the door - no 35mm cup, so nothing to machine, which
 * matters when the supplier does not do CNC. `euro-35` is the concealed hinge
 * that needs a cup bored in the door and plate screws in the panel.
 */
export type HingeStyle = 'no-bore' | 'euro-35';

/**
 * How the back of a carcass is closed in, if at all.
 *
 * These are alternatives, not options to combine: rails and a full panel do
 * the same job, so having both is paying twice for one thing.
 *
 * - `open`    nothing at the back
 * - `rails`   two or three rails across the back, enough to stop it racking
 * - `inset`   a panel housed inside the carcass, flush with the back edges
 * - `overlay` a panel laid over the back edges and screwed on
 *
 * Inset looks tidier and is much less forgiving: it has to fit the opening
 * exactly, and it eats into the depth every shelf behind it can be. Overlay
 * takes whatever it is given and costs nothing inside.
 */
export type BackStyle = 'open' | 'rails' | 'inset' | 'overlay';

interface ItemBase {
  id: string;
  name: string;
}

/** A carcass: two sides, optional fixed top and bottom, shelves, doors. */
export interface CabinetItem extends ItemBase {
  kind: 'cabinet';
  width: number;
  height: number;
  depth: number;
  adjustableShelves: number;
  /** What the shelves have to carry - decides whether they will sag */
  duty: ShelfDuty;
  fixedTop: boolean;
  fixedBottom: boolean;
  backStyle: BackStyle;
  /** Rails, when the back is closed in with them */
  backBraces: number;
  backBraceHeight: number;
  doors: boolean;
  doorCount: number;
  doorGap: number;
  hingeStyle: HingeStyle;
  doorHingeSide: HingeSide;
}

/** Loose boards - bracket them to a wall or drop them into an opening. */
export interface ShelvesItem extends ItemBase {
  kind: 'shelves';
  width: number;
  depth: number;
  quantity: number;
  duty: ShelfDuty;
}

/** A plain rectangle. A bench top, a filler strip, something out of the drop. */
export interface PanelItem extends ItemBase {
  kind: 'panel';
  width: number;
  height: number;
  quantity: number;
}

export type ProjectItem = CabinetItem | ShelvesItem | PanelItem;

export interface Project {
  items: ProjectItem[];
  /** Which item the controls and the highlight are pointed at */
  selectedItemId: string;
  /** Who is cutting it. Changes the price, and how much work is left to you. */
  supplierId: string;
  /** One material for the whole job - it is all one order */
  materialId: string;
  routerBit: RouterBitKey;
  packTight: boolean;
  includeFreight: boolean;
}

export const BACK_STYLE_LABELS: Record<BackStyle, string> = {
  open: 'Open',
  rails: 'Rails',
  inset: 'Panel, inset',
  overlay: 'Panel, on the back',
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  cabinet: 'Cabinet',
  shelves: 'Shelves',
  panel: 'Panel',
};

/** A one-line description of an item, for the list and the 3D labels. */
export function describeItem(item: ProjectItem): string {
  switch (item.kind) {
    case 'cabinet':
      return `${item.width} × ${item.height} × ${item.depth}`;
    case 'shelves':
      return `${item.quantity} × ${item.width} × ${item.depth}`;
    case 'panel':
      return `${item.quantity} × ${item.width} × ${item.height}`;
  }
}
