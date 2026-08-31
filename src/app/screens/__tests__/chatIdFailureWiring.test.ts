import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 補中控線漏列的那格鎖之後的最後一段（跨層票 B6，2026-08-31，Peter 補簽「乙」）：
 * `route → $chatId.tsx → ChatFailure`。
 *
 * 🔴 **為什麼是原始碼比對，不是完整渲染測試**：試過用真的 `render(<ChatPage/>)`
 * 走完整條路——擋在 `vite.config.ts` 的 `tanstackRouter({ autoCodeSplitting:
 * true })`：`createFileRoute(...)({component: ChatPage})` 被轉成 `React.lazy`，
 * vitest 環境下卡在真的 Suspense（實測：`await import('../$chatId')` 直接讀不到
 * 元件，改成具名 export 繞過去雖然測試會過，但 `pnpm exec vite build` 量出來
 * `_chatId` 那個獨立 chunk（246 kB／gzip 89 kB）整包消失、`index` 主檔從
 * gzip 164.7 kB 灌到 234.3 kB、還冒出「chunks larger than 500 kB」警告——
 * 對話頁是全站點最多次的路由，**為了測試讓它失去自己的 lazy chunk 不划算**，
 * 所以退回這支：直接讀原始碼，斷言接線的**形狀**還在。
 *
 * 🔴 **這支守的是「有沒有整份展開」，不是「值算對了」**（後者 `useChatStream.test.tsx`
 * 的 `retry`／`failureBanner` 測試組、`ChatFailure.test.tsx` 的按鈕顯隱測試組已經
 * 用真的行為守過，見那兩支檔頭）。這裡守的是第三段：`$chatId.tsx` 真的把
 * `useChatStream()` 算出來的 `failureBanner` 整包（`{...failureBanner}`）交給
 * `<ChatFailure>`，不是隨手接一個子集合把 `retryable`／`onRetry` 漏在半路
 * ——那正是這輪跨層票起初漏掉的那個洞（`ChatFailure` 只收得到 `message`）。
 */
const SRC = readFileSync(
  join(process.cwd(), 'src', 'app', 'routes', 'chat', '$chatId.tsx'),
  'utf8',
);

describe('$chatId.tsx → ChatFailure 的接線（跨層票 B6）', () => {
  it('🔴 useChatStream() 解構要拿到 failureBanner——沒解構到，畫面上永遠是 null', () => {
    expect(SRC).toMatch(/failureBanner/);
    // 突變證明：把這行改回舊的九個欄位（failure／failureRetryable／setFailure／retry），
    // 這個正則就抓不到「解構出 failureBanner」這件事——見下面 replace 那個自我驗證。
    const destructureLine = SRC.match(/const \{[^}]*\} =\s*\n?\s*useChatStream\(/)?.[0] ?? '';
    expect(destructureLine).toContain('failureBanner');
  });

  it('🔴 ChatFailure 收到的是整包 {...failureBanner}，不是手動接的子集合', () => {
    // 這是這輪票起初漏掉的那個洞的精確形狀：手動列 message／onDismiss、漏掉
    // retryable／onRetry，型別還過得了關（兩個都是 optional prop）——只有
    // 這支測試守得住「有沒有整包展開」。
    expect(SRC).toMatch(/<ChatFailure\s*\{\.\.\.failureBanner\}\s*\/>/);
  });
});
