/**
 * Who cuts the sheets, what they charge, and how much of the work they do.
 *
 * The two suppliers here are not interchangeable, and the difference is bigger
 * than price. Plyman cut to size on a panel saw and charge per cut, so every
 * hole in the DXF is a drawing you work from at home. PPR run a CNC and charge
 * a flat fee, so the same file comes back machined. Which one you pick changes
 * the estimate, the cut count's relevance, and how much bench work is left.
 *
 * Everything is transcribed from real paperwork and from the suppliers' own
 * product pages. It is a snapshot, not a feed: prices move, stock runs out,
 * and fees are whatever the counter says on the day. Every figure carries
 * where it came from and when, and the UI shows that next to the total.
 */

export type SupplierId = 'plyman' | 'ppr';

export type PriceSource = 'quote' | 'listed';

export interface SheetMaterial {
  id: string;
  /** As it appears on the invoice or the product page */
  name: string;
  /** The supplier's own product code, where the paperwork gave one */
  code?: string;
  thickness: number;
  sheetWidth: number;
  sheetHeight: number;
  /** NZD per sheet, excluding GST */
  price: number;
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
  source: PriceSource;
  inStock: boolean;
  /** Anything about the spec worth saying out loud */
  note?: string;
}

export interface SupplierCharges {
  /** Charged once per job whatever the size, like a machine set-up */
  setUp?: { label: string; amount: number };
  /** Charged per cut on a panel saw */
  perCut?: { label: string; amount: number };
  /** Charged per sheet run through a CNC */
  perSheet?: { label: string; amount: number };
  /**
   * Delivery, and only where the supplier has actually quoted one. Absent
   * means we do not know what it costs, which is different from free.
   */
  freight?: { label: string; amount: number; area: string };
  gstRate: number;
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
  /** Where these numbers came from */
  quote: {
    reference: string;
    dateLabel: string;
    /** ISO, for sorting and for knowing how stale this is */
    date: string;
    note?: string;
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
    quote: {
      reference: 'S19801',
      date: '2026-08-24',
      dateLabel: '24 August 2026',
    },
    deliveryNote:
      'Auckland only, on their own truck. Anywhere else is a phone call.',
    charges: {
      setUp: { label: 'Cutting set-up fee', amount: 40 },
      perCut: { label: 'Cutting service fee', amount: 4 },
      freight: { label: 'Delivery, Plyman truck', amount: 95, area: 'Auckland' },
      gstRate: 0.15,
    },
    materials: [
      {
        id: 'warm-white-16',
        name: '16mm HPL on Ply Warm White Matt',
        code: '241606',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 100,
        faceColor: '#f2ede3',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'Warm white',
        modulusMPa: 5000,
        source: 'quote',
        inStock: false,
      },
      {
        id: 'white-matt-16',
        name: '16mm White Matt HPL on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 117,
        faceColor: '#f7f7f5',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        source: 'listed',
        inStock: false,
      },
      {
        id: 'white-matt-18',
        name: '18mm White Matt HPL on Poplar',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 133.73,
        faceColor: '#f7f7f5',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        source: 'listed',
        inStock: false,
      },
      {
        id: 'white-gloss-16',
        name: '16mm White Gloss HPL on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 117,
        faceColor: '#fbfbfa',
        edgeColor: PLY_EDGE,
        finish: 'gloss',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        source: 'listed',
        inStock: true,
      },
      {
        id: 'black-matt-16',
        name: '16mm Black Matt HPL on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 143,
        faceColor: '#2a2b2d',
        edgeColor: PLY_EDGE,
        finish: 'matt',
        core: 'Poplar',
        colourName: 'Black',
        modulusMPa: 5000,
        source: 'listed',
        inStock: false,
      },
      {
        id: 'white-matt-birch-18',
        name: '18mm White Matt HPL on Birch',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 318,
        faceColor: '#f7f7f5',
        edgeColor: '#e8d5ae',
        finish: 'matt',
        core: 'Birch',
        colourName: 'White',
        modulusMPa: 9000,
        source: 'listed',
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
    quote: {
      reference: '16388',
      date: '2022-08-22',
      dateLabel: '22 August 2022',
      note:
        'The CNC fee is from a 2022 invoice for a single sheet, so it is ' +
        'treated as per sheet and is four years old. Confirm it before ' +
        'relying on it.',
    },
    deliveryNote:
      'No delivery price quoted. Invoice 16388 was collected from Penrose, ' +
      'so there is nothing to go on - ring them for a price, or pick it up.',
    charges: {
      // The invoice has one CNC CUTTING line at qty 1 against one sheet, so
      // per sheet is the reading that scales sanely. Worth confirming for a
      // job that runs to several sheets.
      perSheet: { label: 'CNC cutting', amount: 180 },
      // No freight line: the invoice shows $0.00 because it was a pickup, not
      // because they deliver for nothing.
      gstRate: 0.15,
    },
    materials: [
      {
        id: 'white-satin-16-quoted',
        name: '16mm HPL White Satin 2/S on Poplar',
        code: '160459',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 136,
        faceColor: '#f6f6f3',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        source: 'quote',
        inStock: true,
        note: 'Laminated both faces. The sheet on invoice 16388.',
      },
      {
        id: 'white-satin-16',
        name: '16mm HPL Satin White 2F on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 105,
        faceColor: '#f6f6f3',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        source: 'listed',
        inStock: true,
        note: 'Laminated both faces.',
      },
      {
        id: 'white-satin-18',
        name: '18mm HPL Satin White 2F on Poplar',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 115,
        faceColor: '#f6f6f3',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'White',
        modulusMPa: 5000,
        source: 'listed',
        inStock: true,
        note: 'Laminated both faces. 50 in stock when last checked.',
      },
      {
        id: 'black-satin-16',
        name: '16mm HPL Satin Black 2F on Poplar',
        thickness: 16,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 105,
        faceColor: '#2a2b2d',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'Black',
        modulusMPa: 5000,
        source: 'listed',
        inStock: true,
        note: 'Laminated both faces.',
      },
      {
        id: 'black-satin-18',
        name: '18mm HPL Satin Black 2F on Poplar',
        thickness: 18,
        sheetWidth: 2440,
        sheetHeight: 1220,
        price: 115,
        faceColor: '#2a2b2d',
        edgeColor: PLY_EDGE,
        finish: 'satin',
        core: 'Poplar',
        colourName: 'Black',
        modulusMPa: 5000,
        source: 'listed',
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

export interface QuoteLine {
  label: string;
  quantity: number;
  amount: number;
}

export interface PriceEstimate {
  lines: QuoteLine[];
  subtotal: number;
  gst: number;
  total: number;
  /** True when the cut count actually moves the price */
  cutsAffectPrice: boolean;
  /** Whether the total has delivery in it, and where to */
  delivery: {
    included: boolean;
    /** False when the supplier has never quoted us a delivery price */
    quoted: boolean;
    area?: string;
  };
}

export interface PriceInput {
  supplier: Supplier;
  material: SheetMaterial;
  sheets: number;
  cuts: number;
  includeFreight: boolean;
}

/**
 * Build the estimate in the same shape as the invoice, so the two can be read
 * side by side.
 */
export function estimatePrice({
  supplier,
  material,
  sheets,
  cuts,
  includeFreight,
}: PriceInput): PriceEstimate {
  const { charges } = supplier;
  const lines: QuoteLine[] = [];

  lines.push({
    label: material.name,
    quantity: sheets,
    amount: round(sheets * material.price),
  });

  if (sheets > 0) {
    if (charges.setUp) {
      lines.push({
        label: charges.setUp.label,
        quantity: 1,
        amount: charges.setUp.amount,
      });
    }

    if (charges.perCut && cuts > 0) {
      lines.push({
        label: charges.perCut.label,
        quantity: cuts,
        amount: round(cuts * charges.perCut.amount),
      });
    }

    if (charges.perSheet) {
      lines.push({
        label: charges.perSheet.label,
        quantity: sheets,
        amount: round(sheets * charges.perSheet.amount),
      });
    }
  }

  if (includeFreight && charges.freight) {
    lines.push({
      label: charges.freight.label,
      quantity: 1,
      amount: charges.freight.amount,
    });
  }

  const subtotal = round(lines.reduce((sum, line) => sum + line.amount, 0));
  const gst = round(subtotal * charges.gstRate);

  return {
    lines,
    subtotal,
    gst,
    total: round(subtotal + gst),
    cutsAffectPrice: Boolean(charges.perCut),
    delivery: {
      included: Boolean(includeFreight && charges.freight),
      quoted: Boolean(charges.freight),
      area: charges.freight?.area,
    },
  };
}

/** How the total should be labelled, so a number never stands on its own. */
export function describeDelivery(estimate: PriceEstimate): string {
  if (estimate.delivery.included) {
    return `incl. shipping to ${estimate.delivery.area}`;
  }
  return 'not incl. shipping';
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function money(value: number): string {
  return value.toLocaleString('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
  });
}
