# Bug: Inefficient Nesting and Missing Drill Holes

## Bug Description
Two related visual bugs in the sheet nesting preview:

1. **Inefficient Nesting**: Parts that could fit on Sheet 1 are being placed on Sheet 2 instead. In the user's screenshot, there's significant unused space (~300mm wide) on the right side of Sheet 1 where a 568×390mm shelf could easily fit, but it goes to Sheet 2 instead (resulting in 57.7% overall waste across 2 sheets).

2. **Missing Red Drill Holes**: The Side Panels (uprights) should display red drill holes for the shelf pins (5mm diameter holes in the 32mm system), but no holes are visible in the SVG preview.

## Problem Statement
1. The guillotine nesting algorithm's "shorter axis split" heuristic creates fragmented free rectangles that prevent optimal part placement. When tall parts (2090×390mm side panels) are placed, the remaining space is split in a way that leaves unusable fragments instead of combining into larger usable areas.

2. The drill holes exist in the Part data structure for side panels but are not being rendered visibly in the preview - either because the holes array is empty at render time, or the holes are being rendered at incorrect positions/sizes that make them invisible.

## Solution Statement
1. **Nesting Fix**: Implement rectangle merging after splits to combine adjacent free rectangles. This will allow smaller parts to utilize the combined remaining space more effectively. The key issue is that after placing the tall side panels, the algorithm creates small fragments that can't individually hold a shelf, but combined they could.

2. **Drill Holes Fix**: Debug and fix the hole rendering in NestingPreview.tsx. The holes are defined in upright.ts with correct positions, but we need to verify they're being passed through the nesting process correctly and rendered at visible positions/sizes.

## Steps to Reproduce
1. Open the application at localhost:5173
2. Use default configuration (600mm wide × 2090mm tall × 400mm deep unit with 2 side panels, 1 fixed top, 1 fixed bottom, and adjustable shelves)
3. Observe Sheet 1 shows 5 parts with 22.9% waste and significant empty space on the right
4. Observe Sheet 2 exists with additional shelves that should fit on Sheet 1
5. Observe Side Panels (green/blue rectangles) have no visible red drill holes

## Root Cause Analysis

### Nesting Issue
The guillotine algorithm in `guillotine.ts` uses a "shorter axis split" rule (lines 79-121). When a part is placed:
- If remaining width ≤ remaining height: creates a "right" rectangle (full height) and a "top" rectangle (limited width)
- If remaining height < remaining width: creates a "top" rectangle (full width) and a "right" rectangle (limited height)

The problem: After placing the two tall side panels (2090×390mm each when rotated), the splits create multiple small rectangles. For example:
- First side panel uses ~400mm width, creates a "right" rectangle of ~2030mm and a narrow "top" rectangle
- Second side panel uses another ~400mm, further fragmenting space
- The remaining rectangles don't individually fit a 568×390mm shelf even though the combined unused space could

The algorithm needs rectangle merging to combine adjacent free rectangles.

### Drill Holes Issue
Looking at the code flow:
1. `upright.ts:generateShelfPinHoles()` creates holes with correct positions and 5mm diameter
2. `parts.ts:47-51` uses the left upright (which has holes) as the template for "Side Panel"
3. `expandParts()` spreads the part object, preserving the holes array
4. `NestingPreview.tsx:97-124` renders holes at calculated positions

The issue: In `NestingPreview.tsx`, the hole radius is `hole.diameter / 2` which equals 2.5mm. At the scale of a 2440×1220mm sheet rendered in a ~450px tall SVG, 2.5mm is approximately 0.85 pixels - effectively invisible. The holes need to be rendered at a minimum visible size or with a stroke that makes them visible.

## Relevant Files
Use these files to fix the bug:

### `src/lib/nesting/guillotine.ts`
- Contains the nesting algorithm with the `splitRectangle` function that creates fragmented space
- Needs rectangle merging logic to combine adjacent free rectangles after each placement

### `src/components/NestingPreview.tsx`
- Contains the SVG rendering logic for parts and drill holes (lines 97-124)
- Needs adjustment to render holes at a visible size regardless of zoom level

### New Files
None required.

## Step by Step Tasks

### 1. Add Rectangle Merging to Guillotine Algorithm
- Add a `mergeRectangles` function in `guillotine.ts` that combines adjacent free rectangles that share an edge
- Two rectangles can merge if they share a full edge (same x or y coordinate with matching width/height)
- Call `mergeRectangles` after `splitRectangle` in the `placePart` function
- This will combine fragmented space into larger usable areas

Implementation details:
- After adding new rectangles from a split, iterate through all free rectangles
- Find pairs that can merge (share a complete edge and have compatible dimensions)
- Replace the pair with a single merged rectangle
- Repeat until no more merges are possible

### 2. Fix Drill Hole Visibility in SVG Preview
- In `NestingPreview.tsx`, modify the hole rendering to use a minimum visible radius
- Calculate the minimum radius based on the viewBox scale (e.g., minimum 3mm radius for visibility)
- Use `Math.max(hole.diameter / 2, minVisibleRadius)` for the circle radius
- Ensure the stroke width is also proportionally visible

Implementation details:
- Add a constant for minimum hole display size (e.g., `MIN_HOLE_DISPLAY_RADIUS = 4`)
- In the `renderPart` callback, calculate a visible radius: `const visibleRadius = Math.max(hole.diameter / 2, MIN_HOLE_DISPLAY_RADIUS)`
- Use `visibleRadius` for the circle `r` attribute
- Adjust stroke width proportionally

### 3. Validate Fixes Work Correctly
- Run the development server and verify:
  - Shelves now fit on Sheet 1 where space is available
  - Total sheet count is reduced (should be 1 sheet instead of 2 for default config)
  - Overall waste percentage is reduced
  - Red drill holes are visible on Side Panel parts
- Visually confirm holes appear in the correct positions (two columns near front/back edges)

## Validation Commands
Execute every command to validate the bug is fixed with zero regressions.

- `npm run build` - Verify TypeScript compilation succeeds with no errors
- `npm run lint` - Verify no linting errors introduced
- `npm run dev` - Start dev server and manually verify:
  1. Default configuration now fits all parts on 1 sheet (previously 2)
  2. Overall waste is reduced (should be ~30-40% instead of 57.7%)
  3. Red drill holes are visible on Side Panel parts
  4. Holes appear in two vertical columns near the front and back edges of side panels

## Notes
- The rectangle merging algorithm should be O(n²) at worst for n free rectangles, but n is typically small (< 20) so performance is not a concern
- The minimum hole display radius (6mm) is a visual-only adjustment - the actual hole diameter in the DXF export remains at 5mm as specified
- **Important**: With default depth=400mm, shelves mathematically cannot fit on Sheet 1 after placing the side panels (remaining vertical space is 394mm, but shelves need 400mm). This is not a bug but a geometric constraint. With depth=390mm, 3 shelves fit on Sheet 1 above the side panels.
- The drill hole rendering bug was in the coordinate transformation for rotated parts - the code incorrectly used `width` (the rotated width, i.e., original height) instead of `height` (the rotated height, i.e., original width) when calculating the Y position
