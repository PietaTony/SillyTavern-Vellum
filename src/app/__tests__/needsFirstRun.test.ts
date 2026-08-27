import { describe, expect, it } from 'vitest';
import { needsFirstRun } from '../setup';

/**
 * 🔴 Peter 2026-08-27：「理論上 first run 必跑，沒跑過不能路由亂跑。」
 *
 * 🔴 **最危險的那一條是「`/first-run/*` 自己要放行」** ——
 * 漏掉的話守衛會把首次流程導向首次流程，整個 app 在第一次啟動時就是白畫面。
 * 那是一個**只有全新安裝才會出現**的當機，開發機上永遠測不到。
 */
describe('needsFirstRun', () => {
  it('還沒設定 ⇒ 任何一般網址都要踢回首次流程', () => {
    for (const p of ['/chat-list', '/worlds', '/settings', '/chat/abc', '/profile', '/']) {
      expect(needsFirstRun(p, false)).toBe(true);
    }
  });

  it('🔴 首次流程自己一定要放行，否則無限重導', () => {
    for (const p of ['/first-run', '/first-run/provider', '/first-run/key', '/first-run/']) {
      expect(needsFirstRun(p, false)).toBe(false);
    }
  });

  it('設定完成之後哪裡都能去（首次流程那一段由它自己的守衛擋）', () => {
    for (const p of ['/chat-list', '/worlds', '/first-run/provider']) {
      expect(needsFirstRun(p, true)).toBe(false);
    }
  });
});
