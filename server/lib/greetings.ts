/**
 * 開場白的編號規則。**抽成一支的理由是它被重複實作過**（M12 G9）：
 * 前端 `src/features/characters/model.ts` 的 `alternatesOf()` 與
 * `server/routes/characters.ts` 各自寫了同一條判準式，兩邊要一起改才不會分岔。
 * 🔴 前後端**不能共用同一支模組**（兩棵樹、兩套 import 慣例），
 * 所以做法是「一邊一支純函式，各自有測試，檔頭互相指名」——
 * 不是假裝共用，而是讓分岔在改動時看得見。
 * 對應的前端那支：`src/features/characters/model.ts` 的 `alternatesOf()`。
 */

/**
 * 把「含第一則問候的完整清單」換算成**額外問候語那一層的編號**（GAP-67）。
 *
 * 回傳與輸入等長的陣列：`null` ＝ 這則就是原本的開場；數字 ＝ 額外問候語的第 N 則（1 起算）。
 *
 * 🔴 **不可以無條件假設 `greetings[0]` 就是第一則問候。**
 * `importCard.ts:81` 匯入時會濾掉空白 ⇒ 空 `first_mes` 的卡，
 * `greetings[0]` 其實是**第一則額外問候**。判準是「第一則是不是真的等於 `firstMessage`」，
 * **不是位置**（同前端 `alternatesOf`；這條踩過一次資料損毀，見 M11 ⑨ B1）。
 */
export function altNumbering(all: string[], firstMessage: string): (number | null)[] {
  const firstIsIntro = all[0] === firstMessage;
  return all.map((_g, i) => (firstIsIntro ? (i === 0 ? null : i) : i + 1));
}

/**
 * 這次切換的候選，**算不算角色的開場白**？算就回**生的**那一則（帶 `<!-- lore -->`）。
 *
 * 🔴 **兩個條件都要成立：是第一則 ＋ 內容真的對得上。**（敵意審查 2026-08-26 B2）
 * `msg.swipes` 與 `ch.greetings` 是**兩份資料**，index 對得上只是碰巧：
 *   · **匯入的 ST 對話** —— 候選來自別人的檔案，與這個角色的 `greetings` 無關。
 *   · **建完對話之後改過問候語** —— 對話存的是建立當下的快照。
 *   · **空 `first_mes` 的卡** —— `importCard.ts:81` 濾空白會讓兩邊平移一格。
 * 對錯的後果不是顯示錯：`applyGreetingLore` **會寫 `worlds/<id>.json`** ⇒
 * 世界書被開錯／關錯，之後每次生成的 prompt 都被污染，而畫面上完全看不出來。
 *
 * 🔴 **尺的兩端要同一個單位。**（UI 線 2026-08-27 實測抓到，兩個 bug 疊在一起）
 * 對話存的候選是**剝過的**（`chats.ts` 的 `greetings.map(stripLoreTags)`），
 * `greetings[idx]` 是**生的** ⇒ 直接比**永遠 false**，
 * 「切開場會重算世界書」從來沒有發生過。而且就算比對修好，
 * `applyGreetingLore` 靠 `extractLoreTags()` 讀註解，餵剝過的進去一樣回 `null`。
 * ⇒ **比對用剝過的，回傳用生的。** 兩件事一起做才會動。
 *
 * ⚠️ 收 `strip` 當參數而不是直接 import `stripLoreTags`：這支要留在「純判準」這一層，
 * 而且測試可以塞一個假的 strip 來證明「它真的有剝過再比」。
 */
export function greetingForSwipe(
  args: {
    /** 對話第一則的 id。`undefined` ＝ 這段對話沒有訊息。 */
    firstMessageId: string | undefined;
    /** 正在切換的那一則的 id。 */
    messageId: string;
    /** 角色的開場白清單（**生的**）。 */
    greetings: string[] | undefined;
    index: number;
    /** 對話裡存著的那一則候選（**剝過的**）。 */
    target: string | undefined;
  },
  strip: (s: string) => string,
): string | undefined {
  const { firstMessageId, messageId, greetings, index, target } = args;
  if (firstMessageId !== messageId) return undefined;
  const raw = greetings?.[index];
  if (raw === undefined || target === undefined) return undefined;
  return strip(raw) === target ? raw : undefined;
}

/**
 * 把一則訊息的候選**展開回完整字串陣列**。
 *
 * 🔴 **兩種來源，判準看字面 `swipes` 存不存在**（`chatModel.ts` 的 `greetingSwipes`
 * 欄位頭有完整理由）：
 *   · **字面（快照）**——舊資料、匯入的對話、使用者編輯過的訊息。原樣回傳。
 *   · **參照**（`msg.greetingSwipes === true` 且沒有字面 `swipes`）——
 *     這則訊息就是角色卡的開場白，候選**現在**從 `ch.greetings` 剝過再拼，
 *     不是建立對話那一刻存的快照。角色卡的問候語之後被改了，這裡會跟著變
 *     （這是刻意的附帶好處，不是 bug —— 見呼叫端 `chats.ts` 的註解）。
 *
 * 找不到來源（沒有字面 `swipes`、也沒有 `ch.greetings` 可用——例如角色被刪了、
 * 或角色重新匯入後 `greetings` 是空的）就回 `undefined`：**呼叫端要能處理
 * 「這則訊息其實沒有候選」，不要偽造一個空陣列或單元素陣列。**
 *
 * ⚠️ 跟 `greetingForSwipe` 一樣收 `strip` 當參數、不直接 import `stripLoreTags`：
 * 留在「純判準」這一層，測試可以塞假的 strip 來證明「真的有剝過」。
 */
export function resolveSwipes(
  msg: { swipes?: string[] | undefined; greetingSwipes?: boolean | undefined },
  greetings: string[] | undefined,
  strip: (s: string) => string,
): string[] | undefined {
  if (msg.swipes) return msg.swipes;
  if (msg.greetingSwipes && greetings?.length) return greetings.map(strip);
  return undefined;
}

/**
 * `GET /chats/:id` 用：展開「參照」角色開場白的那幾則成字面 `swipes`；
 * 放這裡不放 route——`chats.ts` 頂著 150 行上限（見檔頭），跟 `resolveSwipes`
 * 同一層判準，擺一起不會分岔。
 *
 * 🔴 **同一個坑、兩條路徑，第一版只補了一條**（獨立驗收線抓到）：夾 `swipeIndex`
 * 之前只做在「主動切換」（`pickSwipe`）。角色卡 `greetings` 變短不需要使用者
 * 動作就會讓存著的 index 懸空，GET 不理它就印出「5 / 3」這種不存在的分數
 * （`SwipeBar.tsx:66,107` 直接信任 `swipeIndex`）。
 *
 * 🔴 **Peter 2026-08-28 推翻第一版「夾回最後一格、text 跟著換」的做法**：
 * 候選還在、只是內容被作者修正，夾回同一位置沒問題；但**這裡是位置本身
 * 消失了**——`greetingSwipes` 只可能出現在對話第一則，使用者往往已經接了
 * 好幾輪、敘事接著「他當初真的選的那句」寫。用別的候選頂替還冒充成原句，
 * 比誠實顯示「5 / 3」壞掉更危險。⇒ **`text` 維持原樣，`swipeIndex` 回 `null`**
 * （不是 `undefined`／省略——那個值已經代表「沒有多重候選」；`null` 專指
 * 「有候選，但這句不在裡面」）。前端要跟著誠實：不能再用 `?? 0` 把 `null`
 * 吃成「高亮第一個候選」，那是比原本更糟的第三種錯誤。
 *
 * 🔴 只改回應、不寫回磁碟——GET 從沒把回傳值餵回 `writeJson`，「只是看」
 * 不該有副作用（同「編輯過才材質化」那套心智模型）。
 * ⚠️ 合法範圍內 `text` 仍照現拼的那一格換——同位置內容被修正，跟上面
 * 「位置消失」是兩件事，不要混在一起處理。
 */
export function withResolvedSwipes<T extends { swipes?: string[] | undefined; swipeIndex?: number | null | undefined; text?: string | undefined; greetingSwipes?: boolean | undefined }>(messages: T[], greetings: string[] | undefined, strip: (s: string) => string): T[] {
  return messages.map((m) => {
    if (!m.greetingSwipes) return m;
    const swipes = resolveSwipes(m, greetings, strip);
    if (!swipes?.length) return m;
    const idx = withinRange(m.swipeIndex ?? 0, swipes.length);
    if (idx === null) return { ...m, swipes, swipeIndex: null } as T;
    return { ...m, swipes, swipeIndex: idx, text: swipes[idx] ?? m.text };
  });
}

/** 🔴 withResolvedSwipes 與材質化（chatMessages.ts）共用這把尺，理由同上，不夾也不猜。 */
export const withinRange = (requested: number, len: number): number | null => (requested >= 0 && requested < len ? requested : null);

/**
 * `PATCH .../swipe` 用：挑出第 `requestedIndex` 個候選，順便把 index 夾回合法範圍
 * （沿用既有「夾住不 500」的判準，`chats.test.ts` 早就在守）。
 * 回 `null` ＝ 這則訊息沒有其他候選，呼叫端轉 404。
 * 🔴 **不回傳整份 `candidates`**——呼叫端只需要「夾好的 index」與「那一格的文字」，
 * 給整份陣列只會誘使呼叫端手滑把它寫回磁碟（那就是把參照凍回快照，見 `resolveSwipes`）。
 */
export function pickSwipe(
  msg: { swipes?: string[] | undefined; swipeIndex?: number | null | undefined; greetingSwipes?: boolean | undefined },
  greetings: string[] | undefined, requestedIndex: number, strip: (s: string) => string,
): { index: number; text: string } | null {
  const candidates = resolveSwipes(msg, greetings, strip);
  if (!candidates?.length) return null;
  const index = Math.min(Math.max(requestedIndex, 0), candidates.length - 1);
  return { index, text: candidates[index] ?? '' };
}
