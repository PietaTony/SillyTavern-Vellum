import { useCallback, useEffect, useMemo, useRef } from 'react';
import { clearDraft, writeDraft } from './draftStore';

/**
 * 草稿的**寫入側**：三個同步時機 ＋ IME ＋ 主動清空。只給 `<DraftField>` 用。
 *
 * 🔴 **讀取側刻意不在這裡。** 還原要在父層的 `useState` initializer 同步做完——
 * 兩個欄位若各自在 mount effect 裡呼叫 `onChange({...value, x})`，
 * 它們看到的是同一份 `value`，**第二個會蓋掉第一個**。同步初始化沒有這個競態。
 *
 * 🔴 **一律讀 `ref` 不讀 state**（複檢 F1）：三個事件的 listener 抓到的是上一次 render
 * 的閉包，直接讀 state 會**永遠少存最後一個字**。事件有掛、也真的觸發了，
 * 但存進去是舊值 —— 那種壞法看起來跟正常一模一樣。
 */
export type DraftWriter = {
  onInput: (next: string) => void;
  sync: (next: string) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (next: string) => void;
  flush: () => void;
};

export function useDraftWriter(key: string | null): DraftWriter {
  /** 畫面上真正的值。`onChange` 當下同步更新，不等 React commit。 */
  const valueRef = useRef('');
  /** IME 組字開始前「已上屏」的值。組字中只准存這個。 */
  const committedRef = useRef('');
  const composingRef = useRef(false);
  /** 使用者（或程式）動過沒有。沒動過就不寫，避免第一次載入把空值蓋回去。 */
  const dirtyRef = useRef(false);
  /** 第一次 `sync` 是掛載，不是「值被改掉」。 */
  const mountedRef = useRef(false);

  const flush = useCallback(() => {
    if (key === null || !dirtyRef.current) return;
    // 🔴 組字中存的是**已上屏的部分**，不是 `input.value`。存到半形注音會還原成
    // 「我今天很ㄍㄠ」——那是死文字，無法繼續組字，使用者只能刪掉重打。
    // **存了比沒存更糟**（複檢 F5 推翻了原本的「寧可存到半形注音」）。
    const v = composingRef.current ? committedRef.current : valueRef.current;
    // 🔴 空字串是「使用者主動清空」，不是「沒有草稿」。要**強制刪掉**那一筆，
    // 否則送出失敗留下的舊值下次會被倒灌回來（複檢 F2）。
    if (v === '') clearDraft(key);
    else writeDraft(key, v);
  }, [key]);

  // 兩個「即將被殺」的時機各同步寫一次，不等 effect。
  // `visibilitychange` 是 iOS 上最早、最可靠的訊號；`pagehide` 比 `beforeunload` 可靠
  //（Safari 對 `beforeunload` 支援不完整）。第三個時機 `blur` 由元件接在 `onBlur`。
  useEffect(() => {
    if (key === null) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [key, flush]);

  // 🔴 回傳的物件必須穩定：呼叫端會把它放進 effect 的相依陣列，
  // 每次 render 都新建會讓那個 effect 無限跑。
  return useMemo(
    () => ({
      /** 每次輸入都要呼叫——**同步**更新 ref，然後才輪到 React state。 */
      onInput(next: string) {
        valueRef.current = next;
        if (!composingRef.current) committedRef.current = next;
        dirtyRef.current = true;
      },
      /**
       * 父層的值被外部換掉時同步過來（AI 生成填入、匯入卡片、從後端載回）。
       * 🔴 **掛載那一次不算「被改掉」**，不然任何從後端載回的值都會被鏡射進草稿。
       * 掛載之後的外部變更則要存 —— AI 生成填好的三欄花了一次 API 呼叫，掉了很痛。
       */
      sync(next: string) {
        const first = !mountedRef.current;
        mountedRef.current = true;
        if (valueRef.current === next) return;
        valueRef.current = next;
        if (!composingRef.current) committedRef.current = next;
        if (!first) {
          dirtyRef.current = true;
          flush();
        }
      },
      onCompositionStart() {
        composingRef.current = true;
        // 記下當下（＝已上屏）的值，組字期間就寫它。
        committedRef.current = valueRef.current;
      },
      onCompositionEnd(next: string) {
        composingRef.current = false;
        valueRef.current = next;
        committedRef.current = next;
        dirtyRef.current = true;
        flush();
      },
      flush,
    }),
    [flush],
  );
}
