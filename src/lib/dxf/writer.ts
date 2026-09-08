import type { Part, PlacedPart, Point } from '../geometry/types';

/**
 * DXF file format writer.
 * Generates DXF R12/AC1009 format which is widely compatible.
 */

// Layer definitions
const LAYERS = {
  CUT: { name: 'CUT', color: 7 },           // White - cut profile
  DRILL_5MM: { name: 'DRILL_5MM', color: 1 }, // Red - 5mm shelf pin / hinge plate holes
  DRILL_35MM: { name: 'DRILL_35MM', color: 6 }, // Magenta - 35mm hinge cups
  POCKET: { name: 'POCKET', color: 3 },     // Green - pocket operations
  LABEL: { name: 'LABEL', color: 5 },       // Blue - text labels
} as const;

/**
 * Generate DXF header section.
 */
function generateHeader(): string {
  return `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
9
$INSUNITS
70
4
9
$MEASUREMENT
70
1
0
ENDSEC
`;
}

/**
 * Generate DXF tables section with layer definitions.
 */
function generateTables(): string {
  const layerEntries = Object.values(LAYERS)
    .map(
      (layer) => `0
LAYER
2
${layer.name}
70
0
62
${layer.color}
6
CONTINUOUS`
    )
    .join('\n');

  return `0
SECTION
2
TABLES
0
TABLE
2
LTYPE
70
1
0
LTYPE
2
CONTINUOUS
70
0
3
Solid line
72
65
73
0
40
0.0
0
ENDTAB
0
TABLE
2
LAYER
70
${Object.keys(LAYERS).length}
${layerEntries}
0
ENDTAB
0
ENDSEC
`;
}

/**
 * Generate a closed rectangular polyline (LWPOLYLINE).
 */
function generateRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  layer: string
): string {
  return `0
LWPOLYLINE
8
${layer}
90
4
70
1
10
${x}
20
${y}
10
${x + width}
20
${y}
10
${x + width}
20
${y + height}
10
${x}
20
${y + height}
`;
}

/**
 * Generate a circle entity.
 */
function generateCircle(
  x: number,
  y: number,
  radius: number,
  layer: string
): string {
  return `0
CIRCLE
8
${layer}
10
${x}
20
${y}
30
0
40
${radius}
`;
}

/**
 * Generate a text label entity.
 */
function generateText(
  x: number,
  y: number,
  text: string,
  height: number,
  layer: string
): string {
  return `0
TEXT
8
${layer}
10
${x}
20
${y}
30
0
40
${height}
1
${text}
`;
}

/**
 * Generate a polyline from a path of points.
 */
function generatePolyline(
  points: Point[],
  closed: boolean,
  layer: string
): string {
  const pointEntries = points
    .map(
      (p) => `10
${p.x}
20
${p.y}`
    )
    .join('\n');

  return `0
LWPOLYLINE
8
${layer}
90
${points.length}
70
${closed ? 1 : 0}
${pointEntries}
`;
}

/**
 * Generate DXF entities for a single part placed on a sheet.
 */
function generatePartEntities(
  placement: PlacedPart,
  includeLabels: boolean = true
): string {
  const { part, x, y, rotated } = placement;
  const entities: string[] = [];

  // Calculate actual dimensions based on rotation
  const width = rotated ? part.height : part.width;
  const height = rotated ? part.width : part.height;

  // Cut profile rectangle
  entities.push(generateRectangle(x, y, width, height, LAYERS.CUT.name));

  // Holes - transform coordinates based on rotation
  for (const hole of part.holes) {
    let holeX: number;
    let holeY: number;

    if (rotated) {
      // Rotate hole positions 90° CCW
      holeX = x + hole.y;
      holeY = y + (part.width - hole.x);
    } else {
      holeX = x + hole.x;
      holeY = y + hole.y;
    }

    entities.push(
      generateCircle(holeX, holeY, hole.diameter / 2, hole.layer)
    );
  }

  // Grooves
  for (const groove of part.grooves) {
    let transformedPath: Point[];

    if (rotated) {
      transformedPath = groove.path.map((p) => ({
        x: x + p.y,
        y: y + (part.width - p.x),
      }));
    } else {
      transformedPath = groove.path.map((p) => ({
        x: x + p.x,
        y: y + p.y,
      }));
    }

    entities.push(generatePolyline(transformedPath, false, groove.layer));
  }

  // Label
  if (includeLabels) {
    const labelX = x + width / 2 - (part.name.length * 2);
    const labelY = y + height / 2;
    entities.push(generateText(labelX, labelY, part.name, 10, LAYERS.LABEL.name));
  }

  return entities.join('');
}

/**
 * Generate complete DXF file for a sheet with placed parts.
 */
export function generateSheetDXF(
  placements: PlacedPart[],
  _sheetWidth: number,
  _sheetHeight: number,
  _sheetIndex: number,
  includeLabels: boolean = true
): string {
  const sections: string[] = [];

  // Header
  sections.push(generateHeader());

  // Tables (layers)
  sections.push(generateTables());

  // Entities section
  const entities: string[] = [];

  // Sheet outline (for reference, on CUT layer but could be separate)
  // Using a dashed representation or comment - we'll skip the sheet outline
  // to avoid confusion with actual cut paths

  // Part entities
  for (const placement of placements) {
    entities.push(generatePartEntities(placement, includeLabels));
  }

  sections.push(`0
SECTION
2
ENTITIES
${entities.join('')}0
ENDSEC
`);

  // EOF
  sections.push(`0
EOF
`);

  return sections.join('');
}

/**
 * Generate DXF content for a single part (for preview/testing).
 */
export function generatePartDXF(part: Part): string {
  const placement: PlacedPart = {
    part,
    x: 0,
    y: 0,
    rotated: false,
  };

  return generateSheetDXF([placement], part.width, part.height, 0, true);
}
