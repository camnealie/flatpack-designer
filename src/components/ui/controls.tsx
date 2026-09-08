import type { ReactNode } from 'react';

/** The small shared control pieces the rails are built from. */

export const selectClass =
  'w-full min-w-0 rounded border border-rule bg-white px-1.5 py-0.5 text-[12px] ' +
  'text-graphite focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal';

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-1.5 flex items-center gap-2">
      <span className="w-[4.5rem] shrink-0 truncate text-[12px] text-graphite/70">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-graphite/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-rule text-signal focus:ring-1
          focus:ring-signal focus:ring-offset-0"
      />
      {label}
    </label>
  );
}
