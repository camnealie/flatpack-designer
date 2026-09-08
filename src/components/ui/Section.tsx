import { useState } from 'react';
import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  /** Current state in a few words, shown while the section is closed. */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One group of controls in the rail.
 *
 * Every control fits on one screen only if the ones you are not using fold
 * away, so a closed section still reports where it stands - "2 doors, 4
 * hinges" - and you open it when that is the thing you want to change.
 */
export function Section({
  title,
  summary,
  defaultOpen = false,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-rule/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-baseline gap-1.5 px-3 py-1.5 text-left
          hover:bg-white/70 focus:outline-none focus-visible:bg-white
          focus-visible:ring-1 focus-visible:ring-signal"
      >
        <svg
          viewBox="0 0 8 8"
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 self-center fill-graphite/35 transition-transform
            duration-150 group-hover:fill-graphite/60 ${open ? 'rotate-90' : ''}`}
        >
          <path d="M2 0.5 L6.5 4 L2 7.5 Z" />
        </svg>
        <span className="text-[13px] font-medium text-graphite">{title}</span>
        {!open && summary && (
          <span className="ml-auto truncate text-[12px] tabular-nums text-graphite/45">
            {summary}
          </span>
        )}
      </button>

      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </section>
  );
}
