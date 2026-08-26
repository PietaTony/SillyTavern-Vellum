import { describe, expect, it } from 'vitest';
import { classifyProviderError } from '../lib/providerError.ts';

/**
 * 🔴 這支守的是「額度不足要認得出來」，而那個結果會決定**要不要把模型存下來**
 * （Peter 2026-08-26：「儘管額度不足，使用者切換模型也是要存下來」）。
 * 認不出來 ⇒ 使用者選的模型被丟掉，而且他不知道為什麼。
 */
describe('classifyProviderError', () => {
  it('Anthropic 的原文（Peter 2026-08-26 實際遇到的那一句）', () => {
    expect(
      classifyProviderError(
        '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}',
      ),
    ).toBe('no-credit');
  });

  it('OpenAI 的說法', () => {
    expect(classifyProviderError('You exceeded your current quota')).toBe('no-credit');
  });

  it('DeepSeek 的說法', () => {
    expect(classifyProviderError('Insufficient Balance')).toBe('no-credit');
  });

  it('中文的說法也要接住', () => {
    expect(classifyProviderError('账户余额不足，请充值')).toBe('no-credit');
  });

  it('🔴 金鑰錯誤不是額度問題 —— 誤判會存下一個打不通的模型', () => {
    expect(classifyProviderError('Incorrect API key provided: sk-not-a****ting')).toBeNull();
  });

  it('🔴 模型不存在也不是額度問題', () => {
    expect(
      classifyProviderError('models/gemini-2.5-flash is not found for API version v1beta'),
    ).toBeNull();
  });

  it('空字串不算命中', () => {
    expect(classifyProviderError('')).toBeNull();
  });
});
