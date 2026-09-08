# CNC Modular Shelving Configurator — Technical Brief

## Overview

Build a web-based tool that lets users configure adjustable shelving units and outputs CNC-ready DXF files with optimised nesting on standard sheet sizes.

## Target Use Case

User is building a shelving unit around a murphy bed:

- **Unit dimensions**: 600mm wide × 2090mm tall × 400mm deep
- **Material**: 18mm melamine-faced plywood (2400 × 1200mm sheets)
- **Assembly**: Shelf pin system (adjustable shelves resting on metal pins)

---

## Technical Specifications

### Standard Sheet Sizes (NZ)

| Size               | Common Use         |
| ------------------ | ------------------ |
| 2400 × 1200 × 16mm | Budget option      |
| 2400 × 1200 × 18mm | Standard cabinetry |
| 2440 × 1220 × 18mm | Some suppliers     |

Default to **2400 × 1200 × 18mm** but make configurable.

### 32mm System (European Cabinet Standard)

The industry standard for adjustable shelving:

- **Hole diameter**: 5mm
- **Hole spacing**: 32mm centre-to-centre (vertical)
- **Setback from front edge**: 37mm
- **Setback from rear edge**: 37mm (or match front)
- **First hole from bottom**: 37mm (or 37mm + n×32mm)
- **Hole depth**: 10-12mm (not through-hole for 18mm material)

This system is compatible with standard shelf pins, Blum hardware, IKEA fittings, etc.

### CNC Tolerances & Constraints

#### Edge Margins

- **Minimum distance from sheet edge**: 10mm (accounts for warping, clamping)
- **Part spacing (kerf + safety)**: 5-6mm between parts (assumes 6mm bit + 2mm safety)

#### Corner Radius

- CNC routers cannot cut sharp internal corners
- **Minimum internal corner radius** = half the bit diameter
- Common bit sizes: 6mm (3mm radius), 8mm (4mm radius)
- **Default assumption**: 6mm bit → 3mm internal corner radius
- For slots/dados where square parts must fit: use **dogbone** or **T-bone** relief cuts

#### Dogbone Specifications

- Dogbone diameter should be **10-20% larger than bit diameter**
- Example: 6mm bit → 7mm dogbone diameter
- Position: centred on corner, extending into waste area

#### Material Thickness Tolerance

- Nominal 18mm plywood can vary ±0.5mm
- Design joints with **0.2-0.3mm clearance** for assembly fit
- Shelf pin holes: exactly 5mm (no tolerance needed, pins are standard)

---

## Component Design

### Parts List (per unit)

1. **Left upright** — 400mm × 2090mm × 18mm (with shelf pin holes)
2. **Right upright** — 400mm × 2090mm × 18mm (with shelf pin holes, mirrored)
3. **Top fixed shelf** — (unit width - 2×material thickness) × 400mm × 18mm
4. **Bottom fixed shelf** — same as top
5. **Adjustable shelves** — same dimensions, quantity user-configurable
6. **Optional back panel** — 3-6mm ply or MDF in routed groove

### Upright Design

```
┌─────────────────────────────────┐
│ ○                           ○   │  ← 37mm from edges
│                                 │
│ ○                           ○   │  ← 32mm spacing
│                                 │
│ ○                           ○   │
│         ... repeating ...       │
│ ○                           ○   │
│                                 │
└─────────────────────────────────┘
  ↑                           ↑
  37mm from front         37mm from back
```

### Shelf Pin Hole Pattern

- Two columns per upright (front and back)
- Holes start 37mm from bottom, repeat every 32mm
- Stop 37mm from top (or calculate to end cleanly)
- For 2090mm upright: approximately 63 holes per column × 2 columns = ~126 holes per upright

### Assembly Method

- Fixed top/bottom shelves: cam locks, dowels, or pocket screws (user's choice at assembly)
- Adjustable shelves: rest on 5mm shelf pins inserted into holes
- No complex CNC joinery required — keep it simple

---

## DXF Output Requirements

### File Structure

- One DXF per sheet (nested layout)
- Separate layers for:
  - `CUT` — through-cut profiles (outer perimeter)
  - `DRILL_5MM` — shelf pin holes (5mm diameter, 10mm deep)
  - `POCKET` — any routed grooves (e.g., for back panel)
  - `LABEL` — part labels/text (optional, for reference)

### Nesting Algorithm

- Arrange parts to minimise waste
- Respect edge margins (10mm from sheet edge)
- Respect part spacing (6mm between parts)
- Grain direction: assume all parts oriented same way (long dimension = grain)
- Output: list of sheets required, percentage waste

### Coordinate System

- Origin (0,0) at bottom-left of sheet
- Units: millimetres
- Positive X = right, Positive Y = up

---

## UI Requirements

### Configurator Inputs

1. **Unit dimensions**
   - Width (mm) — default 600
   - Height (mm) — default 2090
   - Depth (mm) — default 400

2. **Material settings**
   - Sheet size (dropdown: 2400×1200, 2440×1220, custom)
   - Thickness (dropdown: 16mm, 18mm, custom)
   - Bit diameter (dropdown: 6mm, 8mm) — affects corner radius

3. **Shelf configuration**
   - Number of adjustable shelves — default 4
   - Include fixed top shelf (checkbox) — default true
   - Include fixed bottom shelf (checkbox) — default true

4. **Options**
   - Back panel groove (checkbox) — default false
   - Shelf pin hole spacing override (default 32mm)

### Configurator Outputs

1. **Visual preview**
   - 2D view of each part with dimensions
   - Sheet nesting preview showing all parts on sheets
   - Waste percentage indicator

2. **Parts list**
   - Table: Part name, quantity, dimensions
   - Total sheet count required

3. **Export**
   - Download DXF (zipped if multiple sheets)
   - Download cut list (CSV or PDF)

---

## Tech Stack Suggestions

- **Frontend**: React + TypeScript
- **2D Geometry**: paper.js or custom SVG generation
- **DXF Export**: js-dxf library or custom writer (DXF is a text format)
- **Nesting**: Simple bin-packing algorithm (guillotine cuts)

---

## Example Calculation

**Input:**

- Unit: 600W × 2090H × 400D
- Material: 18mm, sheet 2400 × 1200
- Shelves: 2 fixed + 4 adjustable = 6 total

**Parts:**

- 2× uprights: 400 × 2090mm
- 6× shelves: 564 × 400mm (600 - 2×18 = 564)

**Nesting:**

- Sheet 1: 2× uprights (400mm wide each = 800mm, fits side by side with 6mm gap + margins)
  - Remaining space: ~380mm × 2090mm (could fit shelves rotated?)
- Sheet 2: 6× shelves (564 × 400mm each)
  - Can fit 2 across (564 × 2 + 6mm = 1134mm < 1200mm ✓)
  - Can fit 5 down (400 × 5 + 4×6mm = 2024mm < 2400mm ✓)
  - One sheet handles all 6 shelves with room to spare

**Result:** 2 sheets, minimal waste

---

## Out of Scope (v1)

- Complex joinery (finger joints, dados)
- 3D preview
- Multiple unit configurations
- Cost estimation
- Direct integration with CNC shops

---

## Notes for Implementation

1. Start with hardcoded defaults, make configurable later
2. Shelf pin holes are the tricky bit — get the 32mm system math right first
3. DXF format is simple text — can generate without heavy libraries
4. Test output with a free DXF viewer (e.g., LibreCAD, QCAD) before cutting
5. Consider adding "dogbone" option for slots if user wants dado joints later
