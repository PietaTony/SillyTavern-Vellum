import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { readDraft, writeDraft } from '@/shared/lib/draftStore';
import { DraftField } from '../DraftField';

const KEY = 'vellum.draft.test.field';

/** 受控的宿主 —— 真實用法就是這樣：父層拿 state，`DraftField` 負責存。 */
function Host({ initial = '', draftKey = KEY }: { initial?: string; draftKey?: string }) {
  const [v, setV] = useState(initial);
  return <DraftField draftKey={draftKey} label="測試" value={v} onChange={setV} />;
}

const input = () => screen.getByLabelText('測試') as HTMLInputElement;
const hide = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
};

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('DraftField', () => {
  /**
   * 驗收 A7 的**端到端**部分：打完字切背景，最後一個字要在。
   *
   * 🔴 **但這一條分辨不出 ref 有沒有同步寫。** 實測：把 `onInput` 的 ref 寫入拿掉，
   * 這條照樣通過 —— 因為 React 在事件派送結束時就把 `sync` effect flush 了，
   * ref 被補正。**它測到的是 effect，不是 ref。**
   * ⇒ ref 那條保證由 `useDraftWriter.test.ts` 在單元層釘住（那裡故意不呼叫 `sync`）。
   * 兩條都要有：這條守「使用者看到的結果」，那條守「為什麼結果會對」。
   */
  it('A7 打字後切背景，最後一個字有存到（端到端）', () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: '我今天很' } });
    fireEvent.change(input(), { target: { value: '我今天很好' } });
    hide();
    expect(readDraft<string>(KEY)).toBe('我今天很好');
  });

  /** 驗收 A3 的另外兩個時機。 */
  it('A3 pagehide 也會寫入', () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: 'abc' } });
    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(readDraft<string>(KEY)).toBe('abc');
  });

  it('A3 blur 也會寫入', () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: 'abc' } });
    fireEvent.blur(input());
    expect(readDraft<string>(KEY)).toBe('abc');
  });

  /**
   * 🔴 **驗收 A8。** 存到半形注音會還原成「我今天很ㄍㄠ」——那是死文字，
   * 無法繼續組字，使用者只能刪掉重打。**存了比沒存更糟。**
   */
  it('🔴 A8 組字中只存已上屏的部分，不存注音', () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: '我今天很' } });
    fireEvent.compositionStart(input());
    // 組字中：輸入框的值含未上屏的注音
    fireEvent.change(input(), { target: { value: '我今天很ㄍㄠ' } });
    hide();
    expect(readDraft<string>(KEY)).toBe('我今天很');
  });

  it('A8 組字結束之後存的是完整的字', () => {
    render(<Host />);
    fireEvent.change(input(), { target: { value: '我今天很' } });
    fireEvent.compositionStart(input());
    fireEvent.change(input(), { target: { value: '我今天很ㄍㄠ' } });
    fireEvent.compositionEnd(input(), { target: { value: '我今天很高' } });
    expect(readDraft<string>(KEY)).toBe('我今天很高');
  });

  /**
   * 🔴 **驗收 A5。** 送出失敗留下草稿「A」→ 使用者手動刪到全空 → 重開 →
   * 「A」不可以跑回來。空字串是**主動清空**，不是「沒有草稿」。
   */
  it('🔴 A5 主動清空會把 localStorage 那一筆刪掉，不會被舊草稿倒灌', () => {
    writeDraft(KEY, 'A');
    render(<Host initial="A" />);
    fireEvent.change(input(), { target: { value: '' } });
    hide();
    expect(readDraft(KEY)).toBeNull();
  });

  it('沒動過就不寫 —— 第一次載入不會把空值蓋回既有草稿', () => {
    writeDraft(KEY, '既有草稿');
    render(<Host initial="既有草稿" />);
    hide();
    expect(readDraft<string>(KEY)).toBe('既有草稿');
  });

  it('🔴 掛載之後被外部改掉（AI 生成填入）也要存 —— 那一欄花了一次 API 呼叫', () => {
    function Outer() {
      const [v, setV] = useState('');
      return (
        <>
          <DraftField draftKey={KEY} label="測試" value={v} onChange={setV} />
          <button type="button" onClick={() => setV('AI 生成的描述')}>
            生成
          </button>
        </>
      );
    }
    render(<Outer />);
    fireEvent.click(screen.getByText('生成'));
    expect(readDraft<string>(KEY)).toBe('AI 生成的描述');
  });

  it('🔴 noDraft 的欄位一個字都不落地（金鑰）', () => {
    function Secret() {
      const [v, setV] = useState('');
      return <DraftField noDraft="金鑰不落地" label="測試" value={v} onChange={setV} />;
    }
    render(<Secret />);
    fireEvent.change(input(), { target: { value: 'sk-ant-很長的金鑰' } });
    hide();
    expect(localStorage.length).toBe(0);
  });
});
