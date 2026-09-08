import type { Project, ProjectItem, ItemKind } from '../lib/project/types';
import { describeItem } from '../lib/project/types';

interface ItemListProps {
  project: Project;
  onSelect: (id: string) => void;
  onAdd: (kind: ItemKind) => void;
  onRemove: (id: string) => void;
}

const ADDABLE: { kind: ItemKind; label: string; hint: string }[] = [
  { kind: 'cabinet', label: 'Cabinet', hint: 'A carcass with shelves and optional doors' },
  { kind: 'shelves', label: 'Shelves', hint: 'Loose boards for brackets or an opening' },
  { kind: 'panel', label: 'Panel', hint: 'A plain rectangle out of the drop' },
];

/**
 * Everything in the job, and the way between them.
 *
 * The list is the navigation: one row per thing you are making, click to point
 * the controls and both viewports at it. Keeping it always visible at the top
 * of the rail means adding a shelf to use up a leftover sheet never loses you
 * the cabinet you were in the middle of.
 */
export function ItemList({ project, onSelect, onAdd, onRemove }: ItemListProps) {
  return (
    <div className="border-b border-rule">
      <ul>
        {project.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            selected={item.id === project.selectedItemId}
            removable={project.items.length > 1}
            onSelect={() => onSelect(item.id)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </ul>

      <div className="flex items-center gap-1 px-3 py-1.5">
        <span className="text-[11px] text-graphite/40">Add</span>
        {ADDABLE.map(({ kind, label, hint }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onAdd(kind)}
            title={hint}
            className="rounded border border-rule bg-white px-1.5 py-0.5 text-[11px]
              text-graphite hover:border-signal hover:text-signal focus:outline-none
              focus-visible:ring-1 focus-visible:ring-signal"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  selected,
  removable,
  onSelect,
  onRemove,
}: {
  item: ProjectItem;
  selected: boolean;
  removable: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={`flex w-full items-baseline gap-2 border-l-2 py-1 pl-2.5 pr-7 text-left
          focus:outline-none focus-visible:ring-1 focus-visible:ring-inset
          focus-visible:ring-signal ${
            selected
              ? 'border-l-signal bg-signal/[0.06]'
              : 'border-l-transparent hover:bg-console/60'
          }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-[13px] ${
            selected ? 'font-medium text-graphite' : 'text-graphite/75'
          }`}
        >
          {item.name}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-graphite/40">
          {describeItem(item)}
        </span>
      </button>

      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.name}`}
          className="absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded text-[13px]
            leading-none text-graphite/25 hover:bg-red-50 hover:text-red-600
            focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
        >
          &times;
        </button>
      )}
    </li>
  );
}
