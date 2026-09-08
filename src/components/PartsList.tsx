import type { PartDefinition } from '../lib/geometry/types';
import type { Project } from '../lib/project/types';
import type { HardwareItem } from '../lib/project/summary';
import type {
  Supplier,
  SheetMaterial,
  PriceEstimate,
} from '../lib/pricing/suppliers';
import type { CutEstimate } from '../lib/pricing/cuts';
import { money } from '../lib/pricing/suppliers';
import type { ItemAdvice } from '../lib/project/advice';
import type { Fastener } from '../lib/engineering/fasteners';

interface PartsListProps {
  project: Project;
  partDefinitions: PartDefinition[];
  hardware: HardwareItem[];
  advice: ItemAdvice[];
  manual: string[];
  supplier: Supplier;
  material: SheetMaterial;
  price: PriceEstimate;
  cuts: CutEstimate;
  sheets: number;
  onSelectItem: (id: string) => void;
  onDownloadCutList: () => void;
  includeFreight: boolean;
  onIncludeFreight: (value: boolean) => void;
}

/**
 * What comes out of the job: the parts, the hardware, the work the supplier
 * will not do, and what it costs.
 *
 * Parts are grouped under the item they belong to rather than run together, so
 * the rail answers "what does this cabinet cost me in ply" as readily as "what
 * do I need to order".
 */
export function PartsList({
  project,
  partDefinitions,
  hardware,
  advice,
  manual,
  supplier,
  material,
  price,
  cuts,
  sheets,
  onSelectItem,
  onDownloadCutList,
  includeFreight,
  onIncludeFreight,
}: PartsListProps) {
  const total = partDefinitions.reduce((sum, def) => sum + def.quantity, 0);
  const fixings = collectFixings(advice);
  const drills = [...new Set(advice.flatMap((a) => a.joints?.drills ?? []))];

  return (
    <div className="pb-4">
      <RailHeading
        title="Cut list"
        aside={`${total} parts`}
        action={{ label: 'CSV', onClick: onDownloadCutList }}
      />

      {project.items.map((item) => {
        const parts = partDefinitions.filter((d) => d.part.itemId === item.id);
        if (parts.length === 0) return null;

        const selected = item.id === project.selectedItemId;

        return (
          <div key={item.id} className="px-3 pt-1.5">
            <button
              type="button"
              onClick={() => onSelectItem(item.id)}
              className={`-mx-1 mb-0.5 flex w-[calc(100%+0.5rem)] items-baseline gap-2
                rounded px-1 text-left hover:bg-console/70 focus:outline-none
                focus-visible:ring-1 focus-visible:ring-signal ${
                  selected ? 'text-signal' : 'text-graphite/50'
                }`}
            >
              <span className="truncate text-[11px] font-medium">{item.name}</span>
            </button>

            <ul>
              {parts.map(({ part, quantity }) => (
                <li
                  key={part.id}
                  className="flex items-baseline gap-2 border-b border-rule/50 py-1
                    last:border-0"
                >
                  <span className="w-5 shrink-0 text-[12px] font-medium tabular-nums
                    text-graphite/70">
                    {quantity}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-graphite">
                    {part.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-graphite/45">
                    {part.width} × {part.height}
                    {part.holes.length > 0 && (
                      <span className="text-red-500"> · {part.holes.length}h</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {hardware.length > 0 && (
        <>
          <RailHeading title="Hardware" />
          <ul className="px-3">
            {hardware.map((h) => (
              <li key={h.name} className="border-b border-rule/50 py-1 last:border-0">
                <div className="flex items-baseline gap-2">
                  <span className="w-5 shrink-0 text-[12px] font-medium tabular-nums
                    text-graphite/70">
                    {h.quantity}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] text-graphite">
                    {h.name}
                  </span>
                </div>
                {h.note && (
                  <p className="pl-7 text-[11px] leading-snug text-graphite/45">
                    {h.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {fixings.length > 0 && (
        <>
          <RailHeading title="Fixings" />
          <ul className="px-3">
            {fixings.map((f) => (
              <li key={f.name} className="border-b border-rule/50 py-1 last:border-0">
                <div className="flex items-baseline gap-2">
                  <span className="w-5 shrink-0 text-[12px] font-medium tabular-nums
                    text-graphite/70">
                    {f.quantity}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] text-graphite">
                    {f.name}
                  </span>
                </div>
                <p className="pl-7 text-[11px] leading-snug text-graphite/45">
                  {f.note}
                </p>
              </li>
            ))}
          </ul>

          {/* Screwing into the edge of ply is where assembly goes wrong, and it
              goes wrong because nobody names the drill sizes. So name them. */}
          <ul className="space-y-0.5 px-3 pt-1.5">
            {drills.map((d) => (
              <li
                key={d}
                className="border-l-2 border-signal/30 pl-2 text-[11px] leading-snug
                  text-graphite/55"
              >
                {d}
              </li>
            ))}
          </ul>
        </>
      )}

      <RailHeading title="Left to you" />
      <ul className="space-y-1 px-3 pt-1">
        {manual.map((step) => (
          <li
            key={step}
            className="border-l-2 border-amber-300 pl-2 text-[11px] leading-snug
              text-graphite/60"
          >
            {step}
          </li>
        ))}
      </ul>

      <RailHeading title="Estimate" aside={supplier.name} />
      <div className="px-3 pt-1">
        <table className="w-full text-[11px]">
          <tbody>
            {price.lines.map((line) => (
              <tr key={line.label} className="align-baseline">
                <td className="py-0.5 pr-1 text-graphite/70">
                  {line.label}
                  {line.quantity > 1 && (
                    <span className="tabular-nums text-graphite/40">
                      {' '}
                      × {line.quantity}
                    </span>
                  )}
                </td>
                <td className="py-0.5 text-right tabular-nums text-graphite">
                  {money(line.amount)}
                </td>
              </tr>
            ))}
            <tr className="align-baseline">
              <td className="border-t border-rule pt-1 text-graphite/50">GST 15%</td>
              <td className="border-t border-rule pt-1 text-right tabular-nums
                text-graphite/50">
                {money(price.gst)}
              </td>
            </tr>
            <tr className="align-baseline">
              <td className="pt-0.5 text-[12px] font-medium text-graphite">Total</td>
              <td className="pt-0.5 text-right text-[13px] font-semibold tabular-nums
                text-graphite">
                {money(price.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Delivery sits with the total rather than in a settings panel: it is
            the line most likely to be wrong about, and the one people most
            want to flip while looking at the number it changes. */}
        <div className="mt-2 rounded border border-rule bg-console/60 px-2 py-1.5">
          {supplier.charges.freight ? (
            <>
              <label className="flex cursor-pointer items-baseline gap-1.5 text-[11px]
                text-graphite">
                <input
                  type="checkbox"
                  checked={includeFreight}
                  onChange={(e) => onIncludeFreight(e.target.checked)}
                  className="h-3.5 w-3.5 self-center rounded border-rule text-signal
                    focus:ring-1 focus:ring-signal focus:ring-offset-0"
                />
                <span className="flex-1">
                  Deliver to {supplier.charges.freight.area}
                </span>
                <span className="tabular-nums text-graphite/60">
                  {money(supplier.charges.freight.amount)}
                </span>
              </label>
              <p className="mt-1 pl-5 text-[10px] leading-snug text-graphite/45">
                {supplier.deliveryNote}
              </p>
            </>
          ) : (
            <p className="text-[10px] leading-snug text-amber-800">
              <span className="font-medium">Shipping not included.</span>{' '}
              {supplier.deliveryNote}
            </p>
          )}
        </div>

        <p className="mt-2 text-[10px] leading-snug text-graphite/45">
          Estimate only, priced from {supplier.name} {supplier.quote.reference} of{' '}
          {supplier.quote.dateLabel}
          {material.source === 'listed' && ', with this sheet at its listed price'}.
          Prices, stock and fees change &mdash; confirm before ordering.
          {supplier.quote.note && ` ${supplier.quote.note}`}
        </p>

        <p className="mt-1 text-[10px] leading-snug text-graphite/45">
          {sheets === 1 ? 'One sheet' : `${sheets} sheets`}
          {price.cutsAffectPrice ? (
            <>
              , {cuts.cuts} cuts
              {cuts.exact
                ? ' worked out from the layout'
                : ' (approximate: this layout is not one a panel saw can cut straight through)'}
            </>
          ) : (
            <>
              . {supplier.name} charge a flat rate per sheet, so the{' '}
              {cuts.cuts}-cut layout costs the same as any other
            </>
          )}
          .
        </p>
      </div>
    </div>
  );
}

/** One line per kind of screw, totalled over every cabinet in the job. */
function collectFixings(advice: ItemAdvice[]): Fastener[] {
  const byName = new Map<string, Fastener>();

  for (const item of advice) {
    for (const fastener of item.joints?.fasteners ?? []) {
      const existing = byName.get(fastener.name);
      byName.set(
        fastener.name,
        existing
          ? { ...existing, quantity: existing.quantity + fastener.quantity }
          : { ...fastener }
      );
    }
  }

  return [...byName.values()];
}

function RailHeading({
  title,
  aside,
  action,
}: {
  title: string;
  aside?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="sticky top-0 z-10 mt-3 flex items-baseline gap-2 border-y border-rule
      bg-white/95 px-3 py-1 backdrop-blur first:mt-0 first:border-t-0">
      <h2 className="text-[12px] font-medium text-graphite">{title}</h2>
      {aside && (
        <span className="truncate text-[11px] tabular-nums text-graphite/45">
          {aside}
        </span>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="ml-auto shrink-0 rounded px-1 text-[11px] text-signal
            hover:bg-signal/10 focus:outline-none focus-visible:ring-1
            focus-visible:ring-signal"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
