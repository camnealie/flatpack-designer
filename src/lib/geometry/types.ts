// Core geometry types for CNC shelving parts

export interface Point {
  x: number;
  y: number;
}

// Boring operations are split by tool: 5mm for shelf pins and hinge plate
// screws, 35mm for the Forstner-bored hinge cups. The layer is what tells the
// CNC which tool to change to, so it is not cosmetic.
export type DrillLayer = 'DRILL_5MM' | 'DRILL_35MM';

export interface Hole {
  x: number;
  y: number;
  diameter: number;
  depth: number;
  layer: DrillLayer;
}

export interface Groove {
  path: Point[];
  width: number;
  depth: number;
  layer: 'POCKET';
}

export interface Part {
  id: string;
  name: string;
  /**
   * Which item in the job this part belongs to. Selecting an item highlights
   * its parts wherever they ended up on the sheets, which is how you tell at a
   * glance what the thing you are editing actually costs in ply.
   */
  itemId?: string;
  width: number;      // mm (X dimension when laid flat)
  height: number;     // mm (Y dimension when laid flat)
  thickness: number;  // mm (Z dimension / material thickness)
  holes: Hole[];      // drill positions
  grooves: Groove[];  // pocket/groove paths
}

export interface Sheet {
  width: number;      // mm
  height: number;     // mm
  thickness: number;  // mm
}

// Which vertical edge of a door the hinges live on, looking at the front.
export type HingeSide = 'left' | 'right';

// A single concealed hinge on the assembled piece: where its cup sits on the
// door and which panel its mounting plate screws to.
export interface HingePlacement {
  doorIndex: number;
  side: HingeSide;
  y: number;               // Height above the door's bottom edge (mm)
}

// A part placed on a sheet for nesting
export interface PlacedPart {
  part: Part;
  x: number;          // Position on sheet (mm from left)
  y: number;          // Position on sheet (mm from bottom)
  rotated: boolean;   // Whether part is rotated 90 degrees
}

export interface NestedSheet {
  sheet: Sheet;
  parts: PlacedPart[];
  wastePercentage: number;
}

// Unique part definition (before quantity multiplication)
export interface PartDefinition {
  part: Part;
  quantity: number;
}
