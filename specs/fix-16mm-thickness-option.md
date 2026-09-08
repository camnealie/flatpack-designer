# Bug: Missing 16mm thickness option

## Bug Description
The user requested 16mm as the default material thickness, but the application shows 12mm as the default and does not offer 16mm as an option in the thickness dropdown. When selecting the default material (Birch Plywood), the available thicknesses are 12, 15, 18, and 24mm - with 16mm conspicuously absent.

Expected behavior: The thickness dropdown should include 16mm as an option (as specified in the brief), and the default should be 16mm.

Actual behavior: The dropdown shows 12, 15, 18, 24mm options for Birch Plywood, with 12mm appearing as the selected value because 16mm is not a valid option.

## Problem Statement
The `SHEET_MATERIALS` constant in `src/lib/constants.ts` defines the available thicknesses for each material type, but none of the plywood materials include 16mm in their thickness arrays. The `DEFAULTS.materialThickness` is correctly set to 16, but since 16mm is not in the `thicknesses` array for the default material ('plywood-birch'), the dropdown cannot display 16mm as a valid selection.

## Solution Statement
Add 16mm to the `thicknesses` arrays for both plywood material types ('plywood-birch' and 'plywood-hardwood') in `src/lib/constants.ts`. This aligns with the project brief which explicitly lists 16mm as a "Budget option" in the standard sheet sizes table.

## Steps to Reproduce
1. Run the application with `npm run dev`
2. Look at the "Material" section in the Configurator
3. Observe the "Thickness" dropdown shows 12mm selected (not 16mm)
4. Click the dropdown to see available options: 12mm, 15mm, 18mm, 24mm
5. Note that 16mm is not an available option

## Root Cause Analysis
In `src/lib/constants.ts`:
- Line 73: `materialThickness: 16` - The default is correctly set to 16mm
- Line 74: `sheetMaterial: 'plywood-birch'` - The default material is Birch Plywood
- Line 28: `thicknesses: [12, 15, 18, 24]` - Birch Plywood thicknesses do NOT include 16mm

When the app loads:
1. `useConfigurator` initializes state with `materialThickness: 16` and `sheetMaterial: 'plywood-birch'`
2. `Configurator` builds dropdown options from `SHEET_MATERIALS['plywood-birch'].thicknesses` → [12, 15, 18, 24]
3. The dropdown tries to display value "16" but it's not in the options
4. The browser's `<select>` element falls back to showing the first option (12mm)

The project brief at lines 21-27 explicitly shows 16mm as a standard sheet size:
```
| 2400 × 1200 × 16mm | Budget option      |
```

And line 152 specifies the thickness dropdown should include: `Thickness (dropdown: 16mm, 18mm, custom)`

## Relevant Files
Use these files to fix the bug:

- `src/lib/constants.ts` - Contains `SHEET_MATERIALS` with the `thicknesses` arrays that need to include 16mm. This is the only file that needs modification.

## Step by Step Tasks

### 1. Add 16mm to plywood thickness options

- Edit `src/lib/constants.ts`
- Add 16 to the `thicknesses` array for 'plywood-birch' (line 28)
- Add 16 to the `thicknesses` array for 'plywood-hardwood' (line 34)
- Keep the arrays sorted in ascending order: `[12, 15, 16, 18, 24]`

### 2. Verify the fix visually

- Run `npm run dev` to start the development server
- Open the application in a browser
- Verify the Thickness dropdown now shows 16mm as the selected default
- Click the dropdown and verify 16mm appears in the options list
- Select different materials and verify thickness options update appropriately

### 3. Run Validation Commands

- Execute all validation commands listed below to confirm the fix works with zero regressions

## Validation Commands
Execute every command to validate the bug is fixed with zero regressions.

- `npm run build` - Ensure the application builds without TypeScript or compilation errors
- `npm run dev &` - Start the dev server and manually verify 16mm appears in the dropdown and is selected by default

## Notes
- The fix only requires changing two lines in `src/lib/constants.ts`
- MDF already has different thicknesses (12, 15, 18, 25) and should not be modified
- Particleboard already includes 16mm in its thicknesses array (16, 18, 25)
- After the fix, switching from Birch Plywood to Particleboard and back should maintain 16mm as the selected value
