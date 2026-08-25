import { useMachine } from '@xstate/react';
import { fromPromise } from 'xstate';
import { Button } from '@/shared/ui/Button';
import { testKey } from '../api';
import { keyGateMachine, type TestOutcome } from '../keyGate.machine';
import type { ProviderInfo } from '../model';
import styles from './KeyGate.module.css';

/**
 * 金鑰頁的四個狀態共用這一份版面（`First-Run--3 / --3a / --3b / --3c`）。
 * 🔴 不變式：**未測試成功，「下一步」永遠停用。** 由 machine 保證，不是由 UI 自律。
 * X2：真正打供應商的動作在這裡用 `fromPromise` 注入，machine 本身不知道 api 存在。
 */
export function KeyGate({ info, onPassed }: { info: ProviderInfo; onPassed: () => void }) {
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

  return (
    <>
      <ol className={styles.steps}>
        {info.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <a className={styles.link} href={info.consoleUrl} target="_blank" rel="noreferrer">
        開啟 {new URL(info.consoleUrl).host} ↗
      </a>

      <input
        className={styles.field}
        style={{ marginTop: 'var(--sp-4, 16px)' }}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={`貼上金鑰（${info.keyHint}）`}
        aria-label="API 金鑰"
        value={state.context.value}
        onChange={(e) => send({ type: 'CHANGE', value: e.target.value })}
      />

      <div className={styles.row}>
        <Button
          variant="secondary"
          disabled={testing || !state.context.value.trim()}
          onClick={() => send({ type: 'TEST' })}
        >
          {testing ? '測試中⋯' : '測試連線'}
        </Button>
      </div>

      {passed ? (
        <p className={`${styles.status} ${styles.ok}`}>
          ✓ 連線成功，{state.context.models.length} 個模型可用
        </p>
      ) : null}
      {state.matches('failed') ? (
        <p className={`${styles.status} ${styles.bad}`}>✕ {state.context.error}</p>
      ) : null}
      {!passed && !state.matches('failed') ? (
        <p className={styles.status}>測試成功之前，「下一步」是停用的。</p>
      ) : null}

      <div className={styles.row}>
        <Button disabled={!passed} onClick={onPassed}>
          下一步 → 加入好友
        </Button>
      </div>
    </>
  );
}
