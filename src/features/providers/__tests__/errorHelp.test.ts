import { describe, expect, it } from 'vitest';
import { explainProviderError } from '../errorHelp';

const help = (raw: string, id = 'anthropic') =>
  explainProviderError(raw, id, 'https://console.example.com');

/**
 * 🔴 這支守的是「最常見的錯誤要有出口」。
 * 判準刻意寬鬆：**漏判**會讓使用者卡在一句英文錯誤訊息前面，
 * **誤判**只是他點過去發現餘額還夠 —— 兩者代價不對稱。
 */
describe('explainProviderError', () => {
  it('🔴 不可以再回「去儲值」那種文案 —— 按鈕一律是共用的「開啟」', () => {
    const r = help('Your credit balance is too low');
    expect(r).toBeTruthy();
    expect(Object.keys(r ?? {}).sort()).toEqual(['text', 'url']);
    expect(r?.text).not.toContain('去儲值');
  });

  it('Anthropic 的原文（Peter 2026-08-26 實際遇到的那一句）', () => {
    const r = help(
      '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
    );
    expect(r?.url).toBe('https://console.anthropic.com/settings/billing');
  });

  it('OpenAI 的說法', () => {
    expect(help('You exceeded your current quota, please check your plan', 'openai')).toBeTruthy();
  });

  it('DeepSeek 的說法', () => {
    expect(help('Insufficient Balance', 'deepseek')?.url).toBe(
      'https://platform.deepseek.com/top_up',
    );
  });

  it('中文的說法也要接住', () => {
    expect(help('账户余额不足，请充值', 'siliconflow')).toBeTruthy();
  });

  it('🔴 沒有帳單頁的那幾家退回控制台網址，不可以回 undefined 讓按鈕連到空的', () => {
    expect(help('Insufficient credits', 'cometapi')?.url).toBe('https://console.example.com');
  });

  it('金鑰錯誤不是餘額問題 —— 不可以誤導他去儲值', () => {
    expect(help('Incorrect API key provided: sk-not-a****ting')).toBeNull();
  });

  it('模型不存在也不是餘額問題', () => {
    expect(help('models/gemini-2.5-flash is not found for API version v1beta')).toBeNull();
  });

  it('空字串不算命中', () => {
    expect(help('')).toBeNull();
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
