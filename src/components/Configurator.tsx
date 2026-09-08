import { Section } from './ui/Section';
import { Toggle, Field, selectClass } from './ui/controls';
import { SUPPLIERS } from '../lib/pricing/suppliers';
import { MaterialPicker } from './MaterialPicker';
import type { Supplier, SheetMaterial } from '../lib/pricing/suppliers';
import { ROUTER_BITS } from '../lib/constants';
import type { RouterBitKey } from '../lib/constants';
import type { Project } from '../lib/project/types';
import type { ProjectActions } from '../hooks/useProject';

interface ConfiguratorProps {
  project: Project;
  supplier: Supplier;
  material: SheetMaterial;
  actions: ProjectActions;
}

/**
 * The settings that belong to the job rather than to any one item: who is
 * cutting it, what out of, and how it is packed onto the sheets.
 */
export function Configurator({
  project,
  supplier,
  material,
  actions,
}: ConfiguratorProps) {
  return (
    <>
      <Section
        title="Supplier"
        summary={`${supplier.name.split(' ')[0]}, ${material.thickness}mm`}
      >
        <Field label="Cut by">
          <select
            value={project.supplierId}
            onChange={(e) => actions.setSupplier(e.target.value)}
            className={selectClass}
          >
            {SUPPLIERS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-2">
          <MaterialPicker
            supplier={supplier}
            material={material}
            onChange={actions.setMaterial}
          />
        </div>

        {/* What they do is the thing that actually changes between the two, so
            it is stated before the price rather than left to be inferred. */}
        <p className="mt-1.5 text-[11px] leading-snug text-graphite/45">
          {supplier.cnc ? (
            <>
              <span className="text-graphite/70">Full CNC.</span> They machine
              the DXF, so the holes come back bored.
              {supplier.cutter && (
                <>
                  {' '}
                  A {supplier.cutter.diameter}mm cutter, so every inside corner
                  comes back rounded to {supplier.cutter.minInternalRadius}mm -
                  a router cannot make a square internal corner.
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-graphite/70">Panel saw only.</span> They cut
              rectangles to size; the holes are yours to drill.
            </>
          )}{' '}
          {material.sheetWidth} × {material.sheetHeight}mm, {material.core} core,{' '}
          {material.finish}. {material.note}{' '}
          {!material.inStock && (
            <span className="text-amber-700">
              Listed out of stock when last checked &mdash; worth ringing before
              you plan around it.
            </span>
          )}
        </p>
      </Section>

      <Section title="Nesting" summary={project.packTight ? 'Packed tight' : 'Spread'}>
        {/* Only worth asking when the supplier's own tooling is not known;
            PPR's cutter decides this whatever is picked here. */}
        {!supplier.cutter && (
          <Field label="Router bit">
            <select
              value={project.routerBit}
              onChange={(e) => actions.setRouterBit(e.target.value as RouterBitKey)}
              className={selectClass}
            >
              {Object.entries(ROUTER_BITS).map(([key, size]) => (
                <option key={key} value={key}>
                  {size}mm
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="mt-2">
          <Toggle
            label="Pack tight"
            checked={project.packTight}
            onChange={actions.setPackTight}
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-graphite/45">
          Squeezes every part to the left so the drop comes off as one full-height
          panel instead of scattered strips. Same total waste either way, only its
          shape changes. Parts are spaced {supplier.kerf}mm apart, the width the{' '}
          {supplier.cnc ? 'cutter' : 'blade'} takes out.
        </p>

      </Section>
    </>
  );
}
