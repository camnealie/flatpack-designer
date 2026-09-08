# Feature: Sheet Preview Pan and Drag

## Feature Description
Add the ability to pan/drag the sheet preview canvas to navigate around the full sheet when it extends beyond the visible viewport. This allows users to inspect all parts on a sheet, especially when zoomed in or when dealing with large sheet layouts that don't fit entirely within the preview container.

## User Story
As a user configuring a shelving unit
I want to drag the sheet preview to pan around
So that I can see and inspect all parts on the sheet, including those rendered outside the visible viewport

## Problem Statement
The current sheet preview shows parts nested on a sheet using Fabric.js canvas. When the sheet is large or when zoomed in, parts of the sheet render outside the visible viewport area. Users currently have no way to navigate around the sheet except for browser scrolling on the container, which is not intuitive for a canvas-based preview. The preview needs proper pan/drag functionality to allow users to explore the entire sheet layout.

## Solution Statement
Implement canvas panning using Fabric.js's built-in viewport transformation capabilities. The solution will:
1. Enable drag-to-pan interaction where users can click and drag the canvas background to pan around
2. Show a visual indicator (cursor change) when panning is available
3. Optionally support mouse wheel panning (with Shift key) in addition to the existing zoom functionality
4. Add a "Reset View" button to return to the default centered view
5. Display current pan offset for user awareness

## Relevant Files
Use these files to implement the feature:

- `src/components/NestingPreview.tsx` - The main component that renders the sheet preview using Fabric.js canvas. This is where all panning functionality will be implemented.
- `src/components/ui/Button.tsx` - Reusable button component for UI controls (already exists, will be reused for reset view button).

### New Files
No new files need to be created. All changes will be made within the existing `NestingPreview.tsx` component.

## Implementation Plan

### Phase 1: Foundation
Configure the Fabric.js canvas to support panning:
- Enable `selection` on canvas but configure it for panning rather than object selection
- Keep individual objects non-selectable (parts should not be movable)
- Set up viewport transformation state to track pan offset
- Configure canvas for infinite panning within reasonable bounds

### Phase 2: Core Implementation
Implement the drag-to-pan interaction:
- Add mouse event handlers for pan initiation (mousedown on canvas background)
- Track pan delta during mouse move
- Apply viewport transformation using Fabric.js `viewportTransform` or `relativePan()`
- Update cursor to indicate pan mode (grab/grabbing cursors)
- Add pan state tracking (isPanning, lastPanPosition)
- Constrain panning to prevent the sheet from being panned completely out of view

### Phase 3: Integration
Integrate with existing zoom functionality and add UX improvements:
- Ensure pan offset is preserved when changing zoom level
- Reset pan position when changing sheets
- Add "Reset View" button to center the sheet
- Update zoom controls to work with viewport transformation
- Add visual feedback for current pan state

## Step by Step Tasks

### Step 1: Update Canvas Initialization for Viewport Panning
- Modify the canvas initialization in `useEffect` to enable viewport transformations
- Remove hardcoded canvas dimensions and allow the canvas to render the full sheet at the current zoom level
- Set up initial viewport transform to center the sheet

### Step 2: Add Pan State Management
- Add state variables for tracking: `isPanning`, `lastPanPosition`
- Add a ref to store the current viewport transform
- Ensure pan state resets when `currentSheetIndex` changes

### Step 3: Implement Mouse Event Handlers for Panning
- Add `onMouseDown` handler to initiate panning (check if clicking on canvas background)
- Add `onMouseMove` handler to update pan position during drag
- Add `onMouseUp` handler to end panning
- Use Fabric.js `relativePan()` method to apply pan transformations

### Step 4: Add Cursor Feedback
- Set cursor to `grab` when hovering over canvas background
- Set cursor to `grabbing` while actively panning
- Implement cursor changes using Fabric.js `defaultCursor` and `moveCursor` properties or direct style manipulation

### Step 5: Add Reset View Button
- Add a "Reset View" button next to existing zoom controls
- Implement reset function that centers the sheet and optionally resets zoom to 100%
- Style consistently with existing zoom controls

### Step 6: Constrain Panning Bounds
- Calculate maximum pan boundaries based on sheet dimensions and canvas size
- Prevent panning the sheet completely out of view
- Leave some margin so users can always see at least part of the sheet

### Step 7: Integrate with Zoom Functionality
- Ensure pan position is maintained when zooming
- Zoom should zoom toward the center of the viewport (or mouse position if implementing zoom-to-cursor)
- Update the existing zoom handlers to work with viewport transform

### Step 8: Add Optional Shift+Scroll Panning
- Add wheel event handler that pans horizontally when Shift is held
- Vertical scroll without Shift continues to work as browser default (or zoom if that's the current behavior)

### Step 9: Manual Testing and Validation
- Test panning at various zoom levels
- Test sheet navigation (ensure pan resets when changing sheets)
- Test reset view functionality
- Test pan constraints
- Run lint and type checks

## Testing Strategy

### Unit Tests
- No unit tests required for this UI interaction feature. Fabric.js handles the low-level canvas operations, and the implementation uses its built-in APIs.

### Integration Tests
- Manual verification that pan + zoom work together correctly
- Manual verification that sheet navigation resets the view appropriately

### Edge Cases
- Panning when sheet is smaller than viewport (should have limited or no pan)
- Panning at maximum zoom level
- Panning at minimum zoom level
- Rapid clicking/dragging
- Panning after window resize
- Touch device support (future consideration - Fabric.js has touch support)

## Acceptance Criteria
- Users can click and drag on the canvas background to pan the sheet preview
- Cursor changes to `grab` when hovering over pannable area and `grabbing` while panning
- A "Reset View" button is available that centers the sheet and resets pan position
- Pan position is maintained when zooming
- Pan position resets when navigating to a different sheet
- Sheet cannot be panned completely out of view (at least a portion remains visible)
- Existing zoom functionality continues to work correctly
- No visual glitches or performance issues during panning

## Validation Commands
Execute every command to validate the feature works correctly with zero regressions.

- `npm run lint` - Run linter to ensure code quality
- `npm run build` - Build the project to verify no TypeScript errors
- `npm run dev` - Start development server for manual testing

## Notes
- Fabric.js 7.x has good support for viewport transformations via `canvas.viewportTransform` and methods like `relativePan()`, `zoomToPoint()`, etc.
- The current implementation sets `selection: false` on the canvas - this will need to be changed to allow mouse interaction, but individual objects will remain non-selectable
- Consider future enhancement: minimap overlay showing current viewport position on the full sheet
- Consider future enhancement: zoom-to-fit button that calculates optimal zoom to show all parts
- Touch/mobile support could be added later using Fabric.js touch events
