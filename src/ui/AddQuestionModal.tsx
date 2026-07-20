import { useEffect, useRef, useState } from 'react';

interface Props {
  onSave: (question: string) => void;
  onClose: () => void;
}

export function AddQuestionModal({ onSave, onClose }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const trimmed = value.trim();
  const submit = () => {
    if (trimmed) onSave(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="질문 직접 담기"
      onMouseDown={onClose}
      // The drawer lives in a shadow root, but key events still bubble to the
      // host page (claude.ai / ChatGPT), whose document-level shortcut handlers
      // would otherwise steal focus back to their own chat input as you type.
      // Keep every keystroke inside the modal.
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 p-4 font-sans"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-qd-line bg-qd-panel p-5 shadow-xl dark:border-qd-line-dark dark:bg-qd-panel-dark"
      >
        <h3 className="text-sm font-semibold text-qd-ink dark:text-qd-ink-dark">
          질문 직접 담기
        </h3>
        <p className="mt-1 text-xs text-qd-muted dark:text-qd-muted-dark">
          저장하고 싶은 질문을 입력하세요
        </p>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={4}
          placeholder="예: 리액트 훅의 동작 원리를 자세히 설명해줘"
          className="mt-3 w-full resize-none rounded-xl border border-qd-line bg-qd-card px-3 py-2 text-sm leading-snug text-qd-ink placeholder:text-qd-muted focus:border-qd-accent focus:outline-none dark:border-qd-line-dark dark:bg-qd-card-dark dark:text-qd-ink-dark dark:placeholder:text-qd-muted-dark"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-qd-muted hover:text-qd-ink dark:text-qd-muted-dark dark:hover:text-qd-ink-dark"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={!trimmed}
            className="rounded-lg bg-qd-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            담기
          </button>
        </div>
      </div>
    </div>
  );
}
