import { describe, expect, it } from 'vitest';
import { explainProviderError } from '../errorHelp';

const help = (reason: string | null, id = 'anthropic') =>
  explainProviderError(reason, id, 'https://console.example.com');

/**
 * 🔴 **這裡不再測「哪些字串算額度不足」** —— 那個判準搬到後端了
 * （`server/lib/providerError.ts` ＋ `server/__tests__/providerError.test.ts`），
 * 因為分類結果會決定要不要存模型，而存檔是後端的事。
 * 前端只負責「後端說是 no-credit 的時候，要給哪一個出口」。
 */
describe('explainProviderError', () => {
  it('🔴 不可以再回「去儲值」那種文案 —— 按鈕一律是共用的「開啟」', () => {
    const r = help('no-credit');
    expect(Object.keys(r ?? {}).sort()).toEqual(['text', 'url']);
    expect(r?.text).not.toContain('去儲值');
  });

  it('對應到該家的帳單頁', () => {
    expect(help('no-credit')?.url).toBe('https://console.anthropic.com/settings/billing');
    expect(help('no-credit', 'deepseek')?.url).toBe('https://platform.deepseek.com/top_up');
  });

  it('🔴 沒有帳單頁的那幾家退回控制台網址，不可以回 undefined 讓按鈕連到空的', () => {
    expect(help('no-credit', 'cometapi')?.url).toBe('https://console.example.com');
  });

  it('不是 no-credit 就沒有出口 —— 不可以誤導他去儲值', () => {
    expect(help(null)).toBeNull();
    expect(help(undefined as unknown as null)).toBeNull();
    expect(help('something-else')).toBeNull();
  });
});

import { effectiveModel, isOffList, modelOptions } from '../modelOptions';

/**
 * 🔴 這組守的是**兩個真實看到的畫面 bug**：
 * ① Anthropic 的 registry 預設 `claude-sonnet-4-5` 不在官方清單裡 ⇒ 下拉渲染成一片空白
 * ② registry 那份會過期，不該再當「有金鑰時」的預設
 */
describe('modelOptions / effectiveModel', () => {
  const live = ['claude-opus-5', 'claude-sonnet-5'];

  it('🔴 目前的值不在清單裡也一定要出現，否則下拉是空白的', () => {
    expect(modelOptions(live, 'claude-sonnet-4-5')[0]).toBe('claude-sonnet-4-5');
    expect(isOffList(live, 'claude-sonnet-4-5')).toBe(true);
  });

  it('在清單裡就不重複塞', () => {
    expect(modelOptions(live, 'claude-opus-5')).toEqual(live);
  });

  it('沒有目前值時不塞空字串進選項', () => {
    expect(modelOptions(live, '')).toEqual(live);
  });

  it('選過的最優先', () => {
    expect(effectiveModel('claude-sonnet-5', live, 'claude-sonnet-4-5')).toBe('claude-sonnet-5');
  });

  it('🔴 沒選過就用官方清單第一個，不是 registry 那份', () => {
    expect(effectiveModel(null, live, 'claude-sonnet-4-5')).toBe('claude-opus-5');
  });

  it('連清單都拿不到（沒金鑰）才退回 registry 那份', () => {
    expect(effectiveModel(null, [], 'gpt-4o')).toBe('gpt-4o');
  });
});
