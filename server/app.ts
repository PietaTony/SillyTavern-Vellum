/**
 * app 的組裝 —— **與「啟動伺服器」分開的理由是可測性**。
 *
 * 🔴 在此之前 `index.ts` 一被 import 就會 `serve()` 起來，於是**沒有任何測試碰得到真正的 app**：
 * 想測就得在測試裡自己 `new Hono()` 再掛一次 route —— 那測的是測試自己組的東西，
 * 不是使用者真的會打到的那一個。**這個 repo 有一條教訓正是「閘門從來沒執行被測物」。**
 * ⇒ 這裡只組不啟動；`index.ts` 負責啟動。
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { apiBodyLimit } from './http/bodyLimits.ts';
import { authGuard } from './http/authGuard.ts';
import { hostGuard } from './http/hostGuard.ts';
import { auth } from './routes/auth.ts';
import { personas } from './routes/personas.ts';
import { secrets } from './routes/secrets.ts';
import { providerTests } from './routes/providerTests.ts';
import { characters } from './routes/characters.ts';
import { characterMedia } from './routes/characterMedia.ts';
import { characterScripts } from './routes/characterScripts.ts';
import { characterEdit } from './routes/characterEdit.ts';
import { backgrounds } from './routes/backgrounds.ts';
import { chatBackground } from './routes/chatBackground.ts';
import { charWorld } from './routes/world.ts';
import { worlds } from './routes/worlds.ts';
import { chats } from './routes/chats.ts';
import { chatVariables } from './routes/chatVariables.ts';
import { cardVariables } from './routes/cardVariables.ts';
import { globalWorlds } from './routes/globalWorlds.ts';
import { chatMessages } from './routes/chatMessages.ts';
import { chatImport } from './routes/chatImport.ts';
import { generate } from './routes/generate.ts';
import { update } from './routes/update.ts';
import { network } from './routes/network.ts';
import { companionSettings } from './routes/companionSettings.ts';
import { currentVersion } from './adapters/version.ts';
import { LICENSE_ID, sourceUrl, UPSTREAM_URL } from './adapters/sourceUrl.ts';

export const app = new Hono()
  .use('*', hostGuard())
  .use('/api/*', authGuard())
  .use('/api/*', apiBodyLimit())
  /**
   * 版本 ＋ **授權與原始碼位置**（AGPL §13）。
   * 🔴 掛在既有的 `/api/version` 而不是另開一支：前端本來就會打它，
   * 多一支端點就多一個「有人忘了呼叫」的機會，而這一份資訊**不能沒有人拿得到**。
   */
  .get('/api/version', (c) =>
    c.json({
      ok: true,
      name: 'vellum',
      version: currentVersion(),
      license: LICENSE_ID,
      source: sourceUrl(),
      upstream: UPSTREAM_URL,
    }),
  )
  .route('/api/secrets', secrets)
  // 🔴 三支「真的會往外發請求」的端點，與純本機讀寫的 secrets 分開（見該檔檔頭）。
  .route('/api/secrets', providerTests)
  .route('/api/personas', personas)
  .route('/api/characters', characters)
  // 同一個前綴掛兩支：角色本體與世界書副本是兩種節奏的東西，分開比較好讀。
  .route('/api/characters', charWorld)
  .route('/api/worlds', worlds)
  .route('/api/global-worlds', globalWorlds)
  .route('/api/characters', characterMedia)
  // 同前綴再掛一支：建立與「就地修改」風險不同，分開比較好審（見該檔檔頭）。
  .route('/api/characters', characterEdit)
  // 卡片自帶腳本：吐的可能是 2 MB 的 JS，快取與風險等級都與角色資料不同（見該檔檔頭）。
  .route('/api/characters', characterScripts)
  .route('/api/chats', chats)
  .route('/api/chats', chatMessages)
  .route('/api/chats', chatImport)
  .route('/api/chats', chatVariables)
  // 卡片變數的另外兩種範圍（global／character）——分開一支的理由見該檔檔頭。
  .route('/api/card-variables', cardVariables)
  // 同一個前綴掛兩支的理由見 `chatBackground.ts` 檔頭（`chats.ts` 已逼近 150 行上限）。
  .route('/api/chats', chatBackground)
  .route('/api/backgrounds', backgrounds)
  .route('/api/generate', generate)
  .route('/api/update', update)
  // 「允許其他裝置連線」的開關（見該檔檔頭：GET 會同時回設定值與實際綁的介面）。
  .route('/api/network', network)
  .route('/api/auth', auth)
  .route('/api/settings', companionSettings)
  /**
   * 🔴 **一處守全部**（GAP-69）。`c.req.json()` 對非 JSON body 丟 `SyntaxError`，
   * 沒攔就是 **500** —— 而 500 的意思是「我壞了」，這其實是**呼叫端送錯東西**、該回 400。
   * 全 repo 有 17 處 `await c.req.json()`，逐處包 try/catch 會漏掉下一個新增的
   * ⇒ 在這裡收，新的 route 自動受保護。
   * 🔴 順便把其餘未捕捉的例外收斂成一句話 —— 預設會把 stack 吐給呼叫端。
   *
   * 🔴 **`HTTPException` 曾經也被這句「其餘一律 500」收斂進去**（`INBOX/
   * 20260831-bodylimit-413-becomes-500.md`）：`apiBodyLimit()`（`http/bodyLimits.ts`）
   * 擋下超過上限的上傳時，Hono 的 `bodyLimit` 正確地拋出 `HTTPException(413, ...)`，
   * 但這裡只認得 `SyntaxError`，於是使用者收到的是「伺服器內部錯誤」500 ——
   * 畫面上看起來像「我們壞了」，而不是「你的檔案太大」。
   * ⇒ 先接住 `HTTPException`、照它自帶的 `status` 回，而不是全部壓成 500；
   * 413 另外給一句人話（其餘狀態碼照 Hono 自己的訊息，目前 repo 裡只有 413 這一種來源）。
   */
  .onError((err, c) => {
    if (err instanceof SyntaxError) return c.json({ error: '參數不合法：body 不是 JSON' }, 400);
    if (err instanceof HTTPException) {
      const message = err.status === 413 ? '檔案太大：超過這個路徑允許的上傳大小上限' : err.message || '請求錯誤';
      return c.json({ error: message }, err.status);
    }
    console.error('[vellum] 未預期的錯誤：', err);
    return c.json({ error: '伺服器內部錯誤' }, 500);
  });

export type AppType = typeof app;
