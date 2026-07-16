import { useEffect, useState } from 'react';

interface Props {
  onCapture: (text: string) => void;
  isWithinChat: (node: Node | null) => boolean;
}

interface Pos {
  text: string;
  x: number;
  y: number;
}

export function SelectionButton({ onCapture, isWithinChat }: Props) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!sel || sel.rangeCount === 0 || text === '') {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      // Only offer capture for selections inside a chat message — not the input
      // box, sidebar, or our own UI.
      if (!isWithinChat(range.commonAncestorContainer)) {
        setPos(null);
        return;
      }
      // Some environments (e.g. jsdom) don't implement Range.getBoundingClientRect
      // at all. Real browsers do; fall back to a zero rect so positioning simply
      // degrades instead of throwing.
      const rect =
        typeof range.getBoundingClientRect === 'function'
          ? range.getBoundingClientRect()
          : { right: 0, bottom: 0 };
      setPos({ text, x: rect.right, y: rect.bottom });
    };
    document.addEventListener('mouseup', update);
    document.addEventListener('selectionchange', update);
    return () => {
      document.removeEventListener('mouseup', update);
      document.removeEventListener('selectionchange', update);
    };
  }, [isWithinChat]);

  if (!pos) return null;

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onCapture(pos.text);
        window.getSelection()?.removeAllRanges();
        setPos(null);
      }}
      style={{ position: 'fixed', left: pos.x, top: pos.y + 4, zIndex: 2147483647 }}
      className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-white shadow"
    >
      서랍에 담기
    </button>
  );
}
