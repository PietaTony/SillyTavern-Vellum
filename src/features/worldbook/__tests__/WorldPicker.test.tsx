import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorldPicker } from '../ui/WorldPicker';

const WORLDS = [
  {
    id: 'w1',
    name: '何思年',
    entryCount: 38,
    enabledCount: 20,
    changedCount: 11,
    updatedAt: 'T',
    usedBy: [{ kind: 'friend' as const, id: 'c1', name: '何思年' }],
  },
  {
    id: 'w2',
    name: '何思年(1)',
    entryCount: 38,
    enabledCount: 27,
    changedCount: 20,
    updatedAt: 'T',
    usedBy: [],
  },
];

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => WORLDS })) as unknown as typeof fetch,
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('WorldPicker（C6）', () => {
  it('沒綁定時說「沒有綁定世界書」，按鈕是「選擇」', () => {
    wrap(<WorldPicker value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('沒有綁定世界書')).toBeTruthy();
    expect(screen.getByText('選擇')).toBeTruthy();
  });

  /**
   * 🔴 **這一條是實際踩到的**：清單原本只在打開對話框時才載入，
   * 所以已綁定的情況下畫面只顯示得出一串 id，使用者看不出綁的是哪一本。
   */
  it('🔴 已綁定時要解出書名，不是只顯示 id', async () => {
    wrap(<WorldPicker value="w2" onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('何思年(1)')).toBeTruthy());
    expect(screen.getByText('更換')).toBeTruthy();
  });

  it('選一本會把 id 回報上去', async () => {
    const onChange = vi.fn();
    wrap(<WorldPicker value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('選擇'));
    await waitFor(() => expect(screen.getByText('何思年(1)')).toBeTruthy());
    fireEvent.click(screen.getByText('何思年(1)'));
    expect(onChange).toHaveBeenCalledWith('w2');
  });

  /** 🔴 解除綁定跟綁定一樣常用，所以它是清單裡的第一個選項，不是一顆小字連結。 */
  it('🔴 「不綁定」是清單裡的選項，選了會回報 undefined', async () => {
    const onChange = vi.fn();
    wrap(<WorldPicker value="w1" onChange={onChange} />);
    await waitFor(() => expect(screen.getByText('更換')).toBeTruthy());
    fireEvent.click(screen.getByText('更換'));
    await waitFor(() => expect(screen.getByText('不綁定')).toBeTruthy());
    fireEvent.click(screen.getByText('不綁定'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('一本書都沒有時說得出「怎麼會有」，不是給一個空清單', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch,
    );
    wrap(<WorldPicker value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('選擇'));
    await waitFor(() => expect(screen.getByText(/跟著角色卡一起進來/)).toBeTruthy());
  });
});
