/**
 * How much room is actually between the shelves.
 *
 * Shelf count is the easiest thing to increase and the easiest to get wrong:
 * nothing on screen stops someone putting eight shelves in a 700mm cabinet,
 * and the parts list happily prices it. What is missing is the number that
 * matters - the clear height of each opening - and, more to the point, what
 * that height means. "218mm" is data. "A cereal box will not stand up in
 * there" is an answer.
 */

export interface Opening {
  /** Clear height between one surface and the next thing above it, mm */
  heightMm: number;
  /** Where the bottom of the opening sits above the floor, mm */
  fromMm: number;
  fits: string;
  tooTight: boolean;
}

/**
 * Everyday things and the height they need, tallest first.
 *
 * Chosen to be things people can picture without measuring, and spread so that
 * each step down is a noticeably different kind of storage rather than a few
 * millimetres less.
 */
const FITS: { needs: number; label: string }[] = [
  { needs: 400, label: 'tall bottles, vases, small appliances' },
  { needs: 330, label: 'a wine bottle or an LP standing up' },
  { needs: 300, label: 'a cereal box' },
  { needs: 250, label: 'a kettle or a stack of A4 folders' },
  { needs: 200, label: 'paperbacks and cereal bowls' },
  { needs: 150, label: 'mugs and tins standing up' },
  { needs: 115, label: 'a tin of beans' },
  { needs: 80, label: 'stacked plates, or bottles on their side' },
  { needs: 70, label: 'trays, boards and flat things' },
];

/**
 * Below this an opening is not storage, it is a gap.
 *
 * The pin ladder is on 64mm centres, so shelves cannot get closer than about
 * 48mm apart however many are asked for - which means without this the model
 * silently accepts nine shelves in a 700mm cabinet and reports every opening
 * as fine. Anything under 70mm is worth calling out instead.
 */
const TOO_TIGHT = 70;

export function describeOpening(heightMm: number): { fits: string; tooTight: boolean } {
  if (heightMm < TOO_TIGHT) {
    return {
      fits: 'too tight to be useful - almost nothing will go in here',
      tooTight: true,
    };
  }

  const match = FITS.find((f) => heightMm >= f.needs);
  return { fits: match ? match.label : FITS[FITS.length - 1].label, tooTight: false };
}

export interface OpeningInput {
  /** Inside height of the carcass, floor of the opening stack to its ceiling */
  spanBottomMm: number;
  spanTopMm: number;
  /** Bottom face height of each shelf, above the carcass floor */
  shelfBottomsMm: number[];
  thicknessMm: number;
}

/**
 * The openings a carcass ends up with, bottom to top.
 *
 * Each one runs from the top of whatever is below it to the underside of the
 * next thing up, so the shelves' own thickness is taken out - which is exactly
 * the part people forget when they work it out in their head.
 */
export function openings({
  spanBottomMm,
  spanTopMm,
  shelfBottomsMm,
  thicknessMm,
}: OpeningInput): Opening[] {
  const sorted = [...shelfBottomsMm].sort((a, b) => a - b);

  const result: Opening[] = [];
  let floor = spanBottomMm;

  for (const bottom of sorted) {
    result.push(makeOpening(floor, bottom));
    floor = bottom + thicknessMm;
  }

  result.push(makeOpening(floor, spanTopMm));

  return result.filter((o) => o.heightMm > 0);
}

function makeOpening(fromMm: number, toMm: number): Opening {
  const heightMm = Math.max(0, toMm - fromMm);
  return { heightMm, fromMm, ...describeOpening(heightMm) };
}
