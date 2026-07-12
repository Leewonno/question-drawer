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
    document.body.innerHTML = '<p id="answer">side effect</p>';
    window.getSelection()?.removeAllRanges();
  });

  it('is hidden when there is no selection', () => {
    render(<SelectionButton onCapture={() => {}} />);
    expect(screen.queryByRole('button', { name: '서랍에 담기' })).toBeNull();
  });

  it('shows after selecting text and calls onCapture on click', async () => {
    const onCapture = vi.fn();
    render(<SelectionButton onCapture={onCapture} />);

    selectText(document.getElementById('answer')!);
    fireEvent.mouseUp(document);

    const btn = await screen.findByRole('button', { name: '서랍에 담기' });
    await userEvent.click(btn);
    expect(onCapture).toHaveBeenCalledWith('side effect');
  });
});
