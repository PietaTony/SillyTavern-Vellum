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
   * 最後一次就地修改的時間。**樂觀鎖用的**（GAP-71）。
   *
   * 🔴 六題：① `updatedAt: ISO 字串` ② `PATCH` 是 read-modify-write **而且無鎖** ——
   * 「加入好友頁按送出」與「對話頁角色層按儲存」同時發生就會**丟掉其中一次寫入**，
   * 而且沒有任何跡象。③ 沒有既有欄位能表達「我讀到的是哪一版」。
   * ④ 新的可選欄位，舊資料是 `undefined` ⇒ **視為「不檢查」**，行為與現在完全相同。
   * ⑤ 寫：`characterEdit.ts`；讀：同一支（比對呼叫端送來的 `ifUnmodifiedSince`）。
   * ⑥ 刪掉這個鍵即回退，不需要 migration。
   */
  updatedAt: z.string().optional(),
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
  /**
   * 🔴 **卡片自帶腳本的「盤點結果」，不是腳本內容**（M13 第二期）。
   * 內容留在 PNG 裡（那張卡是 2 MB），塞進這份 JSON 會拖垮每一次角色列表。
   * 這裡只存「有幾支、多大、會不會去外面抓 code、內容指紋」——
   * 同意視窗要問使用者的東西全在這裡。見 `lib/cardScripts.ts` 檔頭。
   */
  cardScripts: z
    .object({
      scripts: z.array(
        z.object({
          name: z.string(),
          enabled: z.boolean(),
          bytes: z.number(),
          externals: z.array(z.string()),
          /** 🔴 2026-08-26 新增。**舊資料沒有這欄 ⇒ 讀到就重算**（見 `routes/characterScripts.ts`）。 */
          kind: z.enum(['script', 'interface']).optional(),
        }),
      ),
      hash: z.string(),
    })
    .optional(),
  /**
   * 🔴 **「我同意執行這張卡的腳本」——綁在版本上，不是綁在卡片上。**
   * `hash` 是盤點時算的內容指紋：卡片更新後指紋會變 ⇒ 重新詢問（供應鏈防線）。
   * `externals` 是同意當下那些外連網域（Peter 2026-08-26 裁「乙」）——
   * ⚠️ 指紋**蓋不到 CDN**：卡片寫 `import 'https://…'`，那份 code 在對方手上隨時會變。
   *    所以外連要另外記、另外問。
   */
  scriptsConsent: z
    .object({ hash: z.string(), externals: z.array(z.string()), at: z.string() })
    .optional(),
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
