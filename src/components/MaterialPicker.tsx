import type { Supplier, SheetMaterial } from '../lib/pricing/suppliers';

interface MaterialPickerProps {
  supplier: Supplier;
  material: SheetMaterial;
  onChange: (materialId: string) => void;
}

/**
 * Pick the sheet by looking at it.
 *
 * A dropdown of "16mm White Matt HPL on Poplar" tells you nothing you can see.
 * Colour is the decision most people are actually making, and it is the one
 * thing about the sheet that shows up in the 3D view, so it gets swatches.
 * Thickness follows, because that is a structural choice with a price on it
 * rather than a matter of taste.
 */
export function MaterialPicker({
  supplier,
  material,
  onChange,
}: MaterialPickerProps) {
  const finishes = distinctFinishes(supplier);
  const thicknesses = supplier.materials
    .filter((m) => sameFinish(m, material))
    .sort((a, b) => a.thickness - b.thickness);

  return (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[11px] text-graphite/45">Colour and finish</p>
        <div className="flex flex-wrap gap-1.5">
          {finishes.map((option) => {
            const selected = sameFinish(option, material);

            return (
              <button
                // Colour and finish alone are not unique - Plyman sell White
                // matt on both poplar and birch - so the core is part of the
                // identity here as well as in the grouping above
                key={optionKey(option)}
                type="button"
                onClick={() => onChange(closestThickness(option, supplier, material).id)}
                title={`${option.colourName}, ${option.finish}, ${option.core.toLowerCase()} core`}
                aria-pressed={selected}
                className={`flex items-center gap-1.5 rounded border px-1.5 py-1
                  text-[11px] focus:outline-none focus-visible:ring-1
                  focus-visible:ring-signal ${
                    selected
                      ? 'border-signal bg-signal/5 text-graphite'
                      : 'border-rule text-graphite/60 hover:border-graphite/30'
                  }`}
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-sm border border-graphite/20"
                  style={{
                    background: option.faceColor,
                    // A gloss chip catches a highlight, a matt one does not -
                    // the finish is visible on the swatch, not just named
                    boxShadow:
                      option.finish === 'gloss'
                        ? 'inset -2px -2px 3px rgba(0,0,0,0.10), inset 2px 2px 2px rgba(255,255,255,0.9)'
                        : 'none',
                  }}
                />
                {label(option, finishes)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] text-graphite/45">Thickness</p>
        <div className="flex flex-wrap gap-1.5">
          {thicknesses.map((option) => {
            const selected = option.id === material.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                aria-pressed={selected}
                className={`rounded border px-1.5 py-1 text-[11px] tabular-nums
                  focus:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                    selected
                      ? 'border-signal bg-signal/5 text-graphite'
                      : 'border-rule text-graphite/60 hover:border-graphite/30'
                  }`}
              >
                {option.thickness}mm
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One entry per colour-and-finish the supplier sells, whatever the thickness. */
function distinctFinishes(supplier: Supplier): SheetMaterial[] {
  const seen = new Set<string>();

  return supplier.materials.filter((m) => {
    const key = optionKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function optionKey(m: SheetMaterial): string {
  return `${m.colourName}|${m.finish}|${m.core}`;
}

/**
 * Swatches say the colour, and only mention the core when the same colour is
 * sold on two of them - which is where the price difference hides.
 */
function label(option: SheetMaterial, all: SheetMaterial[]): string {
  const sharesColour = all.some(
    (m) =>
      m !== option &&
      m.colourName === option.colourName &&
      m.finish === option.finish
  );

  return sharesColour
    ? `${option.colourName} ${option.core.toLowerCase()}`
    : option.colourName;
}

function sameFinish(a: SheetMaterial, b: SheetMaterial): boolean {
  return (
    a.colourName === b.colourName && a.finish === b.finish && a.core === b.core
  );
}

/**
 * Changing colour should not silently change thickness, since one is a
 * preference and the other is structural.
 */
function closestThickness(
  option: SheetMaterial,
  supplier: Supplier,
  current: SheetMaterial
): SheetMaterial {
  const candidates = supplier.materials.filter((m) => sameFinish(m, option));

  return candidates.reduce((best, m) =>
    Math.abs(m.thickness - current.thickness) <
    Math.abs(best.thickness - current.thickness)
      ? m
      : best
  );
}
