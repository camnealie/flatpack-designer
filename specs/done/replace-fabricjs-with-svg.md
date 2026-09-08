# Chore: Replace Fabric.js with SVG in NestingPreview

## Chore Description
Replace the Fabric.js canvas implementation in NestingPreview.tsx with native SVG. The current Fabric.js implementation has fundamental issues with coordinate systems, scale calculations, and viewport management that make it impossible to reliably display the full plywood sheet with all four corners visible.

SVG is the right tool for this job because:
1. **`viewBox` solves the fit-to-container problem automatically** - Declare the coordinate system (e.g., `viewBox="0 0 2440 1220"`) and the browser handles scaling
2. **Coordinates are straightforward** - x=100 means 100 units from the left, no transforms or offsets needed
3. **No library overhead** - Just JSX, no complex library state management
4. **Built for this use case** - SVG literally stands for Scalable Vector Graphics
5. **Pan/zoom is simple** - CSS transforms on the SVG element or adjust viewBox

## Relevant Files
Use these files to resolve the chore:

- `src/components/NestingPreview.tsx` - The main component to be rewritten. Currently uses Fabric.js with complex scale calculations, multiple useEffects, and ref management that causes coordinate mismatches.
- `src/lib/nesting/types.ts` - Defines `NestingResult`, `NestedSheetResult` interfaces used by the component.
- `src/lib/geometry/types.ts` - Defines `PlacedPart`, `Part`, `Hole` interfaces for rendering parts.
- `package.json` - Fabric.js dependency can be removed after migration.

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Create the SVG-based NestingPreview component
- Remove all Fabric.js imports (`Canvas`, `Rect`, `Circle`, `Text` from 'fabric')
- Remove canvas refs (`canvasRef`, `fabricRef`)
- Keep `containerRef` for measuring container width
- Keep state for `currentSheetIndex`, `zoom`, `panOffset`
- Remove `isPanningRef`, `lastPanPosition`, `panOffsetRef` - will handle panning differently

### Step 2: Implement the SVG viewBox approach
- Use `viewBox="0 0 {sheetWidth} {sheetHeight}"` to define coordinate system matching sheet dimensions
- Set `preserveAspectRatio="xMidYMid meet"` to center and fit the sheet
- The SVG element will automatically scale to fit its container while maintaining aspect ratio
- Add padding around the sheet by expanding the viewBox slightly (e.g., add 50mm margin on each side)

### Step 3: Render the sheet as an SVG rect
- Draw the plywood sheet as `<rect x="0" y="0" width={sheetWidth} height={sheetHeight} fill="white" stroke="#d1d5db" strokeWidth="4" />`
- Coordinates are now in millimeters matching the actual sheet dimensions
- No scale calculations needed - SVG handles the scaling

### Step 4: Render parts as SVG rects
- For each placement, draw a `<rect>` with the part's position and dimensions
- Handle rotation: `width = rotated ? part.height : part.width`
- Handle Y-axis flip: SVG origin is top-left, nesting uses bottom-left, so `y = sheetHeight - placement.y - height`
- Add fill color from PART_COLORS palette
- Add stroke for part outline

### Step 5: Render part labels as SVG text
- Use `<text>` elements for part names and dimensions
- Position at center of each part
- Use `textAnchor="middle"` and `dominantBaseline="middle"` for centering
- Scale font size based on part dimensions

### Step 6: Render sheet dimensions label
- Add `<text>` element showing "{sheetWidth} × {sheetHeight}mm" at bottom center of sheet

### Step 7: Implement zoom functionality
- Zoom works by adjusting the viewBox dimensions
- At zoom=1, viewBox shows full sheet plus margins
- At zoom=2, viewBox shows half the area (zoomed in)
- Calculate viewBox based on zoom level: `viewBoxWidth = (sheetWidth + margin*2) / zoom`

### Step 8: Implement pan functionality
- Pan works by adjusting viewBox origin (minX, minY)
- Add mouse event handlers to the SVG element for drag-to-pan
- Track mouse position delta during drag
- Update panOffset state which shifts the viewBox origin
- Use `cursor: grab` / `cursor: grabbing` styles

### Step 9: Keep existing UI unchanged
- Keep the zoom controls (+, -, Reset View buttons)
- Keep sheet navigation (Previous, Next buttons)
- Keep summary section (Total Sheets, Overall Waste)
- Keep unplaced parts warning

### Step 10: Remove Fabric.js dependency
- Remove `fabric` from package.json dependencies
- Run `npm install` to update lockfile
- Verify no other files import from 'fabric'

### Step 11: Run Validation Commands
- Execute all validation commands to ensure zero regressions

## Validation Commands
Execute every command to validate the chore is complete with zero regressions.

- `npm run lint` - Run linter to ensure code quality
- `npm run build` - Build the project to verify TypeScript compiles correctly
- `npm run dev` - Start dev server and manually verify:
  - The entire plywood sheet is visible at 100% zoom (all 4 corners visible)
  - Parts render correctly inside the sheet boundaries
  - Zoom in/out works correctly
  - Pan/drag works correctly
  - Sheet navigation works correctly
  - Reset View returns to default state

## Notes
- The nesting algorithm uses a coordinate system where (0,0) is at the bottom-left of the sheet. SVG uses top-left origin. The Y-coordinate transformation is: `svgY = sheetHeight - nestingY - partHeight`
- Sheet dimensions are in millimeters (e.g., 2440 × 1220mm for standard plywood). The viewBox uses these same units.
- The viewBox approach means we never need to calculate pixel scales - SVG handles all the scaling automatically.
- Parts can be rotated 90°. When `rotated=true`, swap width and height for display purposes.
- The PART_COLORS array should be preserved for consistent part coloring.
- Holes rendering is currently disabled (TODO comment in existing code) - keep it disabled in the SVG version for now.
