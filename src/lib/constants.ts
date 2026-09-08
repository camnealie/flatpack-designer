// 32mm System Constants
// The 32mm system is a European cabinet standard where shelf pin holes
// are spaced 32mm apart vertically

export const SYSTEM_32MM = {
  // Hole spacing in vertical direction
  HOLE_SPACING: 32,

  // Distance from front/back edges to hole columns
  HOLE_EDGE_INSET: 37,

  // Distance from top/bottom to first/last holes
  HOLE_END_MARGIN: 37,

  // Standard shelf pin hole diameter
  SHELF_PIN_HOLE_DIAMETER: 5,

  // Standard shelf pin hole depth
  SHELF_PIN_HOLE_DEPTH: 12,
} as const;

// Router bit sizes (diameter in mm)
export const ROUTER_BITS = {
  '3mm': 3,
  '6mm': 6,
  '8mm': 8,
  '10mm': 10,
  '12mm': 12,
} as const;

// Door defaults
export const DOORS = {
  // Reveal between adjacent doors (mm)
  DEFAULT_GAP: 3,
} as const;

// Concealed ("Euro") cabinet hinge - the 35mm cup standard that pairs with
// the 32mm system. Every number here is a real hardware constraint, not a
// preference: get one wrong and the door either binds or will not mount.
export const HINGES = {
  // Cup bored into the back of the door
  CUP_DIAMETER: 35,
  CUP_DEPTH: 12.5,

  // Centre of the cup, measured in from the door's hinge edge. 22.5mm is the
  // common setting; the hinge's own adjustment absorbs the rest.
  CUP_EDGE_INSET: 22.5,

  // A cup this close to the edge blows out the door, so the door must be at
  // least this wide for the boring to be sane.
  MIN_DOOR_WIDTH: 2 * 22.5 + 35,

  // Distance from door top/bottom to the first and last cup centres
  END_OFFSET: 100,

  // Mounting plate on the side panel: two screws on the 32mm system line,
  // 32mm apart vertically, straddling the hinge centre.
  PLATE_SCREW_DIAMETER: 5,
  PLATE_SCREW_DEPTH: 12,
  PLATE_SCREW_SPACING: 32,

  // Plate screws sit on the front 32mm column - same inset as the shelf pins
  PLATE_EDGE_INSET: 37,

  // How much thicker than the cup the door must stay, so the cup does not
  // break through the face
  MIN_MATERIAL_BEHIND_CUP: 3,
} as const;

// Nesting constraints
export const NESTING = {
  // Margin from sheet edges
  SHEET_MARGIN: 10,

  // Spacing between parts. The real gap is the saw's kerf, which the supplier
  // module owns; this is only the fallback for callers that do not set one.
  PART_SPACING: 4,
} as const;

export type RouterBitKey = keyof typeof ROUTER_BITS;
