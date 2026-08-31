import { bodyLimit } from 'hono/body-limit';
import type { MiddlewareHandler } from 'hono';

const MB = 1024 * 1024;

/**
 * 每條路徑的 body 上限。**一道閘門，大小按路徑決定。**
 *
 * 🔴 **不可以疊兩道 `bodyLimit`。** 上一版是
 * `.use('/api/*', bodyLimit(8MB))` 之後再 `.use('/api/characters/import', bodyLimit(64MB))` ——
 * 兩道**都會跑**，Hono 依註冊順序執行，**先撞到的小上限先丟 413**。
 * ⇒ 那三條「放大」的宣稱（角色卡 64 MB、對話檔 64 MB、背景 32 MB）**全部是假的**，
 * 實際生效的一直是 8 MB。
 * 實測（敵意審查 2026-08-26，`curl` 打 10 MB）：
 * ```
 * POST /api/backgrounds        10MB → 413
 * POST /api/characters/import  10MB → 413
 * ```
 * ⚠️ 這種壞法**看 code 看不出來**，兩行單獨都對；也**沒有任何測試會抓到**，
 * 因為沒人會在單元測試裡送 10 MB。要抓只能實際打一次。
 *
 * 🔴 **`bodyLimit` 的 `maxSize` 是建構時固定的** ⇒ 不能在 middleware 裡改，
 * 只能**每種大小各建一個 instance，再按路徑挑一個來跑**。
 */
const RULES: [RegExp, number][] = [
  /**
   * 🔴 **匯入角色卡另給一條上限。** 8 MB 對卡片來說不夠 ——
   * 實測一張真卡就 6.8 MB，而卡片作者把桌寵貼圖（近 200 萬字元 base64）塞在卡裡是常態。
   * 卡進不來的話「完整匯入」整件事就是假的。
   */
  [/^\/api\/characters\/import$/, 64 * MB],
  // 對話檔同理：長期對話的 JSONL 動輒數 MB。
  [/^\/api\/chats\/import$/, 64 * MB],
  /**
   * 我們自己格式的匯回（`chatImport.ts` 的 `/import/vellum`）——上面那條 JSONL
   * 匯入的姊妹路徑，扛的是同一種東西（一整段對話），只是格式不同。
   * 🔴 **量出來的數字，不是猜的**（`INBOX/20260831-bodylimit-413-becomes-500.md`
   * 順帶要求）：500 輪來回（1000 則訊息，每則 assistant 帶 3 個候選、含 usage）
   * 序列化後 2.4 MB；拉到 2000 輪（4000 則訊息，同一種長度）就到 **9.67 MB**——
   * 已經超過 `DEFAULT` 8 MB。長期經營的角色扮演對話動輒上千則訊息，
   * 8 MB 撐不住；`writeNativeChat()` 又是 `JSON.stringify(..., null, 2)` 的
   * pretty-print（比同內容的 JSONL 肥），沒有理由給它比姊妹路徑更小的上限。
   * ⇒ 比照 `/api/chats/import` 同給 64 MB。
   */
  [/^\/api\/chats\/import\/vellum$/, 64 * MB],
  /**
   * 背景圖：ST 內建那 23 張裡最大一張 2.3 MB，
   * 而使用者自己抓的 4K 桌布動輒 10 MB 以上。
   */
  [/^\/api\/backgrounds$/, 32 * MB],
];

/**
 * 預設 8 MB：頭像走 base64 dataUrl 進 JSON body，前端已縮到 256px，正常一張幾十 KB。
 * 沒有上限的話任何人都能一直 POST 大檔把磁碟塞滿
 * （實測：5 MB 的 avatar 直接落成 5 MB 的 json，而且每次都是新 UUID 檔）。
 */
const DEFAULT = 8 * MB;

/** 每種大小只建一個 instance，避免每個請求都重新建。 */
const CACHE = new Map<number, MiddlewareHandler>();
const limiterFor = (size: number): MiddlewareHandler => {
  const hit = CACHE.get(size);
  if (hit) return hit;
  const m = bodyLimit({ maxSize: size });
  CACHE.set(size, m);
  return m;
};

export const sizeFor = (path: string): number =>
  RULES.find(([re]) => re.test(path))?.[1] ?? DEFAULT;

/** 掛在 `/api/*` 上，**只有這一道**。 */
export const apiBodyLimit = (): MiddlewareHandler => (c, next) =>
  limiterFor(sizeFor(c.req.path))(c, next);
