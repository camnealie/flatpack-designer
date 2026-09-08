/**
 * What holds it together, and what to drill for it.
 *
 * Screwing into the edge of plywood is the one part of flat-pack assembly that
 * reliably goes wrong: the ply splits along a glue line, or the screw wanders
 * out of the side, and either way the panel is scrap. It goes wrong because
 * people skip the pilot hole, and they skip it because nobody told them the
 * size. So the app names the screw, names the drill bit, and says where the
 * hole goes.
 */

export interface Fastener {
  name: string;
  quantity: number;
  /** Drill this first, into the panel edge */
  pilotMm: number;
  /** Clearance hole through the panel being fixed */
  clearanceMm: number;
  note: string;
}

export interface JointPlan {
  fasteners: Fastener[];
  /** Where the screws go along a joint, for the drawings and the notes */
  spacingMm: number;
  drills: string[];
}

/**
 * Confirmat screws, which are what flat-pack carcasses are actually built with.
 *
 * A confirmat has a fat, blunt shank and a coarse thread cut for panel edges,
 * so it pulls a butt joint tight without splitting the ply. It needs a stepped
 * hole - a clearance hole through the face panel and a pilot into the edge of
 * the other - and that step is why a normal wood screw is a poor substitute
 * here even though it looks similar.
 */
const CONFIRMAT = {
  '15-16': { length: 50, pilot: 5, clearance: 7, label: '7 × 50mm confirmat' },
  '18-19': { length: 50, pilot: 5, clearance: 7, label: '7 × 50mm confirmat' },
  '12-14': { length: 40, pilot: 5, clearance: 7, label: '7 × 40mm confirmat' },
} as const;

function confirmatFor(thickness: number) {
  if (thickness >= 17) return CONFIRMAT['18-19'];
  if (thickness >= 15) return CONFIRMAT['15-16'];
  return CONFIRMAT['12-14'];
}

// Two screws hold a joint square; past about this spacing a long joint needs
// another so the panel cannot bow away between them.
const MAX_SCREW_SPACING = 200;

/** Screws along one joint of this length, never fewer than two. */
export function screwsPerJoint(jointLengthMm: number): number {
  if (jointLengthMm <= 0) return 0;
  return Math.max(2, Math.ceil(jointLengthMm / MAX_SCREW_SPACING));
}

export interface CarcassJoints {
  /** Fixed panels meeting a side: top, bottom, and any fixed shelf */
  fixedJoints: number;
  /** Length of one such joint - the depth of the carcass */
  jointLengthMm: number;
  /** Rails screwed to the back edges */
  braceJoints: number;
  thicknessMm: number;
}

/**
 * The fasteners and drill sizes for a carcass.
 *
 * Only the fixed panels are counted: adjustable shelves sit on pins and are
 * not screwed to anything, which is the point of them.
 */
export function planJoints({
  fixedJoints,
  jointLengthMm,
  braceJoints,
  thicknessMm,
}: CarcassJoints): JointPlan {
  const screw = confirmatFor(thicknessMm);
  const perJoint = screwsPerJoint(jointLengthMm);

  // Every fixed panel meets a side at each end, so each one is two joints
  const carcassScrews = fixedJoints * 2 * perJoint;
  // A brace is screwed through the side into each end
  const braceScrews = braceJoints * 2 * 2;

  const total = carcassScrews + braceScrews;
  if (total === 0) return { fasteners: [], spacingMm: MAX_SCREW_SPACING, drills: [] };

  return {
    spacingMm: MAX_SCREW_SPACING,
    fasteners: [
      {
        name: screw.label,
        quantity: total,
        pilotMm: screw.pilot,
        clearanceMm: screw.clearance,
        note: `${perJoint} a joint, evenly spaced across the ${jointLengthMm}mm depth`,
      },
    ],
    drills: [
      `${screw.clearance}mm through the side panel, so the screw passes freely`,
      `${screw.pilot}mm × ${screw.length - thicknessMm}mm into the panel edge it pulls against`,
      'Drill the edge hole square and central, or the screw wanders out the face',
    ],
  };
}
