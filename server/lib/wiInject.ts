/**
 * 世界書三步的**第二、三步：排／裁、插**。
 *
 * 🔴 **這裡是整個世界書最容易做錯的地方**（規格 §3 G3、複檢 F4）：
 * 層序決定「誰先被選中／誰先被裁掉」，**`position` 與 `depth` 才決定文字插在 prompt 哪裡**。
 * 只做排序就把 38 條串成一坨，會摧毀卡片的 prompt 結構。
 *
 * 🔴 **順序有一個反直覺的地方**（ST `world-info.js:5084-5143`）：
 * ST 依 `order` **降冪**逐條處理，每條都 `unshift` 進自己的桶子
 * ⇒ **同一個桶子裡最終的文字順序是 `order` 升冪**（低 order 在前，高 order 最靠近插入點）。
 * 照直覺寫成「降冪 push」會得到完全相反的順序。
 */
import { WI_POSITION, type WbEntry } from './worldbook.ts';

/** ST `script.js:492` `extension_prompt_roles`。 */
export const WI_ROLE = { system: 0, user: 1, assistant: 2 } as const;
const DEFAULT_DEPTH = 4;

export type DepthBucket = { depth: number; role: number; entries: string[] };

export type InjectionPlan = {
  beforeChar: string[];
  afterChar: string[];
  anTop: string[];
  anBottom: string[];
  emTop: string[];
  emBottom: string[];
  atDepth: DepthBucket[];
  /** 被 token 預算裁掉的（**要看得見**，不可以無聲消失）。 */
  trimmed: WbEntry[];
  /** 認不得的 position（例如 `outlet: 7`）。**不猜語意，原樣回報。** */
  unplaced: WbEntry[];
};

export type BudgetOpts = {
  /** 預算上限。省略＝不裁。 */
  budget?: number;
  /**
   * 怎麼算長度。🔴 **預設是「字元數」不是 token**——本專案還沒有 tokenizer，
   * 拿 `chars/4` 之類的估算去當 token 是一把假的尺。要真的守 token 預算，
   * 由呼叫端傳一個真的計數器進來。
   */
  count?: (text: string) => number;
};

const empty = (): InjectionPlan => ({
  beforeChar: [],
  afterChar: [],
  anTop: [],
  anBottom: [],
  emTop: [],
  emBottom: [],
  atDepth: [],
  trimmed: [],
  unplaced: [],
});

/** 同層內：`order` 降冪。ST 用穩定排序，同 order 保留原本的先後。 */
export const byOrderDesc = (a: WbEntry, b: WbEntry): number => b.order - a.order;

function intoDepth(plan: InjectionPlan, e: WbEntry, content: string): void {
  const depth = Number.isFinite(e.depth) ? e.depth : DEFAULT_DEPTH;
  const role = e.role ?? WI_ROLE.system;
  const found = plan.atDepth.find((b) => b.depth === depth && b.role === role);
  if (found) found.entries.unshift(content);
  else plan.atDepth.push({ depth, role, entries: [content] });
}

/**
 * 排 → 裁 → 插。**進來的 `activated` 已經是層序排好的**（chat → persona → global/character），
 * 這支只負責同層 `order` 排序與之後的事。
 */
export function planInjection(activated: WbEntry[], opts: BudgetOpts = {}): InjectionPlan {
  const count = opts.count ?? ((t: string) => t.length);
  const plan = empty();
  const sorted = [...activated].sort(byOrderDesc);

  let used = 0;
  let overflowed = false;
  for (const e of sorted) {
    const content = e.content;
    if (!content) continue;
    if (opts.budget !== undefined && !e.ignoreBudget) {
      // 🔴 一旦爆了就**不再恢復**（ST 的 `token_budget_overflowed` 是外層變數，
      // 設了就不重設）——否則短的條目會在長條目之後偷偷擠進來，順序變得無法預期。
      if (overflowed || used + count(content) > opts.budget) {
        overflowed = true;
        plan.trimmed.push(e);
        continue;
      }
      used += count(content);
    }
    switch (e.position) {
      case WI_POSITION.beforeChar:
        plan.beforeChar.unshift(content);
        break;
      case WI_POSITION.afterChar:
        plan.afterChar.unshift(content);
        break;
      case WI_POSITION.anTop:
        plan.anTop.unshift(content);
        break;
      case WI_POSITION.anBottom:
        plan.anBottom.unshift(content);
        break;
      case WI_POSITION.emTop:
        plan.emTop.unshift(content);
        break;
      case WI_POSITION.emBottom:
        plan.emBottom.unshift(content);
        break;
      case WI_POSITION.atDepth:
        intoDepth(plan, e, content);
        break;
      default:
        // `outlet: 7` 要具名插槽，我們沒有那個概念；不猜、不亂塞，原樣回報。
        plan.unplaced.push(e);
    }
  }
  return plan;
}
