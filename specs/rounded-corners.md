# Feature: Rounded Corners for Parts

## Feature Description
Add rounded corners to the part rectangles displayed in the NestingPreview component. This enhances the visual representation of CNC-cut parts by accurately depicting the corner radius that results from router bit cutting. When a CNC router cuts parts from sheet material, the inside corners are naturally rounded due to the circular nature of the router bit, so displaying parts with rounded corners provides a more accurate visual representation of the final cut pieces.

## User Story
As a CNC shelving designer
I want to see parts rendered with rounded corners in the preview
So that I have an accurate visual representation of how parts will look after being cut by a router

## Problem Statement
Currently, parts in the NestingPreview are displayed as sharp-cornered rectangles. This doesn't reflect the reality of CNC routing where the router bit creates natural rounded corners with a radius equal to half the bit diameter. Users cannot visualize the actual appearance of their parts after cutting.

## Solution Statement
Add the `rx` and `ry` attributes to the SVG `<rect>` elements that render parts in NestingPreview. The corner radius should be derived from the router bit size configuration (half the bit diameter), which is already available in the application. This will require passing the router bit configuration to the NestingPreview component and applying the corner radius to each part rectangle.

## Relevant Files
Use these files to implement the feature:

- `src/components/NestingPreview.tsx` - The main component where parts are rendered as SVG rectangles. The `renderPart` function at line 55 creates the `<rect>` elements that need rounded corners. Currently uses `<rect>` without `rx`/`ry` attributes.
- `src/lib/constants.ts` - Contains the `ROUTER_BITS` configuration with bit sizes (3mm, 6mm, 8mm, 10mm, 12mm). The corner radius should be half the router bit diameter.
- `src/App.tsx` - The parent component that renders NestingPreview. Will need to pass the corner radius or router bit size as a prop.
- `src/hooks/useConfigurator.ts` - Contains the configuration state including `routerBit`. The output from this hook includes the selected router bit key.

## Implementation Plan
### Phase 1: Foundation
- Determine the corner radius value: The corner radius should equal the router bit radius (half the diameter)
- Update the NestingPreview component interface to accept a `cornerRadius` prop
- This keeps NestingPreview flexible and decoupled from the router bit configuration details

### Phase 2: Core Implementation
- Modify the `<rect>` elements in the `renderPart` function to include `rx` and `ry` attributes
- Apply the corner radius to the part rectangles only (not the sheet background rectangle, as the sheet material itself has sharp corners)
- Ensure the corner radius doesn't exceed the minimum of half-width or half-height (SVG constraint)

### Phase 3: Integration
- Update App.tsx to calculate the corner radius from the router bit configuration
- Pass the corner radius to NestingPreview component
- Verify the visual display updates correctly when the router bit selection changes

## Step by Step Tasks
IMPORTANT: Execute every step in order, top to bottom.

### Step 1: Update NestingPreview Props Interface
- Add `cornerRadius: number` as an optional prop to `NestingPreviewProps` interface
- Default to `0` if not provided (backwards compatible)

### Step 2: Apply Corner Radius to Part Rectangles
- In the `renderPart` function, add `rx` and `ry` attributes to the part `<rect>` element
- Calculate safe radius as `Math.min(cornerRadius, width / 2, height / 2)` to prevent radius exceeding part dimensions
- Apply the safe radius to both `rx` and `ry` attributes

### Step 3: Update App.tsx to Pass Corner Radius
- Import `ROUTER_BITS` from constants
- Calculate corner radius: `ROUTER_BITS[output.config.routerBit] / 2`
- Pass `cornerRadius` prop to NestingPreview component

### Step 4: Validate the Implementation
- Run lint and build commands
- Manually test the application to verify:
  - Parts display with rounded corners
  - Changing router bit size updates corner radius correctly
  - Sheet background remains sharp-cornered
  - Zooming and panning work correctly with rounded corners

## Testing Strategy
### Unit Tests
- No unit tests currently exist for NestingPreview; visual verification is the primary testing method

### Integration Tests
- Manual testing: Verify parts render with rounded corners
- Manual testing: Change router bit size and verify corner radius updates

### Edge Cases
- Very small parts where corner radius might exceed half the minimum dimension
- Parts with dimensions smaller than double the router bit radius
- Maximum zoom level to ensure rounded corners render crisply

## Acceptance Criteria
- Parts in NestingPreview display with rounded corners matching the router bit radius
- Corner radius equals half the selected router bit diameter (e.g., 6mm bit = 3mm corner radius)
- Sheet background rectangle remains sharp-cornered (no rounded corners on the plywood sheet itself)
- Changing the router bit selection in the Configurator updates the corner radius in the preview
- No visual glitches or rendering issues with the rounded corners
- Application builds and lints without errors

## Validation Commands
Execute every command to validate the feature works correctly with zero regressions.

- `npm run lint` - Run linter to ensure code quality
- `npm run build` - Build the project to verify TypeScript compiles correctly
- `npm run dev` - Start dev server and manually verify:
  - Parts display with rounded corners
  - Sheet background has sharp corners (not rounded)
  - Changing router bit size updates corner radius
  - Different bit sizes (3mm, 6mm, 8mm, 10mm, 12mm) show proportional corner radii
  - Zoom in to verify corner radius renders correctly at close view
  - Pan/drag works correctly with rounded corners
  - All parts are visible and properly colored

## Notes
- The corner radius is purely a visual enhancement in the preview. The actual DXF export may need separate consideration for toolpath generation (outside the scope of this feature).
- SVG `rx` and `ry` attributes create uniformly rounded corners. For more complex corner treatments in the future, SVG `<path>` elements could be used instead.
- The sheet background rectangle should remain sharp-cornered because the physical plywood sheet has sharp corners - only the cut parts have rounded corners due to the router bit.
