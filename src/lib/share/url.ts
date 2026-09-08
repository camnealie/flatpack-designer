import type {
  Project,
  ProjectItem,
  CabinetItem,
  ShelvesItem,
  PanelItem,
  HingeStyle,
  BackStyle,
} from '../project/types';
import type { HingeSide } from '../geometry/types';
import type { ShelfDuty } from '../engineering/shelf';
import type { RouterBitKey } from '../constants';

/**
 * A design in a link.
 *
 * The app has no accounts and no server, so the URL is the only place a design
 * can live. That makes the encoding a storage format: it has to survive being
 * pasted into a message, and it has to survive the app changing shape
 * underneath it, which is why it carries a version and why decoding treats
 * everything it finds as untrusted.
 *
 * Items are written as positional arrays rather than objects because a shared
 * link gets read by a human before it gets clicked, and a 300-character link
 * looks like a link while a 1500-character one looks like a mistake.
 */

/**
 * Bumped when the shape of an item changes. Old links still decode - a link
 * someone was sent last week opening to something is the entire point of
 * putting the design in the URL, so a version bump migrates rather than
 * rejects.
 */
const VERSION = 2;
const READABLE_VERSIONS = [1, 2];

type Encoded = unknown[];

// Compact codes, so the shape of an item costs one character
const KIND_CODE = { cabinet: 'c', shelves: 's', panel: 'p' } as const;
const DUTY_CODE: ShelfDuty[] = ['light', 'normal', 'heavy'];
const HINGE_CODE: HingeStyle[] = ['no-bore', 'euro-35'];
const BACK_CODE: BackStyle[] = ['open', 'rails', 'inset', 'overlay'];

/** Booleans travel as one packed integer rather than a run of true/false. */
function pack(flags: boolean[]): number {
  return flags.reduce((bits, flag, i) => bits | (flag ? 1 << i : 0), 0);
}

function unpack(bits: unknown, index: number): boolean {
  return typeof bits === 'number' && (bits & (1 << index)) !== 0;
}

function encodeItem(item: ProjectItem): Encoded {
  switch (item.kind) {
    case 'cabinet':
      return [
        KIND_CODE.cabinet,
        item.name,
        item.width,
        item.height,
        item.depth,
        item.adjustableShelves,
        DUTY_CODE.indexOf(item.duty),
        pack([item.fixedTop, item.fixedBottom, item.doors]),
        item.backBraces,
        item.backBraceHeight,
        item.doorCount,
        item.doorGap,
        HINGE_CODE.indexOf(item.hingeStyle),
        item.doorHingeSide === 'right' ? 1 : 0,
        BACK_CODE.indexOf(item.backStyle),
      ];

    case 'shelves':
      return [
        KIND_CODE.shelves,
        item.name,
        item.width,
        item.depth,
        item.quantity,
        DUTY_CODE.indexOf(item.duty),
      ];

    case 'panel':
      return [
        KIND_CODE.panel,
        item.name,
        item.width,
        item.height,
        item.quantity,
      ];
  }
}

export function encodeProject(project: Project): string {
  const payload: Encoded = [
    VERSION,
    project.supplierId,
    project.materialId,
    project.routerBit,
    pack([project.packTight, project.includeFreight]),
    Math.max(
      0,
      project.items.findIndex((i) => i.id === project.selectedItemId)
    ),
    ...project.items.map(encodeItem),
  ];

  return toBase64Url(JSON.stringify(payload));
}

/**
 * Rebuild a project from a link.
 *
 * Anything at all can arrive here - a truncated paste, a link from an older
 * build, someone editing the hash by hand - so every field is checked and a
 * bad one falls back rather than throwing. A half-readable link is still worth
 * opening; a crash on load is not.
 */
export function decodeProject(encoded: string): Project | null {
  let payload: unknown;

  try {
    payload = JSON.parse(fromBase64Url(encoded));
  } catch {
    return null;
  }

  if (!Array.isArray(payload)) return null;

  const version = payload[0];
  if (typeof version !== 'number' || !READABLE_VERSIONS.includes(version)) {
    return null;
  }

  const [, supplierId, materialId, routerBit, flags, selectedIndex, ...rest] =
    payload;

  const items = rest
    .map((raw, index) => decodeItem(raw, index, version))
    .filter((item): item is ProjectItem => item !== null);

  if (items.length === 0) return null;

  const selected =
    typeof selectedIndex === 'number' && items[selectedIndex]
      ? items[selectedIndex]
      : items[0];

  return {
    items,
    selectedItemId: selected.id,
    supplierId: asString(supplierId, 'plyman'),
    materialId: asString(materialId, ''),
    routerBit: asString(routerBit, '6mm') as RouterBitKey,
    packTight: unpack(flags, 0),
    includeFreight: unpack(flags, 1),
  };
}

function decodeItem(
  raw: unknown,
  index: number,
  version: number
): ProjectItem | null {
  if (!Array.isArray(raw)) return null;

  const [kind, name] = raw;
  // Ids are positional. Nothing outside the link refers to them, and rebuilding
  // them keeps two shared designs from ever colliding.
  const id = `${kind}-${index}`;
  const label = asString(name, 'Item');

  if (kind === KIND_CODE.cabinet) {
    return {
      id,
      kind: 'cabinet',
      name: label,
      width: asNumber(raw[2], 600, 50, 3000),
      height: asNumber(raw[3], 700, 50, 3000),
      depth: asNumber(raw[4], 280, 50, 1200),
      adjustableShelves: asNumber(raw[5], 1, 0, 20),
      duty: DUTY_CODE[asNumber(raw[6], 1, 0, 2)] ?? 'normal',
      fixedTop: unpack(raw[7], 0),
      fixedBottom: unpack(raw[7], 1),
      // Version 1 packed a back-panel flag alongside an independent rail
      // count, so a link could ask for both. The panel wins, since that is
      // what someone who ticked it was picturing.
      doors: unpack(raw[7], version === 1 ? 3 : 2),
      backStyle: decodeBackStyle(raw, version),
      backBraces: asNumber(raw[8], 0, 0, 10),
      backBraceHeight: asNumber(raw[9], 100, 10, 600),
      doorCount: asNumber(raw[10], 2, 1, 6),
      doorGap: asNumber(raw[11], 3, 0, 20),
      hingeStyle: HINGE_CODE[asNumber(raw[12], 0, 0, 1)] ?? 'no-bore',
      doorHingeSide: (raw[13] === 1 ? 'right' : 'left') as HingeSide,
    } satisfies CabinetItem;
  }

  if (kind === KIND_CODE.shelves) {
    return {
      id,
      kind: 'shelves',
      name: label,
      width: asNumber(raw[2], 800, 50, 3000),
      depth: asNumber(raw[3], 280, 50, 1200),
      quantity: asNumber(raw[4], 2, 1, 50),
      duty: DUTY_CODE[asNumber(raw[5], 1, 0, 2)] ?? 'normal',
    } satisfies ShelvesItem;
  }

  if (kind === KIND_CODE.panel) {
    return {
      id,
      kind: 'panel',
      name: label,
      width: asNumber(raw[2], 600, 10, 3000),
      height: asNumber(raw[3], 300, 10, 3000),
      quantity: asNumber(raw[4], 1, 1, 50),
    } satisfies PanelItem;
  }

  return null;
}

function decodeBackStyle(raw: unknown[], version: number): BackStyle {
  if (version >= 2) {
    return BACK_CODE[asNumber(raw[14], 0, 0, BACK_CODE.length - 1)] ?? 'open';
  }

  if (unpack(raw[7], 2)) return 'inset';
  return asNumber(raw[8], 0, 0, 10) > 0 ? 'rails' : 'open';
}

function asString(value: unknown, fallback: string): string {
  // Long enough for any real name, short enough that a link cannot be a payload
  return typeof value === 'string' && value.length <= 60 ? value : fallback;
}

function asNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * base64url, so the whole design survives being pasted anywhere a link goes.
 * Plain base64 uses `+` and `/`, which chat clients and mail readers mangle.
 */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The design currently in the address bar, if there is one. */
export function readProjectFromLocation(): Project | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash.replace(/^#/, '');
  return hash ? decodeProject(hash) : null;
}

/**
 * Keep the address bar current without adding a history entry per keystroke -
 * dragging a slider would otherwise bury the back button under a thousand
 * states.
 */
export function writeProjectToLocation(project: Project): void {
  if (typeof window === 'undefined') return;

  const encoded = encodeProject(project);
  if (encoded === window.location.hash.replace(/^#/, '')) return;

  window.history.replaceState(null, '', `#${encoded}`);
}

export function shareUrl(project: Project): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${encodeProject(project)}`;
}
