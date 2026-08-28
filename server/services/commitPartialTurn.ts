/**
 * 使用者按下「停止生成」時的落地：把已經吐出來的字存成一則**半成品**訊息。
 * 🔴 **跨層票（H1／H6，2026-08-28）**：`applyVarUpdate.ts` 是 H6 的檔，鎖期間歸 H1，
 * 寫完歸回 H6。這支抽成獨立檔案而不是塞進 `applyVarUpdate.ts`——那支在動工前就已經
 * 卡在 150 行（`origin/staging` 量過，149 行、沒有空間），塞進去只有兩條路：把既有
 * 註解砍薄，或另開檔案。前者第一輪做過、被獨立驗收退回——那些註解記的是「為什麼」，
 * 不是「做了什麼」，砍薄了下次同一個坑就認不出來。
 *
 * 🔴 **不可以借用 `commitTurn`（同樣在 `applyVarUpdate.ts`）**。中止點不保證停在完整的
 * `<UpdateVariable>` 區塊之後——半句 `<JSONPatch>` 套下去會**靜默寫壞** `chat.variables`
 * （同一個坑家族見 `applyVarUpdate.ts` 檔頭「引擎接好了、沒有門」）。這一輪的變數留到
 * 下一次真的生成完再算（那時 `full` 是完整回覆，`commitTurn` 會照常套用）。
 * ⇒ 這裡完全不碰 `chat.variables`，只存文字。
 *
 * ⚠️ **`partial: true` 是「下一輪不可以把這句話當完整回覆」的資料指紋**——
 * 讀的一端在 `server/services/buildTurn.ts` 的 `historyTextOf`：它會在半成品的文字後面
 * 掛一句「已中止、還沒說完」的註記才送給模型，原文本身一個字都不改。
 */
import { writeJson } from '../adapters/storage.ts';

export async function commitPartialTurn(
  chatId: string,
  chat: { messages: unknown[] },
  partialText: string,
): Promise<{ id: string; role: 'model'; text: string; at: string; partial: true }> {
  const msg = {
    id: crypto.randomUUID(),
    role: 'model' as const,
    text: partialText,
    at: new Date().toISOString(),
    partial: true as const,
  };
  chat.messages.push(msg);
  await writeJson(`chats/${chatId}.json`, chat);
  return msg;
}
