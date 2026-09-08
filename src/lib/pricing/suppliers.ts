/**
 * Who cuts the sheets, and how much of the work they do.
 *
 * Deliberately carries no rates. Both suppliers quoted this project privately,
 * and a supplier's pricing is theirs to publish, not ours - so what is here is
 * the shape of the bill rather than its total: which charges apply, and what
 * each one is counted against. That is the part that changes how you design.
 * The amounts stay on the author's machine.
 *
 * The two suppliers here are not interchangeable, and the difference is bigger
 * than price. Plyman cut to size on a panel saw and charge per cut, so every
 * hole in the DXF is a drawing you work from at home. PPR run a CNC and charge
 * a flat fee, so the same file comes back machined. Which one you pick changes
 * the estimate, the cut count's relevance, and how much bench work is left.
 */

export type SupplierId = 'plyman' | 'ppr';

export interface SheetMaterial {
  id: string;
  /** As it appears on the invoice or the product page */
  name: string;
  thickness: number;
  sheetWidth: number;
  sheetHeight: number;
  /** Laminate colour, for the 3D view */
  faceColor: string;
  /** Exposed ply core on every cut edge, for the 3D view */
  edgeColor: string;
  finish: string;
  core: string;
  /** The colour, named for the swatch picker */
  colourName: string;
  /**
   * Bending stiffness of the sheet, MPa. Poplar cores are soft and springy;
   * birch is roughly twice as stiff, which is most of why it costs three times
   * as much. This is what decides whether a shelf sags.
   */
  modulusMPa: number;
  inStock: boolean;
  /** Anything about the spec worth saying out loud */
  note?: string;
}

/**
 * What a supplier bills for. No amounts: knowing that a job is charged per cut
 * is what makes you nest it differently, and that survives their rates
 * changing.
 */
export interface SupplierCharges {
  /** Charged once per job whatever the size, like a machine set-up */
  setUp?: { label: string };
  /** Charged per cut on a panel saw */
  perCut?: { label: string };
  /** Charged per sheet run through a CNC */
  perSheet?: { label: string };
  /**
   * Delivery, and only where the supplier actually offers a quoted one.
   * Absent means we do not know, which is different from free.
   */
  freight?: { label: string; area: string };
}

export interface Supplier {
  id: SupplierId;
  name: string;
  location: string;
  url: string;
  /**
   * True when they machine the file, not just cut rectangles from it. This is
   * the single most consequential fact about a supplier: it decides whether
   * the holes in the exported DXF are made for you or left for you.
   */
  cnc: boolean;
  /** How the machine's blade or bit eats into the material (mm) */
  kerf: number;
  /**
   * The cutter, where the supplier runs a CNC. Its radius is the tightest
   * inside corner the machine can make, which is the number any slotted or
   * friction-fit joint has to be designed around - an internal square corner
   * simply does not exist on a router.
   */
  cutter?: {
    diameter: number;
    minInternalRadius: number;
    evidence: string;
  };
  /**
   * What we know about getting it to you. Always says something, because
   * "nothing shown" reads as "no charge" and that is the one thing it never
   * means.
   */
  deliveryNote: string;
  charges: SupplierCharges;
  materials: SheetMaterial[];
}

const PLY_EDGE = '#d9c9a3';

export const SUPPLIERS: Supplier[] = [
  {
    id: 'plyman',
    name: 'Plyman Henderson',
    location: 'Henderson, Auckland',
    url: 'https://plyman.co.nz',
    cnc: false,
    // From the cutting plan supplied with the quote: "Cut / blade thickness 4"
    kerf: 4,
    deliveryNote:
      'Auckland only, on their own truck. Anywhere else is a phone call.',
    charges: {
      setUp: { label: 'Cutting set-up fee' },
      perCut: { label: 'Cutting service fee' },
      freight: { label: 'Delivery, Plyman truck', area: 'Auckland' },
    },
    materials: [
      {
        id: 'warm-white-16',
        name: '16mm HPL on Ply Warm White Matt',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f2ede3',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'Warm white',
        modulusMPa: 5000,
        inStock: false,
      },
      {
        id: 'white-matt-16',
        name: '16mm White Matt HPL on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f7f7f5',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        inStock: false,
      },
      {
        id: 'white-matt-18',
        name: '18mm White Matt HPL on Poplar',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f7f7f5',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        inStock: false,
      },
      {
        id: 'white-gloss-16',
        name: '16mm White Gloss HPL on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#fbfbfa',
        edgeColor: PLY_EDGE,
        finish: 'gloss',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        inStock: true,
      },
      {
        id: 'black-matt-16',
        name: '16mm Black Matt HPL on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#2a2b2d',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'Black',
        modulusMPa: 5000,
        inStock: false,
      },
      {
        id: 'white-matt-birch-18',
        name: '18mm White Matt HPL on Birch',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f7f7f5',
        edgeColor: '#e8d5ae',
        finish: 'matt',
        core: 'Birch',
        colourName: 'White',
        modulusMPa: 9000,
        inStock: false,
      },
    ],
  },

  {
    id: 'ppr',
    name: 'PPR Penrose',
    location: 'Penrose, Auckland',
    url: 'https://pprpenrose.co.nz',
    cnc: true,
    // Measured off a job PPR cut: every inside corner in their DXF comes back
    // at exactly 5.00mm radius, and the drawing dimensions it as R5.00. That
    // is a 10mm cutter, which is also the gap two parts need between them for
    // the tool to pass without cutting into the neighbour.
    kerf: 10,
    cutter: {
      diameter: 10,
      minInternalRadius: 5,
      evidence: 'Measured from a cut file: 32 inside corners, all R5.00',
    },
    deliveryNote:
      'They have not quoted us a delivery price, so there is nothing to go on ' +
      '- ring them for one, or collect from Penrose.',
    charges: {
      // Charged against the sheet rather than the cut, which is why the cut
      // count does not move the bill here.
      perSheet: { label: 'CNC cutting' },
      // No freight: they have never quoted us one. That is not the same as
      // delivering for nothing.
    },
    materials: [
      {
        id: 'white-satin-16-quoted',
        name: '16mm HPL White Satin 2/S on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f6f6f3',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        inStock: true,
        note: 'Laminated both faces.',
      },
      {
        id: 'white-satin-16',
        name: '16mm HPL Satin White 2F on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f6f6f3',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        inStock: true,
        note: 'Laminated both faces.',
      },
      {
        id: 'white-satin-18',
        name: '18mm HPL Satin White 2F on Poplar',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#f6f6f3',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        inStock: true,
        note: 'Laminated both faces. 50 in stock when last checked.',
      },
      {
        id: 'black-satin-16',
        name: '16mm HPL Satin Black 2F on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#2a2b2d',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'Black',
        modulusMPa: 5000,
        inStock: true,
        note: 'Laminated both faces.',
      },
      {
        id: 'black-satin-18',
        name: '18mm HPL Satin Black 2F on Poplar',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        faceColor: '#2a2b2d',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'Black',
        modulusMPa: 5000,
        inStock: true,
        note: 'Laminated both faces.',
      },
    ],
  },
];

export const DEFAULT_SUPPLIER_ID: SupplierId = 'plyman';

export function getSupplier(id: string): Supplier {
  return SUPPLIERS.find((s) => s.id === id) ?? SUPPLIERS[0];
}

/** The thicknesses this supplier actually stocks, for sizing advice. */
export function stockedThicknesses(supplier: Supplier): number[] {
  return [...new Set(supplier.materials.map((m) => m.thickness))].sort(
    (a, b) => a - b
  );
}

/**
 * The same product in another thickness, for "you want 18mm here" to be one
 * click rather than a hunt through the list.
 */
export function materialInThickness(
  supplier: Supplier,
  material: SheetMaterial,
  thickness: number
): SheetMaterial | undefined {
  return supplier.materials.find(
    (m) =>
      m.thickness === thickness &&
      m.colourName === material.colourName &&
      m.finish === material.finish &&
      m.core === material.core
  );
}

export function getMaterial(supplier: Supplier, materialId: string): SheetMaterial {
  return (
    supplier.materials.find((m) => m.id === materialId) ?? supplier.materials[0]
  );
}

/** One line you would see on the invoice, without the figure. */
export interface ChargeLine {
  label: string;
  /** What the charge is counted against, e.g. "2 sheets" or "24 cuts" */
  basis: string;
}

export interface ChargeSummary {
  lines: ChargeLine[];
  /** True when the cut count actually moves the bill */
  cutsAffectPrice: boolean;
  delivery: {
    included: boolean;
    /** False when the supplier has never quoted a delivery price */
    quoted: boolean;
    area?: string;
  };
}

export interface ChargeInput {
  supplier: Supplier;
  material: SheetMaterial;
  sheets: number;
  cuts: number;
  includeFreight: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The shape of the bill: which charges apply and what each is counted against.
 *
 * Deliberately without amounts. Knowing that Plyman bill per cut and PPR bill
 * per sheet is what makes you nest a job differently, and that stays true when
 * their rates change - which rates in a repo would not.
 */
export function describeCharges({
  supplier,
  material,
  sheets,
  cuts,
  includeFreight,
}: ChargeInput): ChargeSummary {
  const { charges } = supplier;
  const lines: ChargeLine[] = [];

  lines.push({ label: material.name, basis: plural(sheets, 'sheet') });

  if (sheets > 0) {
    if (charges.setUp) {
      lines.push({ label: charges.setUp.label, basis: 'once per job' });
    }
    if (charges.perCut && cuts > 0) {
      lines.push({ label: charges.perCut.label, basis: plural(cuts, 'cut') });
    }
    if (charges.perSheet) {
      lines.push({ label: charges.perSheet.label, basis: plural(sheets, 'sheet') });
    }
  }

  if (includeFreight && charges.freight) {
    lines.push({ label: charges.freight.label, basis: charges.freight.area });
  }

  return {
    lines,
    cutsAffectPrice: Boolean(charges.perCut),
    delivery: {
      included: Boolean(includeFreight && charges.freight),
      quoted: Boolean(charges.freight),
      area: charges.freight?.area,
    },
  };
}

/** How the job should be labelled where delivery matters. */
export function describeDelivery(summary: ChargeSummary): string {
  return summary.delivery.included
    ? `incl. shipping to ${summary.delivery.area}`
    : 'not incl. shipping';
}
