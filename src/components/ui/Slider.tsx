interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Shown under the track when the value needs explaining. */
  hint?: string;
}

/**
 * A dimension you can sweep.
 *
 * Pairs a track with a typed field, because the two answer different
 * questions: dragging is for "what happens if this gets bigger", typing is for
 * "make it exactly 568". Dragging fires on every step, so the model and the
 * sheet layout redraw continuously - that live response is the point, not a
 * side effect, and it is why there is no debounce here.
 */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  hint,
}: SliderProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Track fill, so the slider reads as a measurement rather than a knob
  const fraction = max > min ? (value - min) / (max - min) : 0;
  const fill = `${Math.min(100, Math.max(0, fraction * 100))}%`;

  const clamp = (next: number) =>
    Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : value;

  return (
    <div className="py-[3px]">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="truncate text-[12px] text-graphite/70">
          {label}
        </label>
        <div className="flex items-baseline gap-1">
          <input
            type="number"
            aria-label={`${label} value`}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="w-[3.6rem] bg-transparent text-right text-[13px] font-medium
              tabular-nums text-graphite rounded px-1 py-0
              border border-transparent hover:border-rule
              focus:outline-none focus:border-signal focus:bg-white
              [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none
              [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && (
            <span className="w-3.5 text-[10px] text-graphite/40">{unit}</span>
          )}
        </div>
      </div>

      <input
        id={id}
        type="range"
        className="range mt-0.5"
        style={{ '--fill': fill } as React.CSSProperties}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      {hint && (
        <p className="mt-0.5 text-[11px] leading-snug text-graphite/45">{hint}</p>
      )}
    </div>
  );
}
