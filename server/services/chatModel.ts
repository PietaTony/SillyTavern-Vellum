/**
 * 對話的資料模型。**放在 lib/ 而不是 route 裡**：渲染層與 route 都要用它，
 * 放在 route 會讓 lib 反過來 import route ——那就是循環相依（`gate:boundaries` 會擋）。
 */
import { z } from 'zod';
import { FITTINGS } from './settings.ts';

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'model']),
  text: z.string(),
  at: z.string(),
  /**
   * 同一則訊息的多個候選（開場白有 9 則）。
   * 🔴 **沒有候選的訊息不要偽造成 `[text]`** —— 那會讓「有沒有重生成過」這件事失真。
   *
   * 🔴 **開場白的候選不一定字面存在這裡**（GAP：18 段對話量到一份 33,578 bytes、
   * 只有 3 則訊息，79% 是第一則的 9 個開場白候選全文）。`greetingSwipes: true` 時
   * 這裡故意留空，候選是 `resolveSwipes()`（`lib/greetings.ts`）從 `ch.greetings`
   * 現拼的 —— 見那個欄位的註解。
   */
  swipes: z.array(z.string()).optional(),
  swipeIndex: z.number().optional(),
  /**
   * 這則訊息的候選是不是「參照」角色卡的開場白，而不是字面存一份快照。
   *
   * 🔴 **只有 `POST /chats` 建立對話當下、且該則就是第一則開場白時才會設**——
   * 那是唯一「候選＝角色卡的 `greetings`」保證成立的時刻。之後只要使用者
   * **編輯過**這則訊息的文字，就要材質化成字面 `swipes`（`chatMessages.ts` 的
   * `PATCH /:id/messages/:messageId`）：使用者的修改是他自己的版本，
   * 不該再被「角色卡之後又改了問候語」蓋掉。
   *
   * 🔴 **切候選（`PATCH .../swipe`）不材質化**——留著參照，這樣改了角色卡的問候語，
   * 舊對話還沒編輯過的候選會跟著變新（附帶好處，見 `chats.ts` 那條路由的註解）。
   * ⚠️ 這是刻意的取捨，不是沒想到反面：使用者如果**沒有**編輯過、只是切著看，
   * 角色卡問候語一改，候選內容跟著變 —— 對「這段對話被誰動過」的直覺可能是意外的，
   * 但比照「編輯過的訊息永遠不再跟著卡片變」這條規則，一致到看得懂：
   * 你動過手，才會被凍結。
   *
   * 🔴 **匯入的對話、舊資料（此欄位加入之前落的檔）一律不會有這個欄位** ⇒
   * `resolveSwipes()` 第一步永遠先看字面 `swipes` 存不存在 —— 舊檔照樣讀得起來，
   * 不需要 migration。
   */
  greetingSwipes: z.boolean().optional(),
  /**
   * 🔴 **半成品**（H1／H6 跨層票，2026-08-28）。使用者按下「停止生成」時已經吐出來的字
   * ——「半成品＝保留」（Peter 同日裁定，同 ST），但**要在資料上分得出來**，
   * 不然下一輪組 prompt（`buildTurn.ts`）會把腰斬的句子當成說完的話送出去。
   * 沒有值＝完整回覆（舊資料讀進來是 `undefined`，行為不變）。
   */
  partial: z.boolean().optional(),
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
   * 🔴 **這一間自己的縮放方式**（Peter 2026-08-26：「兩邊都要能調整縮放方式，
   * 並且縮放方式各自獨立」）。可空＝跟隨全站的 fitting。
   *
   * 🔴 六題：① `backgroundFitting: Fitting`
   * ② 在此之前 fitting **只有全域一份** ⇒ 在對話頁調它會影響所有對話，與「各自獨立」相反
   * ③ `settings.background.fitting` 是全域定義；`background` 只存檔名，答不了「這一間怎麼縮放」
   * ④ 新的可選欄位，舊對話讀進來是 `undefined` ⇒ 回退成全域，行為一個像素都不變
   * ⑤ 寫：`PATCH /api/chats/:id/background`；讀：`app/screens/AppBackground.tsx` 合成有效值
   * ⑥ 刪掉這個鍵即回退，不需要 migration
   */
  backgroundFitting: z.enum(FITTINGS).optional(),
  /**
   * 🔴 **匯入的對話，正本是那個 `.jsonl` 檔。**
   * `messages` 只是投影：實測 ST 的對話檔每一行鍵集都不同（`extra` 的子鍵 6 行 6 種），
   * 照我們的四個欄位重建會把其餘的全部丟掉。匯出一律從 `.jsonl` 重建。
   */
  source: z.string().optional(),
  /**
   * 🔴 **這一段對話的變數**（M13 第三期）。形狀照抄 ST 的 `chat_metadata.variables`。
   *
   * 六題（鐵律 #11）：
   * ① 加了 `variables?: Record<string, unknown>`。
   * ② **非加不可**：卡片腳本是**同步**讀變數的（`getVariables({type:'chat'})` 直接回物件），
   *    而我們沒有任何地方存它 ⇒ 桌寵讀不到自己的尺寸，改完下一幀就被打回預設
   *    （Peter 實機回報「調整大小沒有用」）。
   * ③ **不能用既有的**：`messages` 是對話內容、`background` 是這一間的外觀，
   *    兩者都答不了「這張卡記了什麼狀態」。
   * ④ **對既有資料的影響：零**。舊對話讀進來是 `undefined` ⇒ 卡片拿到空物件，
   *    行為與現在一模一樣。
   * ⑤ 誰讀誰寫：卡片腳本讀（經 iframe 內的同步快取）／寫走 `PATCH /api/chats/:id/variables`。
   * ⑥ 可逆：刪掉這個鍵即回退，不需要 migration。
   *
   * ⚠️ **內容完全由卡片決定，我們不解讀**（`z.unknown()`）——
   * 硬給形狀只會在下一張卡上炸掉。
   */
  variables: z.record(z.string(), z.unknown()).optional(),
});
export type Chat = z.infer<typeof ChatSchema>;
