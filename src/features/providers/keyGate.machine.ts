/**
 * 金鑰測試閘門。首次啟動的核心不變式：**未測試成功，「下一步」永遠停用。**
 *
 * 🔴 X2：本檔不得 import `api.ts`／`store.ts`。真正打供應商的動作用 `fromPromise` actor
 * 從外面注入（見 `KeyGate.tsx`），machine 本身是純資料 ⇒ 轉場可以完全離線窮舉測試。
 * 由 `gate:boundaries` 機械擋住。
 */
import { assign, fromPromise, setup } from 'xstate';

export type TestOutcome =
  | { ok: true; models: string[] }
  /** `reason` 是後端分類過的錯誤種類（見 `server/lib/providerError.ts`）。前端不自己判。 */
  | { ok: false; message: string; reason?: string | null };

export const keyGateMachine = setup({
  types: {
    context: {} as { value: string; error: string | null; models: string[] },
    events: {} as { type: 'CHANGE'; value: string } | { type: 'TEST' } | { type: 'RETRY' },
    input: {} as { provider: string },
  },
  actors: {
    // 由外部注入。machine 不知道它怎麼實作的。
    testKey: fromPromise<TestOutcome, { value: string }>(async () => ({
      ok: false,
      message: '未注入',
    })),
  },
  guards: {
    hasValue: ({ context }) => context.value.trim().length > 0,
  },
}).createMachine({
  id: 'keyGate',
  initial: 'empty',
  context: { value: '', error: null, models: [] },
  on: {
    // 任何時候改動輸入 → 回到「未測試」。已通過的結果不得沿用到新的金鑰。
    CHANGE: [
      {
        guard: ({ event }) => event.value.trim().length > 0,
        target: '.entered',
        actions: assign({ value: ({ event }) => event.value, error: null }),
      },
      { target: '.empty', actions: assign({ value: '', error: null }) },
    ],
  },
  states: {
    empty: {},
    entered: {
      on: { TEST: { target: 'testing', guard: 'hasValue' } },
    },
    testing: {
      invoke: {
        src: 'testKey',
        input: ({ context }) => ({ value: context.value }),
        onDone: [
          {
            guard: ({ event }) => event.output.ok,
            target: 'passed',
            actions: assign({
              models: ({ event }) => (event.output.ok ? event.output.models : []),
              error: null,
            }),
          },
          {
            target: 'failed',
            actions: assign({
              error: ({ event }) => (event.output.ok ? null : event.output.message),
            }),
          },
        ],
        onError: { target: 'failed', actions: assign({ error: '連不上，請檢查網路' }) },
      },
    },
    failed: {
      on: {
        RETRY: { target: 'testing', guard: 'hasValue' },
        TEST: { target: 'testing', guard: 'hasValue' },
      },
    },
    /**
     * 🔴 唯一解鎖「下一步」的狀態。
     * **刻意不是 `type: 'final'`** —— final 會讓 machine 停止接收事件，
     * 於是「測過金鑰 A → 貼上金鑰 B → 下一步仍然解鎖」，
     * 使用者會帶著一把沒測過的金鑰進下一頁。這個洞是 X4 窮舉測試抓到的。
     */
    passed: {},
  },
});
