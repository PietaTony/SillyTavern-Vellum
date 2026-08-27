/**
 * 由三個數值推導「階段」。
 *
 * 🔴 **這是那張卡自己的 schema 轉寫的**（`何思年 變量結構` 腳本裡的
 * `registerMvuSchema(Schema)`，`.transform()` 那一段）—— 不是我們發明的判準。
 * MVU 存進 `stat_data` 的是**轉換後**的物件，所以 `階段` 本來就會在裡面；
 * 我們扮演 MVU 就得產出一樣的形狀，否則卡片讀到的 `stat_data` 少一個鍵。
 *
 * ⚠️ **為什麼是轉寫不是執行**：那支 schema 用 `z`(zod) 與 `_`(lodash) 寫成，
 * 而 zod 要在沙箱裡才跑得到 —— 後端執行卡片的程式是我們刻意不做的事
 *（`gate:no-eval` 守著）。⇒ 轉寫，並在這裡標明出處，改的時候兩邊一起看。
 *
 * ⚠️ 卡片自己也有一份 fallback（桌寵的 `phaseName()`），但它**只算成年線** ——
 * 學生／童年線在那條路上會算錯。這一支三條線都算。
 */
export function stageOf(v: {
  時期?: unknown;
  安全感?: unknown;
  面具?: unknown;
  親密度?: unknown;
}): string {
  const n = (x: unknown): number => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const 安全感 = n(v.安全感);
  const 面具 = n(v.面具);
  const 親密度 = n(v.親密度);

  if (v.時期 === '學生') {
    if (親密度 >= 65 && 面具 <= 45) return '分歧';
    if (親密度 >= 35 && 安全感 >= 20) return '曖昧';
    return '同學';
  }
  if (v.時期 === '童年') {
    if (親密度 >= 60 && 安全感 >= 50 && 面具 <= 50) return '依附';
    if (安全感 >= 30 && 面具 <= 70) return '習慣';
    return '警戒';
  }
  // 成年線（也是預設）：接近 / 動搖 / 確認
  if (親密度 >= 70 && 安全感 >= 40 && 面具 <= 40) return '確認';
  if (親密度 >= 40 && 安全感 >= 25) return '動搖';
  return '接近';
}
