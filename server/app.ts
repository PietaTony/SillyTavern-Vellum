/**
 * app 的組裝 —— **與「啟動伺服器」分開的理由是可測性**。
 *
 * 🔴 在此之前 `index.ts` 一被 import 就會 `serve()` 起來，於是**沒有任何測試碰得到真正的 app**：
 * 想測就得在測試裡自己 `new Hono()` 再掛一次 route —— 那測的是測試自己組的東西，
 * 不是使用者真的會打到的那一個。**這個 repo 有一條教訓正是「閘門從來沒執行被測物」。**
 * ⇒ 這裡只組不啟動；`index.ts` 負責啟動。
 */
import { Hono } from 'hono';
import { apiBodyLimit } from './lib/bodyLimits.ts';
import { hostGuard } from './lib/hostGuard.ts';
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
import { globalWorlds } from './routes/globalWorlds.ts';
import { chatImport } from './routes/chatImport.ts';
import { generate } from './routes/generate.ts';
import { update } from './routes/update.ts';
import { currentVersion } from './lib/version.ts';

export const app = new Hono()
  .use('*', hostGuard())
  .use('/api/*', apiBodyLimit())
  .get('/api/version', (c) => c.json({ ok: true, name: 'vellum', version: currentVersion() }))
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
  .route('/api/chats', chatImport)
  .route('/api/chats', chatVariables)
  // 同一個前綴掛兩支的理由見 `chatBackground.ts` 檔頭（`chats.ts` 已逼近 150 行上限）。
  .route('/api/chats', chatBackground)
  .route('/api/backgrounds', backgrounds)
  .route('/api/generate', generate)
  .route('/api/update', update)
  /**
   * 🔴 **一處守全部**（GAP-69）。`c.req.json()` 對非 JSON body 丟 `SyntaxError`，
   * 沒攔就是 **500** —— 而 500 的意思是「我壞了」，這其實是**呼叫端送錯東西**、該回 400。
   * 全 repo 有 17 處 `await c.req.json()`，逐處包 try/catch 會漏掉下一個新增的
   * ⇒ 在這裡收，新的 route 自動受保護。
   * 🔴 順便把其餘未捕捉的例外收斂成一句話 —— 預設會把 stack 吐給呼叫端。
   */
  .onError((err, c) => {
    if (err instanceof SyntaxError) return c.json({ error: '參數不合法：body 不是 JSON' }, 400);
    console.error('[vellum] 未預期的錯誤：', err);
    return c.json({ error: '伺服器內部錯誤' }, 500);
  });

export type AppType = typeof app;
