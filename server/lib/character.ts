/**
 * 角色的資料模型。**放在 lib/ 而不是 route 裡**：匯入流程與 route 都要用它，
 * 放在 route 裡會讓 lib 反過來 import route —— 那就是循環相依（`gate:boundaries` 會擋）。
 */
import { z } from 'zod';

/** D20b：建立角色只留四欄（頭像・名稱・描述・初始訊息）。進階定義是之後的事。 */
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  firstMessage: z.string().default(''),
  avatar: z.string().default(''),
  createdAt: z.string(),
  /**
   * 好友的顯示名（D-h）。🔴 **與卡片的 `data.name` 分開**：改名永不寫回角色卡。
   * 沒有值時回退顯示 `name`（卡片原名）—— 既有資料不需要 migration。
   */
  displayName: z.string().optional(),
  /**
   * 所有開場白候選（`first_mes` ＋ `alternate_greetings`）。
   * 🔴 **以前只存 `firstMessage`，8 則額外問候在匯入時被丟掉** —— 而那張卡真正的開場頁
   * 全在額外問候裡，只留第一則等於「匯進來了但看不到內容」。
   */
  greetings: z.array(z.string()).optional(),
  /** 第 2 層 · 「跟這個好友，我是誰」。可空＝往下找全域預設。 */
  personaId: z.string().optional(),
  /**
   * P6 輸出後處理規則（從卡片的 `regex_scripts` 轉出來）。
   * 🔴 **存在這裡而不是每次去讀卡**：那張卡 6.8 MB、兩份各 3 MB base64，
   * 每開一次對話就解一次等於把讀取成本綁在每一次瀏覽上。
   */
  outputRules: z.array(z.unknown()).optional(),
  /**
   * 🔴 **匯入的卡片，正本是那個 PNG 檔，不是這份 JSON。**
   * 上面四個欄位只是投影出來給列表用的視圖；卡片本體（幾十個我們還沒實作的欄位、
   * 世界書、regex、別人的擴充資料）原樣留在 `characters/<id>.png` 的 tEXt 裡。
   * ⇒ 匯出時從那個檔重建，**不是**從這四個欄位重建。
   */
  card: z.string().optional(),
  /**
   * 從卡片抽出來的資產（桌寵貼圖之類）。
   * 🔴 **抽出來 ≠ 從卡裡刪掉**：卡內原欄位依 A1 原樣保留，這裡只是另存一份可用的。
   */
  assets: z
    .array(z.object({ path: z.string(), mime: z.string(), bytes: z.number(), from: z.string() }))
    .optional(),
});
export type Character = z.infer<typeof CharacterSchema>;
