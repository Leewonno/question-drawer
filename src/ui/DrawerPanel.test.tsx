import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing';
import { DrawerPanel } from './DrawerPanel';
import { drawerStorage } from '@/src/lib/storage';
import { createDrawerItem } from '@/src/lib/template';
import { DOCK_CLASS } from '@/src/lib/dock';

describe('DrawerPanel', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.documentElement.classList.remove(DOCK_CLASS);
    // The tests below store items with no conversation id, so they need a URL
    // with none either. Keeps the isolation test at the bottom from leaking.
    history.replaceState(null, '', '/');
  });

  it('renders stored questions and fires onItemClick', async () => {
    await drawerStorage.add(createDrawerItem('side effect', 'claude', null));
    const onItemClick = vi.fn();
    render(<DrawerPanel site="claude" onItemClick={onItemClick} />);

    const item = await screen.findByText('side effect에 대해 자세히 설명해줘');
    await userEvent.click(item);
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });

  it('removes an item when its delete button is clicked', async () => {
    await drawerStorage.add(createDrawerItem('side effect', 'claude', null));
    render(<DrawerPanel site="claude" onItemClick={() => {}} />);

    await screen.findByText('side effect에 대해 자세히 설명해줘');
    await userEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() =>
      expect(screen.queryByText('side effect에 대해 자세히 설명해줘')).toBeNull(),
    );
  });

  it('counts the questions in the header', async () => {
    await drawerStorage.add(createDrawerItem('side effect', 'claude', null));
    await drawerStorage.add(createDrawerItem('cleanup', 'claude', null));
    render(<DrawerPanel site="claude" onItemClick={() => {}} />);

    expect(await screen.findByText('떠오른 질문 2개 · 클릭하면 바로 질문')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is stored', async () => {
    render(<DrawerPanel site="claude" onItemClick={() => {}} />);

    expect(
      await screen.findByText('답변에서 궁금한 부분을 드래그해 담아보세요'),
    ).toBeInTheDocument();
  });

  it('lists the newest question first', async () => {
    await drawerStorage.add({ ...createDrawerItem('older', 'claude', null), createdAt: 1000 });
    await drawerStorage.add({ ...createDrawerItem('newer', 'claude', null), createdAt: 2000 });
    render(<DrawerPanel site="claude" onItemClick={() => {}} />);

    await screen.findByText('newer에 대해 자세히 설명해줘');
    const questions = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(questions[0]).toContain('newer');
    expect(questions[1]).toContain('older');
  });

  it('hides questions captured in another conversation', async () => {
    history.replaceState(null, '', '/c/chat-1');
    await drawerStorage.add(createDrawerItem('elsewhere', 'claude', 'chat-2'));
    render(<DrawerPanel site="claude" onItemClick={() => {}} />);

    expect(
      await screen.findByText('답변에서 궁금한 부분을 드래그해 담아보세요'),
    ).toBeInTheDocument();
    expect(screen.queryByText('elsewhere에 대해 자세히 설명해줘')).toBeNull();
  });

  it('docks the page while open and undocks when collapsed', async () => {
    render(<DrawerPanel site="claude" onItemClick={() => {}} />);

    await waitFor(() =>
      expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(true),
    );

    await userEvent.click(screen.getByRole('button', { name: '서랍 닫기' }));

    expect(document.documentElement.classList.contains(DOCK_CLASS)).toBe(false);
    expect(screen.getByRole('button', { name: '서랍 열기' })).toBeInTheDocument();
  });
});
