import { useMachine } from '@xstate/react';
import { fromPromise } from 'xstate';
import { Button } from '@/shared/ui/Button';
import { Screen } from '@/shared/ui/Screen';
import { testKey } from '../api';
import { keyGateMachine, type TestOutcome } from '../keyGate.machine';
import { applyMaskedEdit, maskKey, type ProviderInfo } from '../model';

/**
 * `First-Run--3 / --3a / --3b / --3c` —— 四個狀態共用一份版面。
 * markup 逐字抄自設計正本：`v-guide-step`（`__num` ＋ `__text`）／`v-inline-code`／`v-field v-field--block`。
 *
 * 🔴 不變式：**未測試成功，「下一步」永遠停用**，由 machine 保證不是靠 UI 自律。
 * 🔴 版面：**「下一步」在捲動區外的固定 footer**（正本原文：三層結構是刻意的）。
 * X2：打供應商的動作用 `fromPromise` 從外面注入，machine 本身不知道 api 存在。
 */
export function KeyGate({
  info,
  onBack,
  onPassed,
}: {
  info: ProviderInfo;
  onBack: () => void;
  onPassed: () => void;
}) {
  const [state, send] = useMachine(
    keyGateMachine.provide({
      actors: {
        testKey: fromPromise<TestOutcome, { value: string }>(async ({ input }) => {
          const r = await testKey(info.id, input.value);
          return r.ok ? { ok: true, models: r.models } : { ok: false, message: r.message };
        }),
      },
    }),
    { input: { provider: info.id } },
  );

  const testing = state.matches('testing');
  const passed = state.matches('passed');
  const { value } = state.context;

  return (
    <Screen
      title={`取得 ${info.name} 金鑰`}
      onBack={onBack}
      footer={
        <div className="vx-footerbar">
          {!passed ? <div className="v-hint">測試成功之前，「下一步」是停用的。</div> : null}
          <Button disabled={!passed} onClick={onPassed}>
            下一步 → 加入好友
          </Button>
        </div>
      }
    >
      {info.steps.map((s, i) => (
        <div className="v-guide-step" key={s}>
          <div className="v-guide-step__num">{i + 1}</div>
          <div className="v-guide-step__text">
            {s}
            {i === 0 ? (
              <>
                {' '}
                <a
                  className="v-btn v-btn--secondary"
                  href={info.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  開啟
                </a>
              </>
            ) : null}
          </div>
        </div>
      ))}

      <input
        className="v-field v-field--block"
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={`貼上金鑰（${info.keyHint}）`}
        aria-label="API 金鑰"
        // 🔴 **輸入當下就遮罩**，永遠只露前四後四。真值在 machine 的 context 裡。
        value={maskKey(value)}
        onChange={(e) =>
          send({ type: 'CHANGE', value: applyMaskedEdit(value, maskKey(value), e.target.value) })
        }
      />

      <Button
        variant="secondary"
        disabled={testing || !value.trim()}
        onClick={() => send({ type: 'TEST' })}
      >
        {testing ? '測試中⋯' : '測試連線'}
      </Button>

      {passed ? (
        <div className="v-alert">
          <div className="v-alert__title">✓ 連線成功</div>
          {state.context.models.length} 個模型可用
        </div>
      ) : null}
      {state.matches('failed') ? (
        <div className="v-alert v-alert--warning">
          <div className="v-alert__title">✕ 測試沒有通過</div>
          {state.context.error}
        </div>
      ) : null}
    </Screen>
  );
}
