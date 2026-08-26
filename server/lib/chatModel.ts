/**
 * 對話的資料模型。**放在 lib/ 而不是 route 裡**：渲染層與 route 都要用它，
 * 放在 route 會讓 lib 反過來 import route ——那就是循環相依（`gate:boundaries` 會擋）。
 */
import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'model']),
  text: z.string(),
  at: z.string(),
  /**
   * 同一則訊息的多個候選（開場白有 9 則）。
   * 🔴 **沒有候選的訊息不要偽造成 `[text]`** —— 那會讓「有沒有重生成過」這件事失真。
   */
  swipes: z.array(z.string()).optional(),
  swipeIndex: z.number().optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ChatSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  characterName: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.string(),
  /** 第 1 層 · 這一段對話的 persona（優先序最高）。可空＝往下找好友層。 */
  personaId: z.string().optional(),
  /**
   * 🔴 **這一段對話自己的背景**（`backgrounds/` 底下的檔名）。有值就蓋過全域。
   * 形狀照抄 ST 的 `chat_metadata.custom_background`（實查 `backgrounds.js:14`）。
   * 可空＝跟隨全域，**不要用空字串代表「沒有」** —— 那會分不出「沒設過」與「設成無背景」。
   */
  background: z.string().optional(),
  /**
   * 🔴 **匯入的對話，正本是那個 `.jsonl` 檔。**
   * `messages` 只是投影：實測 ST 的對話檔每一行鍵集都不同（`extra` 的子鍵 6 行 6 種），
   * 照我們的四個欄位重建會把其餘的全部丟掉。匯出一律從 `.jsonl` 重建。
   */
  source: z.string().optional(),
});
export type Chat = z.infer<typeof ChatSchema>;
