/**
 * 使用者按下「停止生成」時的落地：把已經吐出來的字存成一則**半成品**訊息。
 * 🔴 **跨層票（H1／H6，2026-08-28）**：`applyVarUpdate.ts` 是 H6 的檔，鎖期間歸 H1，
 * 寫完歸回 H6。這支抽成獨立檔案而不是塞進 `applyVarUpdate.ts`——那支在動工前就已經
 * 卡在 150 行（`origin/staging` 量過，149 行、沒有空間），塞進去只有兩條路：把既有
 * 註解砍薄，或另開檔案。前者第一輪做過、被獨立驗收退回——那些註解記的是「為什麼」，
 * 不是「做了什麼」，砍薄了下次同一個坑就認不出來。
 *
 * 🔴 **不可以借用 `commitTurn`（同樣在 `applyVarUpdate.ts`）**。中止點不保證停在完整的
 * `<UpdateVariable>` 區塊之後——半句 `<JSONPatch>` 套下去會**靜默寫壞** `chat.variables`
 * （同一個坑家族見 `applyVarUpdate.ts` 檔頭「引擎接好了、沒有門」）。這一輪的變數留到
 * 下一次真的生成完再算（那時 `full` 是完整回覆，`commitTurn` 會照常套用）。
 * ⇒ 這裡完全不碰 `chat.variables`，只存文字。
 *
 * ⚠️ **`partial: true` 是「下一輪不可以把這句話當完整回覆」的資料指紋**——
 * 讀的一端在 `server/services/buildTurn.ts` 的 `historyTextOf`：它會在半成品的文字後面
 * 掛一句「已中止、還沒說完」的註記才送給模型，原文本身一個字都不改。
 */
import { writeJson } from '../adapters/storage.ts';

export async function commitPartialTurn(
  chatId: string,
  chat: { messages: unknown[] },
  partialText: string,
): Promise<{ id: string; role: 'model'; text: string; at: string; partial: true }> {
  const msg = {
    id: crypto.randomUUID(),
    role: 'model' as const,
    text: partialText,
    at: new Date().toISOString(),
    partial: true as const,
  };
  chat.messages.push(msg);
  await writeJson(`chats/${chatId}.json`, chat);
  return msg;
}

/**
 * A6：**串流沒有 idle timeout，會無限期卡在「思考中」**（`GAP-54` 的同一個形狀，
 * 但這一次連 `catch` 都沒有——供應商連線建立了、卻在吐第一個字之前掛掉且**既不回
 * 錯誤也不關閉連線**，`reader.read()` 就是一顆永遠不 resolve 的 Promise）。
 * 放在這支檔案而不是 `finishGenerateStream.ts`：逾時要落地的半成品走的正是上面
 * `commitPartialTurn`，兩者本來就是「什麼時候該把半成品存起來」同一個問題的兩條
 * 觸發路徑（使用者主動停止 vs. 逾時），`finishGenerateStream.ts` 自己也已經頂著
 * 150 行在動，這裡才有位置放。
 *
 * 🔴 **60 秒的理由**：`useChatStream.ts`／`Typing.tsx` 的既有註解說推理模型的
 * thinking 階段「可能長達十幾秒」——這裡的 idle timeout 量的是「連續兩個 chunk
 * 之間」的間隔，不是整段生成的總時長，所以 60 秒（十幾秒的 4-6 倍）留了充足的
 * 餘裕給正常的慢啟動，同時仍然是個**有界**的等待，不是無限期。可用環境變數
 * `VELLUM_GENERATE_IDLE_TIMEOUT_MS` 覆蓋——**只給測試與現場調校用**，不是使用者設定。
 */
export const IDLE_TIMEOUT_MS = Number(process.env['VELLUM_GENERATE_IDLE_TIMEOUT_MS'] ?? 60_000);

/**
 * 把 `reader.read()` 跟一顆計時器賽跑。**逾時不代表 `reader` 死了**——原本那個
 * `read()` 可能之後才 resolve（甚至丟 AbortError，如果呼叫端接著 `controller.abort()`
 * 的話）——所以逾時分支要接住它，不然會變成沒人接的 rejected promise。
 */
export function raceReadIdle(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleMs: number,
): Promise<{ timedOut: true } | { timedOut: false; done: boolean; value?: Uint8Array | undefined }> {
  const readPromise = reader.read().then((r) => ({ timedOut: false as const, ...r }));
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      readPromise.catch(() => {}); // 見上：逾時之後那個 read() 還是可能落地成例外。
      resolve({ timedOut: true });
    }, idleMs);
    readPromise.then((r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
}

/**
 * 逾時當下要做的三件事：① 放掉卡住的上游連線 ② 有半成品就落地（跟使用者主動
 * 停止同一套語意）③ **一定送出一個事件**——一個字都還沒吐（`full` 是空的）也要
 * 送 `error`，不能什麼都不送就把串流關掉，不然畫面會停在「正在思考…」，使用者
 * 只能自己想到要去按停止鈕。
 */
export async function handleIdleTimeout(opts: {
  ctrl: ReadableStreamDefaultController<Uint8Array>;
  enc: TextEncoder;
  sse: (event: string, data: unknown) => string;
  controller: AbortController;
  full: string;
  chatId: string;
  chat: { messages: unknown[] };
  usage: Record<string, number | undefined>;
}): Promise<void> {
  const { ctrl, enc, sse, controller, full, chatId, chat, usage } = opts;
  controller.abort(); // 放掉那個卡住不吐字也不關閉的上游連線。
  try {
    if (full.length > 0) {
      const msg = await commitPartialTurn(chatId, chat, full);
      ctrl.enqueue(enc.encode(sse('done', { message: msg, finishReason: 'TIMEOUT', usage })));
    } else {
      ctrl.enqueue(enc.encode(sse('error', { message: '供應商逾時沒有回應，請重試一次' })));
    }
  } catch (commitErr) {
    console.error('[vellum] 逾時把半成品落地失敗：', commitErr);
  }
}
