import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { readDraft, writeDraft } from '../draftStore';
import { useDraftWriter } from '../useDraftWriter';

const KEY = 'vellum.draft.test.writer';

beforeEach(() => localStorage.clear());

/**
 * 🔴 **這支測的是「為什麼結果會對」，不是「結果對不對」。**
 *
 * `DraftField.test.tsx` 那條端到端測試**分辨不出 ref 有沒有同步寫** ——
 * React 在事件派送結束就把 `sync` effect flush 了，ref 會被補正，
 * 於是「故意不同步寫 ref」的版本照樣通過（實測過）。
 * ⇒ 這裡刻意**只呼叫 `onInput`、完全不呼叫 `sync`**，
 * 讓 `flush()` 除了 ref 之外沒有別的地方可以拿到值。
 */
describe('useDraftWriter', () => {
  it('🔴 flush 讀的是 onInput 同步寫進去的 ref（沒有 sync 也要對）', () => {
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => {
      result.current.onInput('我今天很');
      result.current.onInput('我今天很好');
      result.current.flush();
    });
    expect(readDraft<string>(KEY)).toBe('我今天很好');
  });

  it('沒動過就不寫', () => {
    writeDraft(KEY, '既有草稿');
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => result.current.flush());
    expect(readDraft<string>(KEY)).toBe('既有草稿');
  });

  it('🔴 組字中 flush 只存已上屏的部分', () => {
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => {
      result.current.onInput('我今天很');
      result.current.onCompositionStart();
      result.current.onInput('我今天很ㄍㄠ');
      result.current.flush();
    });
    expect(readDraft<string>(KEY)).toBe('我今天很');
  });

  it('組字結束後存完整的字', () => {
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => {
      result.current.onInput('我今天很');
      result.current.onCompositionStart();
      result.current.onInput('我今天很ㄍㄠ');
      result.current.onCompositionEnd('我今天很高');
    });
    expect(readDraft<string>(KEY)).toBe('我今天很高');
  });

  it('🔴 主動清空要把那一筆刪掉，不是寫空字串', () => {
    writeDraft(KEY, 'A');
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => {
      result.current.onInput('');
      result.current.flush();
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('🔴 key 是 null（noDraft）時一個字都不落地', () => {
    const { result } = renderHook(() => useDraftWriter(null));
    act(() => {
      result.current.onInput('sk-ant-很長的金鑰');
      result.current.flush();
    });
    expect(localStorage.length).toBe(0);
  });

  it('掛載那一次的 sync 不算「被改掉」，不會把後端載回的值鏡射進草稿', () => {
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => {
      result.current.sync('從後端載回的名字');
      result.current.flush();
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('掛載之後的 sync 要存（AI 生成填入）', () => {
    const { result } = renderHook(() => useDraftWriter(KEY));
    act(() => {
      result.current.sync('');
      result.current.sync('AI 生成的描述');
    });
    expect(readDraft<string>(KEY)).toBe('AI 生成的描述');
  });
});
