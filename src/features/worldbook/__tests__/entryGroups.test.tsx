import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import { defaultOpenGroups, readOpenGroups } from '../openGroups';
import type { WbEntry } from '../types';
import { EntryList } from '../ui/EntryList';

/**
 * 世界書條目的分組折疊（Peter 2026-08-27：「預設是折疊的，不要一次顯示一堆」）。
 *
 * 🔴 這一頁實測 38 條。守的是三件事：**預設收起**、**收起時看得出哪一組有東西**、
 * **打開過的組要記得**（點一條進編輯器再返回是最常見的動線）。
 */
const entry = (uid: string, position: number, enabled = false): WbEntry =>
  ({
    uid,
    position,
    order: 0,
    enabled,
    comment: `條目 ${uid}`,
    keys: [],
    content: '',
  }) as unknown as WbEntry;

const groups = [
  { position: 0, entries: [entry('a', 0, true), entry('b', 0)] },
  { position: 4, entries: [entry('c', 4)] },
];

const render = (worldId: string, gs = groups) =>
  rtlRender(
    <ThemeProvider theme={theme}>
      <EntryList worldId={worldId} groups={gs} busyUid={null} onToggle={vi.fn()} onOpen={vi.fn()} />
    </ThemeProvider>,
  );

beforeEach(() => localStorage.clear());

describe('分組折疊', () => {
  it('🔴 預設全部收起 —— 一次攤開 38 條，使用者要先捲過一整片才知道有哪幾組', () => {
    render('w1');
    expect(screen.queryByText('條目 a')).toBeNull();
    expect(screen.queryByText('條目 c')).toBeNull();
  });

  it('🔴 收起時照樣看得出哪一組有東西開著 —— 不然要逐組打開才知道', () => {
    render('w1');
    expect(screen.getByText('1 / 2 開')).toBeTruthy();
    expect(screen.getByText('0 / 1 開')).toBeTruthy();
  });

  it('點標題會展開，再點收起', async () => {
    render('w1');
    const head = screen.getAllByRole('button', { expanded: false })[0] as HTMLElement;
    fireEvent.click(head);
    expect(screen.getByText('條目 a')).toBeTruthy();
    fireEvent.click(head);
    // ⚠️ `Collapse` 是收完動畫才卸載（`unmountOnExit`）—— 同步斷言會抓到還在退場的那一幀。
    await waitFor(() => expect(screen.queryByText('條目 a')).toBeNull());
  });

  it('🔴 打開過的組要記得 —— 進編輯器再返回不該又收回去', () => {
    const first = render('w1');
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0] as HTMLElement);
    first.unmount();
    render('w1');
    expect(screen.getByText('條目 a')).toBeTruthy();
  });

  it('🔴 記的是「這一本」—— 換一本書不該繼承別人的展開狀態', () => {
    const first = render('w1');
    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0] as HTMLElement);
    first.unmount();
    render('w2');
    expect(screen.queryByText('條目 a')).toBeNull();
  });
});

describe('openGroups 的判準', () => {
  it('🔴 只有一組就展開 —— 收起一個唯一的分組只是多一次點擊', () => {
    expect(defaultOpenGroups([3])).toEqual([3]);
    expect(defaultOpenGroups([])).toEqual([]);
    expect(defaultOpenGroups([0, 4])).toEqual([]);
  });

  it('🔴 存過的組號要跟現在真的存在的取交集 —— 不然「全部收起」會被看不見的值撐著', () => {
    localStorage.setItem('vellum.ui.wbGroups.w9', JSON.stringify({ v: [0, 99], t: 1 }));
    expect(readOpenGroups('w9', [0, 4])).toEqual([0]);
  });
});
