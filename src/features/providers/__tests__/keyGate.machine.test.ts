import { describe, expect, it } from 'vitest';
import { createActor, fromPromise } from 'xstate';
import { keyGateMachine, type TestOutcome } from '../keyGate.machine';

/**
 * X4：轉場窮舉測試。選 XState 換來的最大好處就是這個，不測等於白選。
 * machine 是純的（X2），所以這裡完全不碰網路。
 */
const withResult = (outcome: TestOutcome) =>
  keyGateMachine.provide({
    actors: { testKey: fromPromise<TestOutcome, { value: string }>(async () => outcome) },
  });

const start = (outcome: TestOutcome) => {
  const a = createActor(withResult(outcome), { input: { provider: 'google' } });
  a.start();
  return a;
};

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('金鑰測試閘門', () => {
  it('初始是 empty，TEST 不會有作用', () => {
    const a = start({ ok: true, models: [] });
    expect(a.getSnapshot().value).toBe('empty');
    a.send({ type: 'TEST' });
    expect(a.getSnapshot().value).toBe('empty');
  });

  it('空字串不會離開 empty', () => {
    const a = start({ ok: true, models: [] });
    a.send({ type: 'CHANGE', value: '   ' });
    expect(a.getSnapshot().value).toBe('empty');
  });

  it('測試成功才會到 passed', async () => {
    const a = start({ ok: true, models: ['gemini-3.1-flash-lite'] });
    a.send({ type: 'CHANGE', value: 'AIzaXXXX' });
    expect(a.getSnapshot().value).toBe('entered');
    a.send({ type: 'TEST' });
    await settle();
    expect(a.getSnapshot().value).toBe('passed');
    expect(a.getSnapshot().context.models).toEqual(['gemini-3.1-flash-lite']);
  });

  it('測試失敗留在 failed 並帶錯誤訊息，可以重試', async () => {
    const a = start({ ok: false, message: 'API key not valid' });
    a.send({ type: 'CHANGE', value: 'bad' });
    a.send({ type: 'TEST' });
    await settle();
    expect(a.getSnapshot().value).toBe('failed');
    expect(a.getSnapshot().context.error).toBe('API key not valid');
    a.send({ type: 'RETRY' });
    expect(a.getSnapshot().value).toBe('testing');
  });

  it('🔴 通過之後改動金鑰，必須回到未測試 —— 舊結果不得沿用', async () => {
    const a = start({ ok: true, models: [] });
    a.send({ type: 'CHANGE', value: 'AIzaGOOD' });
    a.send({ type: 'TEST' });
    await settle();
    expect(a.getSnapshot().value).toBe('passed');
    a.send({ type: 'CHANGE', value: 'AIzaOTHER' });
    expect(a.getSnapshot().value).not.toBe('passed');
  });

  it('failed 之後改動金鑰會回到 entered，不是卡在 failed', async () => {
    const a = start({ ok: false, message: 'x' });
    a.send({ type: 'CHANGE', value: 'bad' });
    a.send({ type: 'TEST' });
    await settle();
    expect(a.getSnapshot().value).toBe('failed');
    a.send({ type: 'CHANGE', value: 'AIzaNEW' });
    expect(a.getSnapshot().value).toBe('entered');
    expect(a.getSnapshot().context.error).toBeNull();
  });
});
