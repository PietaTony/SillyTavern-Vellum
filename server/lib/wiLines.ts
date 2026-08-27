/**
 * 「線路」（C5）＝ 一組會被一起開關的世界書條目。純函式。
 *
 * 🔴 **線路不是我們發明的資料，是卡片作者已經寫在開場白裡的**
 * （`<!-- lore: 8,12,14… -->`）。P4 的手動路徑要的就是「隨時切回某一條線」，
 * 而不是只能在建立對話時選一次。
 * ⇒ 這裡不新增任何資料模型，只是把已經存在的東西**去重、命名、列出來**。
 *
 * 🔴 **依集合去重，不是一則開場一條線。**
 * 實測標的卡 9 則開場白只對應 **5 組**不重複的集合 ——
 * 三則「成年」共用同一組、兩則「童年」共用同一組。
 * 一則一條的話，使用者會看到三條長得一樣的「線」而不知道差在哪（差的是開場白文字，不是線）。
 *
 * ⚠️ 沒有 ST 前例可抄（`plans/21-card-ui-pages.md` 標的「要自己設計」那三頁之一）。
 * 標的卡在 ST 上是靠第三方腳本做到的。
 */
import { extractLoreTags, titleOfGreeting } from './loreTags.ts';

export type WiLine = {
  /** 集合本身的識別 —— 同一組 include/exclude 就是同一條線。 */
  key: string;
  /** 用到這條線的開場白名字。🔴 **複數**，因為多則開場常共用一條線。 */
  titles: string[];
  include: string[];
  exclude: string[];
};

const keyOf = (include: string[], exclude: string[]): string =>
  `${[...include].sort().join(',')}|${[...exclude].sort().join(',')}`;

/**
 * 從開場白清單推出有哪幾條線。
 * 🔴 **沒有標籤的開場白不算一條線**（例如第 0 則）—— 它代表「不動任何開關」，
 * 那不是一條線，是「沒有指定」。列出來會讓人以為有一條叫「什麼都不開」的線。
 */
export function linesFromGreetings(greetings: string[]): WiLine[] {
  const by = new Map<string, WiLine>();
  for (const g of greetings) {
    const { include, exclude } = extractLoreTags(g);
    if (include.length === 0 && exclude.length === 0) continue;
    const key = keyOf(include, exclude);
    const title = titleOfGreeting(g);
    const found = by.get(key);
    if (found) {
      if (title && !found.titles.includes(title)) found.titles.push(title);
    } else {
      by.set(key, { key, titles: title ? [title] : [], include, exclude });
    }
  }
  return [...by.values()];
}

/**
 * 把「一則開場白帶的標籤」包成一條線，好讓它跟線路切換器走**同一個 `exclusiveOff`**。
 *
 * 🔴 存在的理由是 GAP-120：切開場白原本只做加法（標籤說開什麼就開什麼），
 * 而線路切換器早就在做切換 ⇒ **同一件事、兩個入口、兩種語意**，
 * 而且分岔的那一邊（切開場）在畫面上完全看不出來。
 * `greetingLore.ts` 的檔頭早就寫著「兩個入口必須是同一個引擎」——當時只共用了一半。
 */
export function lineOfTags(tags: { include: string[]; exclude: string[] }): WiLine {
  return { key: keyOf(tags.include, tags.exclude), titles: [], ...tags };
}

/**
 * 切到某一條線時，**要一起關掉的別條線專屬條目**。
 *
 * 🔴 **為什麼「切線」不能只做加法。** 卡片作者的 `<!-- lore -->` 標籤本身是加法的，
 * 挑開場白時那樣沒問題 —— 那時世界書還在出廠狀態。但**線路切換器是中途用的**，
 * 只做加法會讓成年線與童年線同時開著（實測真的會）⇒
 * **把互相矛盾的人生階段一起餵進 prompt**，而畫面上兩條都顯示「套用中」。
 *
 * ⇒ 切線 ＝ 開這條的 ＋ 關「只屬於別條」的。
 * 🔴 **共用的條目不關**（例如三條線都會開的 `12`）—— 那些是共同背景，
 * 關掉會把角色的基本設定一起拿掉。
 * 🔴 **沒有被任何線點名的條目一律不動** —— 那是使用者自己調的，不是我們的事。
 */
export function exclusiveOff(target: WiLine, all: WiLine[]): string[] {
  const keep = new Set(target.include);
  const off = new Set<string>();
  for (const l of all) {
    if (l.key === target.key) continue;
    for (const uid of l.include) if (!keep.has(uid)) off.add(uid);
  }
  return [...off].sort();
}

/**
 * 這條線現在是不是「已經套用中」。
 *
 * 🔴 判準是**「該開的都開了、該關的都關了」**，不是「完全相等」——
 * 線路只管它點名的那幾條，沒點名的條目使用者可以自己調，
 * 那不代表這條線沒套用。用完全相等的話，改一條無關的開關就會讓所有線都顯示成未套用。
 */
export function isLineActive(
  line: Pick<WiLine, 'include' | 'exclude'>,
  entries: { uid: string; enabled: boolean }[],
): boolean {
  const state = new Map(entries.map((e) => [e.uid, e.enabled]));
  // 指到不存在的條目時**不算套用中** —— 那是卡片打錯字，要看得出來而不是靜靜當成已套用。
  for (const uid of line.include) if (state.get(uid) !== true) return false;
  for (const uid of line.exclude) if (state.get(uid) !== false) return false;
  return true;
}
