import { Slider } from './ui/Slider';
import { Section } from './ui/Section';
import { Toggle, Field, selectClass } from './ui/controls';
import type {
  ProjectItem,
  CabinetItem,
  HingeStyle,
  BackStyle,
} from '../lib/project/types';
import { BACK_STYLE_LABELS } from '../lib/project/types';
import type { HingeSide } from '../lib/geometry/types';
import { hingeCountForHeight, canBoreCups } from '../lib/geometry/hinge';
import { HINGES } from '../lib/constants';
import type { Supplier } from '../lib/pricing/suppliers';
import { DUTIES } from '../lib/engineering/shelf';
import type { ShelfDuty } from '../lib/engineering/shelf';
import type { ItemAdvice } from '../lib/project/advice';

interface ItemEditorProps {
  item: ProjectItem;
  thickness: number;
  supplier: Supplier;
  advice: ItemAdvice | undefined;
  /** Switch the whole job to a thicker sheet, when that is the fix */
  onUpgradeThickness: (thicknessMm: number) => void;
  onChange: (patch: Partial<ProjectItem>) => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ItemEditor({
  item,
  thickness,
  supplier,
  advice,
  onUpgradeThickness,
  onChange,
}: ItemEditorProps) {
  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          type="text"
          aria-label="Item name"
          value={item.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1
            py-0.5 text-[14px] font-medium text-graphite hover:border-rule
            focus:border-signal focus:bg-white focus:outline-none"
        />
      </div>

      {item.kind === 'cabinet' && (
        <CabinetEditor
          item={item}
          thickness={thickness}
          supplier={supplier}
          advice={advice}
          onUpgradeThickness={onUpgradeThickness}
          onChange={onChange}
        />
      )}

      {item.kind === 'shelves' && (
        <Section title="Shelves" defaultOpen>
          <Slider
            label="Width"
            unit="mm"
            value={item.width}
            onChange={(width) => onChange({ width })}
            min={100}
            max={2400}
            step={5}
          />
          <Slider
            label="Depth"
            unit="mm"
            value={item.depth}
            onChange={(depth) => onChange({ depth })}
            min={100}
            max={800}
            step={5}
          />
          <Slider
            label="How many"
            value={item.quantity}
            onChange={(quantity) => onChange({ quantity })}
            min={1}
            max={20}
            hint="Loose boards, cut to the full width. Nothing is machined into them."
          />
          <DutyPicker
            duty={item.duty}
            onChange={(duty) => onChange({ duty })}
          />
          <SagNote advice={advice} onUpgradeThickness={onUpgradeThickness} />
        </Section>
      )}

      {item.kind === 'panel' && (
        <Section title="Panel" defaultOpen>
          <Slider
            label="Width"
            unit="mm"
            value={item.width}
            onChange={(width) => onChange({ width })}
            min={50}
            max={2400}
            step={5}
          />
          <Slider
            label="Height"
            unit="mm"
            value={item.height}
            onChange={(height) => onChange({ height })}
            min={50}
            max={1220}
            step={5}
          />
          <Slider
            label="How many"
            value={item.quantity}
            onChange={(quantity) => onChange({ quantity })}
            min={1}
            max={20}
            hint="A plain rectangle. Good for using up what is left of a sheet."
          />
        </Section>
      )}
    </div>
  );
}

function CabinetEditor({
  item,
  thickness,
  supplier,
  advice,
  onUpgradeThickness,
  onChange,
}: {
  item: CabinetItem;
  thickness: number;
  supplier: Supplier;
  advice: ItemAdvice | undefined;
  onUpgradeThickness: (thicknessMm: number) => void;
  onChange: (patch: Partial<CabinetItem>) => void;
}) {
  const innerWidth = item.width - 2 * thickness;
  const doorWidth =
    item.doorCount > 0
      ? (item.width - (item.doorCount - 1) * item.doorGap) / item.doorCount
      : 0;
  const hingesPerDoor = hingeCountForHeight(item.height);
  const cupsFit = canBoreCups(doorWidth, thickness);

  return (
    <>
      <Section
        title="Size"
        defaultOpen
        summary={`${item.width} × ${item.height} × ${item.depth}`}
      >
        <Slider
          label="Width"
          unit="mm"
          value={item.width}
          onChange={(width) => onChange({ width })}
          min={200}
          max={2400}
          step={5}
        />
        <Slider
          label="Height"
          unit="mm"
          value={item.height}
          onChange={(height) => onChange({ height })}
          min={300}
          max={2400}
          step={5}
        />
        <Slider
          label="Depth"
          unit="mm"
          value={item.depth}
          onChange={(depth) => onChange({ depth })}
          min={150}
          max={800}
          step={5}
          hint={`Shelves cut ${Math.round(innerWidth)}mm wide to sit between the sides.`}
        />
      </Section>

      <Section title="Shelves" defaultOpen summary={shelfSummary(item)}>
        <Slider
          label="Adjustable"
          value={item.adjustableShelves}
          onChange={(adjustableShelves) => onChange({ adjustableShelves })}
          min={0}
          max={12}
          hint="They rest on pins, so they land on the rows that actually get bored."
        />
        {/* The slider is what caused this, so the correction belongs under it
            rather than in the warnings strip across the room. */}
        {advice?.shelvesCapped && (
          <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5
            text-[11px] leading-snug text-amber-900">
            Only {advice.shelvesCapped.possible} of these fit: a shelf has to sit
            on a pin row, and this cabinet has{' '}
            {advice.shelvesCapped.possible} of them. Make it taller for more.
            <button
              type="button"
              onClick={() =>
                onChange({ adjustableShelves: advice.shelvesCapped!.possible })
              }
              className="ml-1 rounded border border-current/30 px-1.5 py-0.5
                font-medium hover:bg-white/60 focus:outline-none
                focus-visible:ring-1 focus-visible:ring-signal"
            >
              Use {advice.shelvesCapped.possible}
            </button>
          </div>
        )}
        <div className="mt-1 flex gap-4">
          <Toggle
            label="Fixed top"
            checked={item.fixedTop}
            onChange={(fixedTop) => onChange({ fixedTop })}
          />
          <Toggle
            label="Fixed bottom"
            checked={item.fixedBottom}
            onChange={(fixedBottom) => onChange({ fixedBottom })}
          />
        </div>
        <DutyPicker duty={item.duty} onChange={(duty) => onChange({ duty })} />
        <SagNote advice={advice} onUpgradeThickness={onUpgradeThickness} />
        <Openings advice={advice} />
      </Section>

      <Section
        title="Doors"
        defaultOpen
        summary={item.doors ? plural(item.doorCount, 'door') : 'None'}
      >
        <Toggle
          label="Add doors"
          checked={item.doors}
          onChange={(doors) => onChange({ doors })}
        />

        {item.doors && (
          <div className="mt-1">
            <Slider
              label="How many"
              value={item.doorCount}
              onChange={(doorCount) => onChange({ doorCount })}
              min={1}
              max={4}
            />
            <Slider
              label="Reveal"
              unit="mm"
              value={item.doorGap}
              onChange={(doorGap) => onChange({ doorGap })}
              min={0}
              max={10}
              step={0.5}
            />

            <Field label="Hinge">
              <select
                value={item.hingeStyle}
                onChange={(e) =>
                  onChange({ hingeStyle: e.target.value as HingeStyle })
                }
                className={selectClass}
              >
                <option value="no-bore">No-drill sprung</option>
                <option value="euro-35">Concealed, 35mm cup</option>
              </select>
            </Field>

            {item.doorCount === 1 && (
              <Field label="Hinge side">
                <select
                  value={item.doorHingeSide}
                  onChange={(e) =>
                    onChange({ doorHingeSide: e.target.value as HingeSide })
                  }
                  className={selectClass}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </Field>
            )}

            <p className="mt-1.5 text-[11px] leading-snug text-graphite/45">
              <span className="tabular-nums">
                {item.doorCount} × {Math.round(doorWidth)} × {item.height}mm
              </span>
              , full overlay &mdash; the doors cover the carcass edges completely,
              so the sides are hidden when they are shut.{' '}
              {item.hingeStyle === 'no-bore' ? (
                <>
                  The sprung hinge screws to the face of the side panel and the
                  back of the door, so nothing is machined and the panels come
                  off the saw ready to assemble. Allow{' '}
                  {plural(hingesPerDoor, 'hinge')} a door.
                </>
              ) : cupsFit ? (
                <>
                  {plural(hingesPerDoor, 'hinge')} a door, each needing a{' '}
                  {HINGES.CUP_DIAMETER}mm cup bored{' '}
                  {HINGES.CUP_EDGE_INSET}mm in from the hinge edge and a plate
                  screwed to the side panel.{' '}
                  {supplier.cnc
                    ? `${supplier.name} machine those cups, so they cost you nothing but the hardware.`
                    : `${supplier.name} will not bore them, so that is a Forstner bit and a steady hand per door.`}
                </>
              ) : (
                <span className="text-amber-700">
                  A {Math.round(doorWidth)}mm door in {thickness}mm material
                  cannot take a {HINGES.CUP_DIAMETER}mm cup. Use the no-drill
                  hinge instead.
                </span>
              )}
            </p>
          </div>
        )}
      </Section>

      <Section title="Back" summary={BACK_STYLE_LABELS[item.backStyle]}>
        {/* One decision, not two. Rails and a panel do the same job, so being
            able to have both was paying twice for one thing. */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(BACK_STYLE_LABELS) as BackStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onChange({ backStyle: style })}
              aria-pressed={item.backStyle === style}
              className={`rounded border px-1.5 py-1 text-[11px] focus:outline-none
                focus-visible:ring-1 focus-visible:ring-signal ${
                  item.backStyle === style
                    ? 'border-signal bg-signal/5 text-graphite'
                    : 'border-rule text-graphite/60 hover:border-graphite/30'
                }`}
            >
              {BACK_STYLE_LABELS[style]}
            </button>
          ))}
        </div>

        {item.backStyle === 'rails' && (
          <div className="mt-1">
            <Slider
              label="Rails"
              value={item.backBraces}
              onChange={(backBraces) => onChange({ backBraces })}
              min={1}
              max={6}
            />
            <Slider
              label="Rail height"
              unit="mm"
              value={item.backBraceHeight}
              onChange={(backBraceHeight) => onChange({ backBraceHeight })}
              min={30}
              max={400}
              step={5}
              hint={`Cut ${Math.round(innerWidth)}mm wide to sit between the sides.`}
            />
          </div>
        )}

        <p className="mt-2 text-[11px] leading-snug text-graphite/45">
          {item.backStyle === 'open' && (
            <>
              Nothing across the back. Fine if it is going into an alcove or
              screwed to a wall, but on its own a four-sided box can lean over
              like a parallelogram.
            </>
          )}
          {item.backStyle === 'rails' && (
            <>
              Rails across the back stop it racking and give you something solid
              to screw into the wall through, without the cost of a whole panel.
            </>
          )}
          {item.backStyle === 'inset' && (
            <>
              <span className="text-amber-700">
                Housed inside the carcass, so it has to fit the opening exactly
                &mdash; a millimetre over and it will not go in, a millimetre
                under and you can see the gap.
              </span>{' '}
              It also sits where the shelves want to be, so they come out{' '}
              {thickness}mm shallower at{' '}
              <span className="tabular-nums">{item.depth - thickness}mm</span>.
            </>
          )}
          {item.backStyle === 'overlay' && (
            <>
              Laid over the back edges and screwed on, at the full{' '}
              <span className="tabular-nums">
                {item.width} × {item.height}mm
              </span>
              . Nothing inside the carcass changes and the shelves keep their
              full depth. Much more forgiving of a cut that is slightly out,
              since only the outside edges show.
            </>
          )}
        </p>
      </Section>
    </>
  );
}

/**
 * The gaps the shelves leave, and what will go in them.
 *
 * Nothing on screen otherwise stops someone putting eight shelves in a 700mm
 * cabinet - the parts list prices it quite happily. The number that matters is
 * the clear height of each opening, and the thing that makes it land is saying
 * what that height means: "218mm" is data, "a cereal box will not stand up"
 * is an answer.
 */
function Openings({ advice }: { advice: ItemAdvice | undefined }) {
  const list = advice?.openings;
  if (!list || list.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] text-graphite/45">
        Gaps between shelves, bottom to top
      </p>
      <ul className="space-y-px">
        {[...list].reverse().map((opening, i) => (
          <li
            key={`${list.length - 1 - i}`}
            className={`flex items-baseline gap-2 rounded px-1.5 py-0.5 text-[11px] ${
              opening.tooTight ? 'bg-amber-50 text-amber-900' : 'text-graphite/55'
            }`}
          >
            <span className="w-10 shrink-0 text-right font-medium tabular-nums
              text-graphite">
              {Math.round(opening.heightMm)}mm
            </span>
            <span className="leading-snug">{opening.fits}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the shelves have to carry.
 *
 * Nobody can answer "what uniformly distributed load in kilograms per square
 * metre", and everybody can answer "books or ornaments". This is the input the
 * sag calculation actually needs, asked in a form its user can give.
 */
function DutyPicker({
  duty,
  onChange,
}: {
  duty: ShelfDuty;
  onChange: (duty: ShelfDuty) => void;
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] text-graphite/45">What will they hold?</p>
      <div className="flex gap-1.5">
        {(Object.keys(DUTIES) as ShelfDuty[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            title={DUTIES[key].description}
            aria-pressed={duty === key}
            className={`flex-1 rounded border px-1 py-1 text-[11px] focus:outline-none
              focus-visible:ring-1 focus-visible:ring-signal ${
                duty === key
                  ? 'border-signal bg-signal/5 text-graphite'
                  : 'border-rule text-graphite/60 hover:border-graphite/30'
              }`}
          >
            {DUTIES[key].label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-graphite/40">
        {DUTIES[duty].description}
      </p>
    </div>
  );
}

/**
 * The sag verdict, in millimetres and in words.
 *
 * The whole point is to catch someone saving money on a thinner sheet before
 * they order it, so when a thicker one would fix it that is one button rather
 * than a hint to go and work it out.
 */
function SagNote({
  advice,
  onUpgradeThickness,
}: {
  advice: ItemAdvice | undefined;
  onUpgradeThickness: (thicknessMm: number) => void;
}) {
  const shelf = advice?.shelf;
  if (!shelf) return null;

  const tone =
    shelf.verdict === 'toofar'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : shelf.verdict === 'marginal'
        ? 'border-rule bg-console text-graphite/70'
        : 'border-emerald-200 bg-emerald-50/70 text-emerald-900';

  return (
    <div className={`mt-2 rounded border px-2 py-1.5 text-[11px] leading-snug ${tone}`}>
      <p>
        <span className="tabular-nums">{Math.round(shelf.spanMm)}mm</span> span.{' '}
        {shelf.sentence}
      </p>

      {shelf.upgradeToMm && (
        <button
          type="button"
          onClick={() => onUpgradeThickness(shelf.upgradeToMm!)}
          className="mt-1 rounded border border-current/30 px-1.5 py-0.5 font-medium
            hover:bg-white/60 focus:outline-none focus-visible:ring-1
            focus-visible:ring-signal"
        >
          Use {shelf.upgradeToMm}mm instead
        </button>
      )}
    </div>
  );
}

function shelfSummary(item: CabinetItem): string {
  const parts = [plural(item.adjustableShelves, 'adjustable')];
  const fixed = [item.fixedTop && 'top', item.fixedBottom && 'bottom'].filter(
    Boolean
  );
  if (fixed.length > 0) parts.push(`fixed ${fixed.join(' + ')}`);
  return parts.join(', ');
}
