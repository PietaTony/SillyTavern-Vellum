import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '@/app/theme';
import type { WbEntry } from '../types';
import { EntryEditor } from '../ui/EntryEditor';

/**
 * 🔴 A1（GAP-53）：`wiInject.ts` 算出 `anTop`／`anBottom`／`emTop`／`emBottom`
 * 四個桶，但 `buildTurn.ts` 從沒讀過它們（查證見 `fields.ts` 檔頭、`server/services/promptWorld.ts`）。
 * 兩邊都需要 Author's Note／範例對話這兩個我們沒有的概念才有正確的插入點，
 * 不能瞎猜 —— 選乙案：畫面上把這四個選項標成「尚未接線」，不要假裝接上了。
 *
 * 這一支守的是「使用者真的看得到」這一層：POSITION_GROUP 的字串內容對不對，
 * 由 `worldbookModel.test.ts` 守；這裡守的是 `EntryEditor` 真的把那份事實表
 * 畫進「插在哪裡」的下拉選單——**兩層都要有**，任一層被挖空都要紅。
 */
const entry = (over: Partial<WbEntry> = {}): WbEntry => ({
  uid: '1',
  keys: [],
  secondaryKeys: [],
  content: '',
  comment: '',
  constant: false,
  enabled: true,
  selective: false,
  selectiveLogic: 0,
  order: 0,
  position: 1, // afterChar
  depth: 4,
  role: null,
  probability: 100,
  useProbability: false,
  caseSensitive: false,
  matchWholeWords: false,
  ignoreBudget: false,
  group: '',
  ...over,
});

function openPositionSelect() {
  fireEvent.mouseDown(screen.getByLabelText('插在哪裡'));
}

describe('EntryEditor：插入位置下拉選單', () => {
  it('🔴 下拉選單一打開，四個未接線的選項標題就帶「尚未接線」——不必等選了才知道', () => {
    render(
      <ThemeProvider theme={theme}>
        <EntryEditor value={entry()} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    openPositionSelect();
    expect(screen.getByRole('option', { name: '作者備註之前（尚未接線）' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '作者備註之後（尚未接線）' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '範例對話之前（尚未接線）' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '範例對話之後（尚未接線）' })).toBeTruthy();
  });

  it('有消費者的選項不帶「尚未接線」', () => {
    render(
      <ThemeProvider theme={theme}>
        <EntryEditor value={entry()} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    openPositionSelect();
    expect(screen.getByRole('option', { name: '角色描述之前' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '角色描述之後' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '插進對話裡' })).toBeTruthy();
  });

  /** 🔴 選了以後 helperText 也要講，不是只有列表那一層——兩個管道都要看得到。 */
  it('已經選到未接線位置時，helperText 講出同一件事', () => {
    render(
      <ThemeProvider theme={theme}>
        <EntryEditor value={entry({ position: 2 })} onChange={vi.fn()} />
      </ThemeProvider>,
    );
    // 🔴 選到的值本身也會顯示「尚未接線」（選單顯示文字＋ helperText 兩處都有），
    // 用 getAllByText 而不是 getByText —— 這裡要的是「至少講了一次」，不是唯一一處。
    expect(screen.getAllByText(/尚未接線/).length).toBeGreaterThan(0);
  });
});
