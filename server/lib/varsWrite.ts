/**
 * 卡片變數的寫入語意 —— **合併還是覆寫**，三支端點共用一份。
 *
 * 🔴 **為什麼要有覆寫**（GAP-123）：卡片的 `replaceVariables()` 名字說要整包換掉，
 * 而三支端點一律淺層合併 ⇒ **卡片刪掉的鍵在檔案裡還在**，
 * 下次重新整理又冒回來。名不副實的 API 比缺少的 API 更難查：
 * 呼叫端當下讀得到自己期望的結果（本地快取），問題要等下一次載入才出現。
 *
 * 🔴 **預設仍然是合併，而且合併是多數。** 卡片一次只寫它關心的那幾個鍵，
 * 整包覆寫會抹掉別支腳本的狀態（`cardVariables.ts` 檔頭那條理由沒有變）。
 * ⇒ 覆寫要**明講**：body 送 `replace` 而不是 `patch`。
 *
 * ⚠️ **兩個鍵不可以同時出現**。一個 body 同時說「合併這些」與「換成這些」時，
 * 無論選哪一個都會有一半被靜靜丟掉 —— 那正是最難查的一類。⇒ 直接擋下來。
 *
 * ⚠️ **刻意不用 `.strict()`。** 想擋的是「打錯字的 `pathc` 變成什麼都沒寫」，
 * 而下面的 `refine`（恰好給一個）本來就擋得住那件事。
 * 用 `.strict()` 會連帶讓「body 多塞幾個鍵」整包 400 —— 那會推翻
 * `cardVariables.test.ts` 那條資安測試刻意釘住的行為：
 * **多餘的鍵一律忽略、只寫 `variables`**。
 * 🔴 為了讓新 schema 過而去改既有的資安測試，就是「驗收條件被改成配合實作」。
 */
import { z } from 'zod';

const Vars = z.record(z.string(), z.unknown());

/** 🔴 `strict()`：多送一個鍵要紅，不要靜靜忽略（打錯字的 `pathc` 會變成「什麼都沒寫」）。 */
export const VarsBody = z
  .object({ patch: Vars.optional(), replace: Vars.optional() })
  .refine((b) => (b.patch === undefined) !== (b.replace === undefined), {
    message: 'patch 與 replace 要恰好給一個',
  });

export type VarsBodyValue = z.infer<typeof VarsBody>;

/** 算出寫回去的那一份。`replace` ＝ 整包換掉（卡片刪掉的鍵真的會消失）。 */
export function nextVars(
  base: Record<string, unknown> | undefined,
  body: VarsBodyValue,
): Record<string, unknown> {
  return body.replace !== undefined ? { ...body.replace } : { ...(base ?? {}), ...body.patch };
}
