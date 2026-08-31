/**
 * `server/routes/generate.ts` 的收尾邏輯：串流讀到一半掛掉時，是「使用者自己按了
 * 停止」還是「真的出錯」——這裡分流。抽成獨立檔案的理由跟 `commitPartialTurn.ts`
 * 一樣：`generate.ts` 在動工前就已經卡在 150 行（`origin/staging` 量過，149 行、
 * 沒有空間），這段新邏輯塞不進去，唯一乾淨的路是另開檔案，不是把既有註解砍薄——
 * 那條路第一輪做過、被獨立驗收退回。
 *
 * 🔴 **中止（使用者按停止／連線斷了）跟「真的出錯」是兩件事**（跨層票 H1／H6，
 * 2026-08-28）：`controller.signal.aborted` 為真時，`reader.read()` 丟的是我們自己
 * 觸發的 AbortError，不是供應商出錯——這時要把已經吐出來的字落地成半成品，
 * 而不是丟一顆 `error` 事件嚇使用者（那則訊息其實已經在寫了）。
 *
 * ⚠️ **半成品不套 `<UpdateVariable>`**：中止點不保證停在完整區塊之後，半句
 * JSONPatch 套下去會靜默寫壞 `chat.variables`（見 `commitPartialTurn.ts` 檔頭）。
 * ⚠️ 客戶端多半已經斷線讀不到這裡送出的 `done`／`error` 事件——落地（`writeJson`）
 * 才是重點，`ctrl.enqueue` 只是「如果連線還在」的順手嘗試，失敗不影響已經寫進
 * 檔案的訊息，所以兩個分支各自都用 try/catch 包住 enqueue。
 */
import type { ProviderEvent } from '../providers/types.ts';
import { redact } from './secrets.ts';
import { commitPartialTurn } from './commitPartialTurn.ts';
import { definedUsage, type Message } from './chatModel.ts';
import { writeJson } from '../adapters/storage.ts';

/**
 * A6 順手做的抽檔：把 `generate.ts` 逐行處理 `adapter.parse()` 事件的 if/else
 * 挪出來——不是這張票的內容，但 idle timeout 加進 `generate.ts` 之後撞了
 * `gate:file-size`（`origin/staging` 量過，149 行），這一段本來就是**跟供應商
 * 事件形狀綁死、跟路由層無關**的邏輯，抽出來比硬塞或砍註解乾淨。
 * 🔴 **可變狀態用物件傳進來**，不是回傳值——呼叫端 `generate.ts` 的迴圈要看到
 * `full`／`usage`／`finish` 累積到目前為止的值（idle timeout 判斷、`done` 事件都要用）。
 */
export function applyProviderEvents(
  events: ProviderEvent[],
  state: { full: string; finish: string | undefined; usage: Record<string, number | undefined> },
  ctrl: ReadableStreamDefaultController<Uint8Array>,
  enc: TextEncoder,
  sse: (event: string, data: unknown) => string,
  key: string,
): void {
  for (const ev of events) {
    if (ev.type === 'delta') {
      // 🔴 **thinking 不進正文**：它是思考過程，混進去會變成角色的台詞。
      if (ev.kind === 'text') {
        state.full += ev.text;
        ctrl.enqueue(enc.encode(sse('delta', { text: ev.text })));
      } else {
        ctrl.enqueue(enc.encode(sse('thinking', { text: ev.text })));
      }
    } else if (ev.type === 'usage') {
      state.usage = { ...state.usage, ...ev.usage };
    } else if (ev.type === 'done') {
      if (ev.finishReason) state.finish = ev.finishReason;
      if (ev.usage) state.usage = { ...state.usage, ...ev.usage };
    } else {
      // 🔴 retryable 一路帶著走（跨層票 B6）：這是四支適配器 `parse()` 真的判出來的值，
      // 不是這裡再猜一次——分類只住在後端這一份（同一個判準見 `lib/providerError.ts` 檔頭）。
      ctrl.enqueue(enc.encode(sse('error', { message: redact(ev.message, [key]), retryable: ev.retryable })));
    }
  }
}

export async function finishGenerateStream(opts: {
  ctrl: ReadableStreamDefaultController<Uint8Array>;
  enc: TextEncoder;
  sse: (event: string, data: unknown) => string;
  controller: AbortController;
  full: string;
  chatId: string;
  chat: { messages: unknown[] };
  usage: Record<string, number | undefined>;
  key: string;
  error: unknown;
}): Promise<void> {
  const { ctrl, enc, sse, controller, full, chatId, chat, usage, key, error } = opts;
  if (controller.signal.aborted && full.length > 0) {
    try {
      const msg = await commitPartialTurn(chatId, chat, full, usage);
      ctrl.enqueue(enc.encode(sse('done', { message: msg, finishReason: 'ABORTED', usage })));
    } catch (commitErr) {
      console.error('[vellum] 中止時把半成品落地失敗：', commitErr);
    }
  } else if (!controller.signal.aborted) {
    const detail = error instanceof Error ? redact(error.message, [key]) : '串流中斷';
    try {
      // 🔴 這裡的 `retryable: true` 不是分類——已經開始串流（HTTP 已經 200）又中途炸掉
      // 的，不是「金鑰錯／模型錯」那種會一直重現的設定問題（那種會在 `!upstream.ok`
      // 就被擋下來，走不到這個 catch），是連線層級的中斷，本質上是暫時的。
      ctrl.enqueue(enc.encode(sse('error', { message: detail, retryable: true })));
    } catch {
      /* 連線已經沒了，寫不進去不算另一個錯誤 */
    }
  }
}

/**
 * `finally { ctrl.close(); }` 加一層防呆——中止之後（`cancel()` 被呼叫）controller
 * 可能已經進入不能再操作的狀態，再 close 一次會丟例外。這件事跟上面的分流邏輯
 * 綁在一起改（同一輪跨層票），所以放同一支檔案，不另開檔。
 */
export function closeQuietly(ctrl: ReadableStreamDefaultController<Uint8Array>): void {
  try {
    ctrl.close();
  } catch {
    /* 已經因為中止被關掉的話，再關一次會丟例外——不用理它 */
  }
}

/**
 * usage 落地（H1 落地票，2026-08-31）。供應商回報的真金用量——不是 ST 那種可以隨時
 * 重算的估算值（`openai.js`／`chat-completions.js` grep `usage` 零命中，ST 從不讀它）。
 * 錯過生成的這一刻，這個數字永遠拿不回來，所以要寫進訊息本體，不能只留在 SSE 那一次回應裡。
 *
 * 🔴 **放在這支檔案，不是 `generate.ts`**：`commitTurn()` 是 H6 的檔
 * （`applyVarUpdate.ts`），這一輪沒有鎖它，不能改簽章塞第四個參數；而 `generate.ts`
 * 自己也已經頂著 150 行的上限（`origin/staging` 量過），這段邏輯本來就跟這支檔案
 * 其餘的「生成收尾」放在一起才對，不是硬塞進呼叫端。
 *
 * 🔴 **`msg` 要傳同一個物件參照**：呼叫端（`commitTurn`／`commitPartialTurn`）已經把
 * 它 `push` 進 `chat.messages`，掛上 `usage` 欄位之後 `chat` 整包已經帶著它——
 * 這裡只需要再寫一次檔。**沒有用量（供應商沒回任何欄位）就不多這次 I/O**。
 */
export async function persistUsage(
  chatId: string,
  chat: { messages: unknown[] },
  msg: Message,
  rawUsage: Record<string, number | undefined>,
): Promise<void> {
  const usage = definedUsage(rawUsage);
  if (!usage) return;
  msg.usage = usage;
  /**
   * 🔴 **這次寫檔失敗不可以把一個已經成功的 turn 判成失敗**（PR #50 獨立驗收退回二）。
   * `commitTurn` 那次寫檔已經成功——訊息本體已經在磁碟上。這裡失敗只代表 usage 這個
   * 補充欄位沒寫進去，不是回覆消失。反過來若讓例外冒出去，會被 `generate.ts` 外層
   * `catch` 接住、`controller.signal.aborted` 是 false ⇒ 落進 `finishGenerateStream()`
   * 的 `else if` 分支，只送 `error` 事件、不再送 `done`——前端 `streamEventHandler.ts`
   * 的 `error` 分支不會把 `acc.value` 併回畫面，使用者剛吐出來的整段回覆會從畫面上
   * 消失（重整才會再出現）。跟 `commitPartialTurn` 的呼叫端一樣（見 `handleIdleTimeout`／
   * `finishGenerateStream` 兩處都用 try/catch 包住、失敗只 `console.error`），這裡要對稱。
   */
  try {
    await writeJson(`chats/${chatId}.json`, chat);
  } catch (e) {
    console.error('[vellum] usage 落地失敗（不影響這一則回覆）：', e);
  }
}
