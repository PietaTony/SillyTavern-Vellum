/**
 * 生成失敗要顯示什麼。**從 `model.ts` 抽出來**——那支頂著 150 行上限（見檔頭），
 * `failureOf` 已經有自己獨立的測試檔（`__tests__/failureOf.test.ts`），
 * 是最乾淨可以整塊搬走的一塊，不影響同檔案其餘（`parseSse`／`shouldSubmitOnKey`）。
 * `src/features/chat/**` 是 glob 擁有權，這裡抽檔不會撞 gate:ownership。
 */
/**
 * 生成失敗時該顯示什麼。`setupKey` ＝ 後端說「缺金鑰」，畫面要給得出那個出口。
 * 🔴 `retryable`（跨層票 B6，2026-08-31）：只給 `api.ts` 的 `!res.ok` 早退分支用——
 * 那條路回的是整包 JSON（`server/routes/generate.ts` 的 `retryable`／`status`／`error`
 * 三個欄位），要跟 `text`／`setupKey` 一起從同一段原文解出來，不重複 parse 一次。
 */
export type ChatFailureInfo = { text: string; setupKey: boolean; retryable: boolean };

/**
 * 把後端回來的錯誤 **body 原文**翻成人看的一句話（Peter 2026-08-27 實機踩到）。
 *
 * 🔴 **他看到的是一整串 JSON**：`{"error":"尚未設定 Google Gemini 金鑰","action":"setup-…`
 * —— `api.ts` 的 `streamGenerate` 在 `!res.ok` 時直接把 `res.text()` 切 300 字丟出來，
 * 而 `server/routes/generate.ts` 回的是 `c.json({ error, action })`。
 * 「原文照顯示」這條規則是為了**不要把供應商的錯誤訊息改寫掉**，
 * 但它不該連我們自己那層 JSON 外殼一起端上去。
 *
 * 🔴 **`action: 'setup-key'` 要接成真的出口。** 使用者缺的是金鑰，
 * 而這一頁給的鈕是「重新送出上一句」—— 再送一百次也還是同一個錯。
 *
 * ⚠️ **解析不出來就原文照顯示**，不要吞掉。上游（Gemini／OpenAI）的錯誤是純文字或
 * 另一種 JSON 形狀，猜錯格式而丟掉內容，比多幾個括號糟得多。
 */
export function failureOf(raw: string): ChatFailureInfo {
  const t = raw.trim();
  if (!t) return { text: '送不出去', setupKey: false, retryable: false };
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as { error?: unknown; action?: unknown; retryable?: unknown };
      if (typeof o.error === 'string' && o.error.trim())
        return {
          text: o.error,
          setupKey: o.action === 'setup-key',
          retryable: o.retryable === true,
        };
    } catch {
      // 不是完整的 JSON（例如被 slice(300) 切掉尾巴）⇒ 落回原文。
    }
  }
  return { text: t, setupKey: false, retryable: false };
}
