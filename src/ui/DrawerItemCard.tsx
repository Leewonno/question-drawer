import type { DrawerItem } from '@/src/lib/schema';

interface Props {
  item: DrawerItem;
  fresh: boolean;
  onClick: () => void;
  onRemove: () => void;
}

export function DrawerItemCard({ item, fresh, onClick, onRemove }: Props) {
  return (
    <li
      className={`group relative rounded-xl border transition-colors ${
        fresh
          ? 'border-qd-accent bg-qd-fresh dark:bg-qd-fresh-dark'
          : 'border-qd-line bg-qd-card dark:border-qd-line-dark dark:bg-qd-card-dark'
      }`}
    >
      <button
        onClick={onClick}
        className="flex w-full items-start gap-2 rounded-xl p-3 text-left"
      >
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 text-xs ${
            fresh ? 'text-qd-accent' : 'text-qd-muted dark:text-qd-muted-dark'
          }`}
        >
          {fresh ? '✦' : '?'}
        </span>
        <span className="flex flex-col gap-1">
          <span className="line-clamp-2 text-sm leading-snug text-qd-ink dark:text-qd-ink-dark">
            {item.question}
          </span>
          {fresh && <span className="text-xs text-qd-accent">방금 담김</span>}
        </span>
      </button>
      <button
        aria-label="삭제"
        onClick={onRemove}
        className="absolute right-2 top-1 rounded p-1 text-qd-muted opacity-0 transition-opacity hover:text-qd-danger focus-visible:opacity-100 group-hover:opacity-100 dark:text-qd-muted-dark"
      >
        ×
      </button>
    </li>
  );
}
