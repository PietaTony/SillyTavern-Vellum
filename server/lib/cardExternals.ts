/**
 * 「這段程式會去哪些網域抓 code」—— **`乙` 那道防線的量尺**（Peter 2026-08-26 裁定）。
 *
 * 🔴 它漏掉一個外部 `import`，同意視窗就少問一次，
 * 使用者就在不知情下讓卡片從網路載了程式進來。**這支的每一條都是「漏掉會怎樣」。**
 *
 * 實測樣本：那張卡的「MVU Zod 腳本」全文就是一行
 * `import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js'`
 * ⇒ **`Mvu` 不在卡片裡，是執行時從 jsDelivr 抓的。**
 * 所以「內容 hash 一樣 ＝ 內容沒變」是假的 —— hash 蓋到的是那行 import，
 * 不是 CDN 當下吐出來的東西。
 */

/**
 * `import 'https://…'` / `import('https://…')` / `from 'https://…'`。
 * ⚠️ 網址部分用 `*` 不是 `+`：`import 'https://'` 這種畸形寫法**照樣會發請求**，
 *    用 `+` 會漏掉它而靜默放行（測試當場抓到）。抓到之後交給 `new URL()` 去判死。
 */
const IMPORT_URL = /(?:^|[\s(=])(?:import|from)\s*\(?\s*['"](https?:\/\/[^'"]*)['"]/gm;

/** 這段程式會去哪些網域抓東西（去重、只留主機名）。 */
export function externalsOf(code: string): string[] {
  const hosts = new Set<string>();
  IMPORT_URL.lastIndex = 0;
  for (let m = IMPORT_URL.exec(code); m !== null; m = IMPORT_URL.exec(code)) {
    try {
      hosts.add(new URL(m[1] ?? '').host);
    } catch {
      // 解析不了的網址就當成「有外連但說不出是哪」——寧可多問一次，不要靜默放行。
      hosts.add('(無法解析的網址)');
    }
  }
  return [...hosts].sort();
}
