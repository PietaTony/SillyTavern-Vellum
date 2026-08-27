import { describe, expect, it } from 'vitest';
import { buildReport, type ReportEnv } from '../report';

/**
 * 回報單（Peter 2026-08-27：「我會希望他們有辦法回報東西給我，任何東西」）。
 *
 * 🔴 **這支最重要的一條是「裡面不可以有秘密」。** 回報單的用途就是被貼到
 * LINE／Discord／issue 上 —— 一旦有人往裡面塞了金鑰或對話內容，
 * 那不是我們的 bug，是使用者的資料外洩。所以用測試把邊界釘死。
 */
const env: ReportEnv = {
  at: '2026-08-27 18:25:31',
  where: '/chat/abc',
  how: '透過 Tailscale',
  device: 'Mozilla/5.0 (iPhone)',
  viewport: '390×844',
  version: '0.2.3',
};

describe('buildReport', () => {
  it('機器那半邊的欄位都要在 —— 這些正是使用者描述不出來的東西', () => {
    const r = buildReport({}, env);
    for (const v of Object.values(env)) expect(r).toContain(v);
  });

  it('🔴 最後要留一行請他補一句 —— 只有機器欄位的回報還要再問一輪', () => {
    expect(buildReport({}, env)).toContain('你剛剛在做什麼');
  });

  it('錯誤原文有就印，沒有就不要印一行空的', () => {
    expect(buildReport({ what: 'HTTP 502' }, env)).toContain('出了什麼事：HTTP 502');
    expect(buildReport({ what: '   ' }, env)).not.toContain('出了什麼事');
    expect(buildReport({}, env)).not.toContain('出了什麼事');
  });

  it('extra 的空值不佔一行 —— 「對話：」後面沒東西只會讓人以為漏了', () => {
    const r = buildReport({ extra: { 對話: '', 供應商: 'google' } }, env);
    expect(r).not.toContain('對話：');
    expect(r).toContain('供應商：google');
  });

  it('🔴 欄位就是這幾個，不會自己長出別的 —— 這張單會被貼到公開的地方', () => {
    const r = buildReport({ what: 'HTTP 502', extra: { 對話: 'abc' } }, env);
    const labels = r
      .split('\n')
      .map((l) => /^([^：（]+)：/.exec(l)?.[1])
      .filter((x): x is string => Boolean(x));
    // 金鑰、對話內容這類東西被擋在外面的方式，就是「呼叫端沒給就不存在」
    expect(labels).toEqual(['時間', '版本', '畫面', '連線', '裝置', '視窗', '出了什麼事', '對話']);
  });
});
