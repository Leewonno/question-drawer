import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawerItemCard } from './DrawerItemCard';
import type { DrawerItem } from '@/src/lib/schema';

const item: DrawerItem = {
  id: 'a1',
  selectedText: 'side effect',
  question: 'side effect에 대해 자세히 설명해줘',
  site: 'claude',
  conversationId: 'chat-1',
  createdAt: Date.now(),
};

describe('DrawerItemCard', () => {
  it('shows the question and fires onClick', async () => {
    const onClick = vi.fn();
    render(<DrawerItemCard item={item} fresh={false} onClick={onClick} onRemove={() => {}} />);

    await userEvent.click(screen.getByText(item.question));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fires onRemove from the delete button', async () => {
    const onRemove = vi.fn();
    render(<DrawerItemCard item={item} fresh={false} onClick={() => {}} onRemove={onRemove} />);

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows the just-added label only when fresh', () => {
    const { rerender } = render(
      <DrawerItemCard item={item} fresh onClick={() => {}} onRemove={() => {}} />,
    );
    expect(screen.getByText('방금 담김')).toBeInTheDocument();

    rerender(
      <DrawerItemCard item={item} fresh={false} onClick={() => {}} onRemove={() => {}} />,
    );
    expect(screen.queryByText('방금 담김')).toBeNull();
  });
});
