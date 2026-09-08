import * as THREE from 'three';
import type { AssemblyPart, Assembly } from '../model3d/assembly';
import type { Supplier } from '../pricing/suppliers';
import type { ProjectItem } from './types';
import { screwsPerJoint } from '../engineering/fasteners';

/**
 * What you actually have to do, in the order you have to do it.
 *
 * The gap this fills is not knowledge, it is nerve. Someone looking at a
 * quote for a sheet of ply is not worried about the maths; they are worried
 * that a box of rectangles will arrive and they will not know where to start.
 * So the plan is deliberately mundane: sand, drill, this panel to that one,
 * these screws, next. Nine steps you can count beats an animation you can only
 * watch.
 */

export type StepKind = 'prep' | 'ready' | 'drill' | 'join' | 'fit' | 'hang' | 'done';

export interface Screw {
  /** Where the head sits, world coordinates */
  head: THREE.Vector3;
  /** The way it drives, unit vector */
  direction: THREE.Vector3;
  length: number;
}

export interface BuildStep {
  id: string;
  kind: StepKind;
  title: string;
  instruction: string;
  /** Every panel standing by the end of this step */
  placed: string[];
  /** Panels arriving in this step, so they can be picked out */
  arriving: string[];
  screws: Screw[];
  /** Holes are visible from the step that makes them onward */
  showHoles: boolean;
  /** The prep steps light up every cut edge */
  highlightEdges: boolean;
  tool?: string;
}

export interface BuildPlan {
  steps: BuildStep[];
  /** Total screws over the whole job, for the closing step */
  screwCount: number;
}

export function buildPlan(
  assembly: Assembly,
  items: ProjectItem[],
  supplier: Supplier,
  thickness: number,
  /** Holes across the whole job, counted from the parts that carry them */
  holeCount: number
): BuildPlan {
  const steps: BuildStep[] = [];
  const placed: string[] = [];

  const panels = assembly.parts.filter((p) => p.role !== 'hinge');

  steps.push({
    id: 'roundover',
    kind: 'prep',
    title: 'Soften the edges that will show',
    instruction:
      'Every edge comes off the machine sharp and slightly furry. Give them a ' +
      'rub with 120 then 180 grit, and take the corner off anything you will ' +
      'see or touch - a front edge, a shelf nose, a door. Edges that end up ' +
      'buried in a joint can stay as they are, and the faces are already ' +
      'finished, so leave those alone.',
    placed: [],
    arriving: [],
    screws: [],
    highlightEdges: true,
    showHoles: false,
    tool: 'Sanding block, or a 3mm round-over bit',
  });

  if (holeCount > 0) {
    steps.push(
      supplier.cnc
        ? {
            id: 'holes',
            kind: 'ready',
            title: 'Check the holes',
            instruction:
              `${supplier.name} machine the file, so all ${holeCount} holes ` +
              'arrive already bored. Worth a look before you start: it is much ' +
              'easier to spot a wrong hole now than halfway through assembly.',
            placed: [],
            arriving: [],
            screws: [],
            showHoles: true,
            highlightEdges: false,
          }
        : {
            id: 'holes',
            kind: 'drill',
            title: `Drill ${holeCount} holes`,
            instruction:
              'These are the shelf pin holes. Mark one panel, then clamp the ' +
              'pair together and drill both at once - that way the shelves sit ' +
              'level even if your marking is out. A depth stop keeps you from ' +
              'coming through the face.',
            placed: [],
            arriving: [],
            screws: [],
            showHoles: true,
            highlightEdges: false,
            tool: '5mm brad point, 12mm deep',
          }
    );
  }

  for (const item of items) {
    if (item.kind !== 'cabinet') continue;

    const own = panels.filter((p) => p.itemId === item.id);
    if (own.length === 0) continue;

    steps.push(...cabinetSteps(item, own, placed, thickness, items.length > 1));
  }

  // Loose boards need no assembly, so they get one honest line rather than a
  // step that pretends otherwise
  const loose = items.filter((i) => i.kind !== 'cabinet');
  if (loose.length > 0) {
    const loosePanels = panels.filter((p) =>
      loose.some((i) => i.id === p.itemId)
    );
    placed.push(...loosePanels.map((p) => p.id));

    steps.push({
      id: 'loose',
      kind: 'fit',
      title: 'The loose boards',
      instruction:
        `${listNames(loose)} need nothing doing to them beyond the sanding. ` +
        'Fix them to whatever they are going on - brackets, cleats, or an ' +
        'existing opening.',
      placed: [...placed],
      arriving: loosePanels.map((p) => p.id),
      screws: [],
      showHoles: holeCount > 0,
      highlightEdges: false,
    });
  }

  const screwCount = steps.reduce((sum, step) => sum + step.screws.length, 0);

  steps.push({
    id: 'done',
    kind: 'done',
    title: 'Done',
    instruction:
      `That is the whole job: ${steps.filter((s) => s.kind === 'join').length} ` +
      `joints, ${screwCount} screws, and a couple of hours with a drill. ` +
      'Stand it up, check it for square, and adjust the shelves where you want them.',
    placed: [...placed],
    arriving: [],
    screws: [],
    showHoles: holeCount > 0,
    highlightEdges: false,
  });

  return { steps, screwCount };
}

/** The joins for one carcass, in the order a person would actually do them. */
function cabinetSteps(
  item: ProjectItem,
  own: AssemblyPart[],
  placed: string[],
  thickness: number,
  named: boolean
): BuildStep[] {
  const steps: BuildStep[] = [];
  const prefix = named ? `${item.name}: ` : '';

  const byRole = (role: AssemblyPart['role']) =>
    own.filter((p) => p.role === role);

  const sides = byRole('side').sort((a, b) => a.position.x - b.position.x);
  const fixed = byRole('fixed').sort((a, b) => a.position.y - b.position.y);
  const braces = byRole('brace');
  const backs = byRole('back');
  const shelves = byRole('shelf');
  const doors = byRole('door');

  const [left, right] = sides;
  const bottom = fixed[0];
  const top = fixed[fixed.length - 1];

  const add = (step: Omit<BuildStep, 'placed'>) => {
    placed.push(...step.arriving);
    steps.push({ ...step, placed: [...placed] });
  };

  if (bottom && left) {
    add({
      id: `${item.id}-start`,
      kind: 'join',
      title: `${prefix}Start with the bottom and one side`,
      instruction:
        'Lay the side flat with its inside face up and stand the bottom panel ' +
        'on its end. Screw through the side into the end of the bottom. Getting ' +
        'this first corner square is what makes the rest of it easy.',
      arriving: [left.id, bottom.id],
      screws: jointScrews(left, bottom, thickness),
      showHoles: true,
      highlightEdges: false,
      tool: 'Square, and a clamp if you have one',
    });
  }

  if (right && bottom) {
    const targets = [bottom, ...(fixed.length > 2 ? fixed.slice(1, -1) : [])];
    add({
      id: `${item.id}-right`,
      kind: 'join',
      title: `${prefix}Add the other side`,
      instruction:
        'Stand the assembly up and bring the second side onto the free end of ' +
        'the bottom. Same screws, same square.',
      arriving: [right.id],
      screws: targets.flatMap((t) => jointScrews(right, t, thickness)),
      showHoles: true,
      highlightEdges: false,
    });
  }

  if (top && top !== bottom) {
    add({
      id: `${item.id}-top`,
      kind: 'join',
      title: `${prefix}Fit the top`,
      instruction:
        'The top pulls the two sides parallel, so measure across the front and ' +
        'the back before you drive the last screw. A carcass that is square now ' +
        'will take its doors without a fight.',
      arriving: [top.id],
      screws: sides.flatMap((s) => jointScrews(s, top, thickness)),
      showHoles: true,
      highlightEdges: false,
    });
  }

  if (braces.length > 0) {
    add({
      id: `${item.id}-braces`,
      kind: 'join',
      title: `${prefix}Screw on the back rails`,
      instruction:
        'The rails stop the carcass leaning like a parallelogram, and they are ' +
        'what you screw into the wall through. Check it is square one more time ' +
        'first - once these are on, it stays however you left it.',
      arriving: braces.map((b) => b.id),
      screws: braces.flatMap((b) =>
        sides.flatMap((s) => jointScrews(s, b, thickness))
      ),
      showHoles: true,
      highlightEdges: false,
    });
  }

  if (backs.length > 0) {
    const inset = item.kind === 'cabinet' && item.backStyle === 'inset';

    add({
      id: `${item.id}-back`,
      kind: 'join',
      title: `${prefix}Fit the back panel`,
      instruction: inset
        ? 'This one drops into the opening, so check it for square first - an ' +
          'inset back will only go in if the carcass is true. Pin or screw it ' +
          'round all four edges.'
        : 'This one lays over the back edges, so it is also what pulls the ' +
          'carcass square: line one corner up, fix it, then work round. Pin or ' +
          'screw it round all four edges.',
      arriving: backs.map((b) => b.id),
      screws: [],
      showHoles: true,
      highlightEdges: false,
    });
  }

  if (shelves.length > 0) {
    add({
      id: `${item.id}-shelves`,
      kind: 'fit',
      title: `${prefix}Drop in the shelves`,
      instruction:
        'Four pins per shelf, and it lifts straight back out whenever you want ' +
        'to move it. Nothing is screwed here - that is the whole point of the ' +
        'row of holes.',
      arriving: shelves.map((s) => s.id),
      screws: [],
      showHoles: true,
      highlightEdges: false,
    });
  }

  if (doors.length > 0) {
    add({
      id: `${item.id}-doors`,
      kind: 'hang',
      title: `${prefix}Hang the doors`,
      instruction:
        'Hinges on the door first, then offer it up to the side panel. Leave ' +
        'the screws slightly loose until both doors are on, then adjust until ' +
        'the gap down the middle is even and nip them up.',
      arriving: doors.map((d) => d.id),
      screws: [],
      showHoles: true,
      highlightEdges: false,
      tool: 'A pencil and some patience',
    });
  }

  return steps;
}

/**
 * Screws through one panel into the end of another.
 *
 * `through` is the panel the screw passes across - a side, normally - and
 * `into` is the one it pulls against, so the screw runs along whichever axis
 * separates them and spreads along the length of their shared joint.
 */
function jointScrews(
  through: AssemblyPart,
  into: AssemblyPart,
  thickness: number
): Screw[] {
  const from = new THREE.Vector3(
    through.position.x,
    through.position.y,
    through.position.z
  );
  const to = new THREE.Vector3(into.position.x, into.position.y, into.position.z);

  // The screw drives along whichever axis the two panels are separated on,
  // which is the direction the through-panel is thin in
  const axis = thinAxis(through);
  const direction = new THREE.Vector3();
  direction[axis] = Math.sign(to[axis] - from[axis]) || 1;

  // Spread along the longest axis of the joint they share
  const spread = spreadAxis(into, axis);
  const extent = into.size[spread];
  const count = screwsPerJoint(extent);

  return Array.from({ length: count }, (_, i) => {
    const fraction = (i + 0.5) / count;
    const head = new THREE.Vector3(to.x, to.y, to.z);

    // Start at the outer face of the panel being screwed through
    head[axis] = from[axis] - direction[axis] * (through.size[axis] / 2);
    head[spread] = to[spread] - extent / 2 + extent * fraction;

    return { head, direction: direction.clone(), length: thickness * 3 };
  });
}

function thinAxis(part: AssemblyPart): 'x' | 'y' | 'z' {
  const { x, y, z } = part.size;
  if (x <= y && x <= z) return 'x';
  return y <= z ? 'y' : 'z';
}

/** The axis a row of screws runs along: the joint's longest shared direction. */
function spreadAxis(
  into: AssemblyPart,
  driveAxis: 'x' | 'y' | 'z'
): 'x' | 'y' | 'z' {
  const candidates = (['x', 'y', 'z'] as const).filter(
    (axis) => axis !== driveAxis && axis !== thinAxis(into)
  );

  if (candidates.length === 0) return driveAxis === 'z' ? 'x' : 'z';

  return candidates.reduce((best, axis) =>
    into.size[axis] > into.size[best] ? axis : best
  );
}

function listNames(items: ProjectItem[]): string {
  const names = items.map((i) => i.name);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
