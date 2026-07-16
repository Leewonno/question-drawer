import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionButton } from './SelectionButton';

function selectText(node: Node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('SelectionButton', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="chat">side effect</div><textarea id="input">draft</textarea>';
    window.getSelection()?.removeAllRanges();
  });

  const isWithinChat = (node: Node | null) => {
    const el = node instanceof Element ? node : (node?.parentElement ?? null);
    return el?.closest('#chat') != null;
  };

  it('is hidden when there is no selection', () => {
    render(<SelectionButton onCapture={() => {}} isWithinChat={isWithinChat} />);
    expect(screen.queryByRole('button', { name: '서랍에 담기' })).toBeNull();
  });

  it('shows after selecting chat text and calls onCapture on click', async () => {
    const onCapture = vi.fn();
    render(<SelectionButton onCapture={onCapture} isWithinChat={isWithinChat} />);

    selectText(document.getElementById('chat')!);
    fireEvent.mouseUp(document);

    const btn = await screen.findByRole('button', { name: '서랍에 담기' });
    await userEvent.click(btn);
    expect(onCapture).toHaveBeenCalledWith('side effect');
  });

  it('stays hidden when the selection is outside the chat area', () => {
    render(<SelectionButton onCapture={() => {}} isWithinChat={isWithinChat} />);

    selectText(document.getElementById('input')!);
    fireEvent.mouseUp(document);

    expect(screen.queryByRole('button', { name: '서랍에 담기' })).toBeNull();
  });
});
