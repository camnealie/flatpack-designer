/**
 * Will that shelf sag?
 *
 * The commonest way to waste money on a flat-pack is to save it on thickness:
 * a 12mm sheet is cheaper than 18mm, and the shelf looks identical on the day
 * it goes up. Six months later it has a smile in it, and the fix is a new
 * shelf. So rather than a table of "max spans" this works the real number and
 * says it in millimetres, which anyone can picture.
 *
 * A shelf is a beam carrying a spread load, supported at both ends:
 *
 *     deflection = 5 w L^4 / (384 E I)      I = depth x thickness^3 / 12
 *
 * The thickness is cubed, which is the whole story: 18mm is only 12% thicker
 * than 16mm but sags 30% less, and doubling the span makes it sag sixteen
 * times as much. Everything below is SI internally and millimetres at the edges.
 */

/** What people actually put on shelves, in kg per square metre. */
export type ShelfDuty = 'light' | 'normal' | 'heavy';

export const DUTIES: Record<
  ShelfDuty,
  { label: string; description: string; kgPerSquareMetre: number }
> = {
  light: {
    label: 'Light',
    description: 'Ornaments, plants, a few plates',
    kgPerSquareMetre: 25,
  },
  normal: {
    label: 'Normal',
    description: 'Pantry, folders, kitchen things',
    kgPerSquareMetre: 50,
  },
  heavy: {
    label: 'Heavy',
    description: 'Books, tools, records',
    kgPerSquareMetre: 100,
  },
};

const GRAVITY = 9.81;

/**
 * How much sag is acceptable.
 *
 * Structurally a shelf is fine well past this; these are the points where it
 * starts to look wrong, which is what people actually complain about. The
 * span/200 rule is the usual joinery limit, and the flat cap stops a very long
 * shelf passing on a technicality.
 */
const VISIBLE_SAG_MM = 4;
const SPAN_RATIO = 200;

export type Verdict = 'fine' | 'marginal' | 'toofar';

export interface ShelfAssessment {
  /** Sag at midspan, in mm */
  sagMm: number;
  /** The sag at which this span starts to look wrong, in mm */
  limitMm: number;
  verdict: Verdict;
  /** Thinnest stocked thickness that would pass, if one would */
  recommendedThicknessMm: number;
}

export interface ShelfInput {
  /** Clear span between supports, mm */
  spanMm: number;
  /** Front to back, mm */
  depthMm: number;
  thicknessMm: number;
  /** Bending modulus of the sheet, MPa */
  modulusMPa: number;
  duty: ShelfDuty;
}

/**
 * Midspan sag for a shelf carrying an evenly spread load.
 *
 * Simply supported is the right model for a shelf on pins: the ends can rotate
 * freely, so it sags more than one screwed rigidly at both ends. Assuming the
 * stiffer case would under-report the sag, which is the wrong way to be wrong.
 */
export function shelfSagMm({
  spanMm,
  depthMm,
  thicknessMm,
  modulusMPa,
  duty,
}: ShelfInput): number {
  if (spanMm <= 0 || depthMm <= 0 || thicknessMm <= 0) return 0;

  const span = spanMm / 1000;
  const depth = depthMm / 1000;
  const thickness = thicknessMm / 1000;

  // Load per metre of shelf: an area load over the shelf's own depth
  const loadPerMetre = DUTIES[duty].kgPerSquareMetre * GRAVITY * depth;

  const modulus = modulusMPa * 1e6;
  const second = (depth * thickness ** 3) / 12;

  const sag = (5 * loadPerMetre * span ** 4) / (384 * modulus * second);
  return sag * 1000;
}

/** The sag at which a shelf of this span starts to look wrong. */
export function sagLimitMm(spanMm: number): number {
  return Math.min(VISIBLE_SAG_MM, spanMm / SPAN_RATIO);
}

/**
 * The thinnest sheet that would hold this span to its limit.
 *
 * Rearranging the beam equation for thickness, then rounded up to something a
 * supplier actually sells - there is no point recommending 16.4mm.
 */
export function thicknessNeededMm(
  input: Omit<ShelfInput, 'thicknessMm'>,
  stocked: number[]
): number {
  const { spanMm, depthMm, modulusMPa, duty } = input;
  if (spanMm <= 0 || depthMm <= 0) return 0;

  const span = spanMm / 1000;
  const depth = depthMm / 1000;
  const limit = sagLimitMm(spanMm) / 1000;

  const loadPerMetre = DUTIES[duty].kgPerSquareMetre * GRAVITY * depth;
  const modulus = modulusMPa * 1e6;

  const secondNeeded = (5 * loadPerMetre * span ** 4) / (384 * modulus * limit);
  const exact = Math.cbrt((12 * secondNeeded) / depth) * 1000;

  const options = [...stocked].sort((a, b) => a - b);
  return options.find((t) => t >= exact) ?? exact;
}

export function assessShelf(
  input: ShelfInput,
  stocked: number[]
): ShelfAssessment {
  const sagMm = shelfSagMm(input);
  const limitMm = sagLimitMm(input.spanMm);

  // A little under the limit is worth mentioning without crying wolf
  const verdict: Verdict =
    sagMm > limitMm ? 'toofar' : sagMm > limitMm * 0.7 ? 'marginal' : 'fine';

  return {
    sagMm,
    limitMm,
    verdict,
    recommendedThicknessMm: thicknessNeededMm(input, stocked),
  };
}

/** Plain-language sag, for people who do not think in millimetres of deflection. */
export function describeSag(assessment: ShelfAssessment): string {
  const sag = assessment.sagMm;

  if (assessment.verdict === 'fine') {
    return sag < 0.5
      ? 'No noticeable sag.'
      : `About ${round(sag)}mm of sag in the middle, which you would not spot.`;
  }

  if (assessment.verdict === 'marginal') {
    return `About ${round(sag)}mm of sag in the middle. Fine for now, but it will settle further under load.`;
  }

  return `About ${round(sag)}mm of sag in the middle - enough to see along the front edge.`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
