/**
 * 把供應商的錯誤原文分類成我們認得的種類。**唯一一份判準，住在後端。**
 *
 * 🔴 **為什麼在後端**：分類的結果會決定**要不要把模型存下來**，而存檔是後端的事。
 * 判準放前端、存檔放後端的話，兩邊遲早各判一次然後分岔 ——
 * 症狀會是「畫面說已存、實際沒存」。前端改成讀這裡回的 `reason`。
 *
 * ⚠️ **判準刻意寬鬆（多命中幾個沒關係）**：
 * 誤判成「額度不足」的代價是**存下一個其實打不通的模型**；
 * 漏判的代價是**使用者選的模型被丟掉，而且他不知道為什麼**。後者比較痛。
 */
export type ProviderErrorReason = 'no-credit' | null;

/**
 * 餘額／額度用完的說法在各家長得不一樣，這裡收集實際看過與文件寫過的形狀。
 * 🔴 **不要收斂成一條聰明的 regex** —— 那會很難看出漏了誰，也很難補。
 */
const NO_CREDIT = [
  /credit balance is too low/i,
  /insufficient[\s_-]*(credit|balance|quota|funds)/i,
  /exceeded your current quota/i,
  /billing[\s_-]*(hard[\s_-]*limit|not[\s_-]*active)/i,
  /payment[\s_-]*required/i,
  /quota[\s_-]*exceeded/i,
  /arrears|余额不足|餘額不足|欠费|欠費/,
];

export function classifyProviderError(raw: string): ProviderErrorReason {
  return NO_CREDIT.some((re) => re.test(raw)) ? 'no-credit' : null;
}
