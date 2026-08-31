import { useRef, useState } from 'react';
import { appendMessage, streamGenerate } from './api';
import { useFailureRetry } from './failureRetry';
import type { Message } from './model';
import { applyStopGeneration } from './stopGeneration';
import { makeRunEventHandler } from './streamEventHandler';
import { useGenerationUsage } from './useGenerationUsage';

/**
 * 對話畫面的「送出 → 串流 → 落地」狀態。
 *
 * **抽出來的理由有兩個**：
 * ① `chat/$chatId.tsx` 撞到 `gate:file-size` 的 150 行上限。
 * ② 🔴 更重要的是 `local` 這個欄位 —— 它是「樂觀更新的暫存清單」，
 *    畫面讀的是 `local ?? 伺服器那份`。**誰有權把它歸零，就得跟它住在一起**，
 *    否則就會變成敵意審查 2026-08-26 抓到的 B1：送過一則訊息之後 `local` 再也不是 null，
 *    伺服器那份怎麼 refetch 都被 `??` 短路 ⇒ **swipe 三個入口同時變成「按了沒反應」**。
 *    ⇒ `reset()` 就是那把鑰匙，切候選成功之後要呼叫它。
 */
export function useChatStream(
  chatId: string,
  fromServer: Message[] | undefined,
  /**
   * 🔴 **生成結束時重讀對話。** 後端要到這一刻才把這一輪的 `<UpdateVariable>` 套進
   * `chat.variables`（引擎在 `server/lib/varUpdate.ts`／`varApply.ts`）——不重讀的話
   * 卡片的狀態欄永遠停在進來時那一份。
   * ⚠️ 順便解掉「剛生成完那一則顯示原文」：`done` 送的是沒套過顯示規則的 `full`，
   * 於是 `<UpdateVariable><JSONPatch>…` 會原封印在畫面上直到下次重讀。
   */
  onDone?: () => Promise<unknown>,
  // B5：使用者調過的 AI 回應上限——呼叫端已經拿好值（理由見 `useMaxResponseTokens.ts`）。
  maxOutputTokens?: number,
) {
  const [local, setLocal] = useState<Message[] | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  /**
   * 🔴 **模型正在思考，但一個字都還沒吐**（Peter 2026-08-27）。
   * 推理模型會先送一大段 thinking 才開始寫正文 —— 那段期間畫面上什麼都不動，
   * 看起來就是當掉了。這個旗標讓畫面說得出「它在想」而不是「它壞了」。
   * ⚠️ **不存 thinking 的內容**：後端刻意把它與正文分開（混進去會變成角色的台詞），
   * 我們只需要「有沒有在想」這一個位元。
   */
  const [thinking, setThinking] = useState(false);
  // B4：這一輪用量（理由與「只留最近一輪」的判準見 `useGenerationUsage.ts`）。
  const { usage, clear: clearUsage, record: recordUsage } = useGenerationUsage();
  const abortRef = useRef<AbortController | null>(null);
  const { failureBanner, setFailure } = useFailureRetry(retry);
  const messages = local ?? fromServer ?? [];

  /**
   * 接一段生成上去。`base` 是**這一輪開始時畫面上該有的訊息串**。
   *
   * 🔴 **`base` 一定要由呼叫端給、而且先 `setLocal(base)`。**
   * 「重新生成」是刪完才呼叫的，這個 hook 手上的 `local`／`fromServer`
   * 都還是刪之前那份 —— 用它當底，被刪掉的訊息會在畫面上復活。
   */
  function run(base: Message[]) {
    setLocal(base);
    setStreaming('');
    const ac = new AbortController();
    abortRef.current = ac;
    const acc = { value: '' }; // 共用可變盒子——理由見 `streamEventHandler.ts`。
    // 四個 setter 包一層物件——單純是行數（見 `streamEventHandler.ts` 的 `RunSetters`）。
    const setters = { setThinking, setStreaming, setLocal, setFailure };
    setThinking(false);
    clearUsage(); // 上一輪的數字不該蓋在這一輪頭上（見 `useGenerationUsage.ts`）。
    void streamGenerate(
      chatId,
      makeRunEventHandler({ base, onDone, acc, setters, recordUsage }),
      ac.signal,
      maxOutputTokens,
    ).catch((e: unknown) => {
      /*
       * 🔴 **不 await 就必須自己接住例外。** 在此之前是 `await`，例外會冒到
       * `Composer` 去 —— 而它會解讀成「沒送出去，字留著」，那是錯的：
       * 訊息早就存下來了，壞掉的是生成。
       * ⚠️ 使用者自己中止的不算失敗，不要跳一則訊息嚇他。
       */
      if (ac.signal.aborted) {
        // 🔴 停止生成（跨層票 H1／H6，2026-08-28）——理由見 `stopGeneration.ts`。
        applyStopGeneration({ acc: acc.value, base, ...setters });
        return;
      }
      setThinking(false);
      setStreaming(null);
      setFailure({ message: e instanceof Error ? e.message : '生成中斷', retryable: true });
    });
  }

  async function send(text: string) {
    setFailure(null);
    // 🔴 **這一步失敗就把例外丟回去給 `Composer`**，它才知道「沒送出去，字要留著」。
    // 在此之前 `Composer` 是先清空再送 —— 網路一斷，打過的字就真的沒了。
    let mine: Message;
    try {
      mine = await appendMessage(chatId, 'user', text);
    } catch (e) {
      setFailure({ message: e instanceof Error ? e.message : '送不出去', retryable: false });
      throw e;
    }

    /**
     * 🔴 **到這裡「送出」就完成了，不要等生成跑完才 resolve**
     * （Peter 2026-08-27：「輸入文字以後沒有正確的清空 input box」）。
     *
     * `Composer` 的判準是「`onSend` resolve ＝ 送出成功 ⇒ 清空輸入框」。
     * 而在此之前這支 `await` 了整段串流 ⇒ 輸入框要等模型**寫完整段回覆**才清空。
     * 使用者按下 Enter、字還留在框裡好幾秒 —— 看起來就是「沒送出去」，
     * 而他的下一個動作是再按一次。
     *
     * 🔴 **「送出成功」＝ 使用者那則訊息存下來了**（`appendMessage` 過了），
     * 不是「對方回完了」。生成失敗是另一件事，由失敗橫幅負責講。
     * ⇒ 串流不 await，在背景跑；錯誤照樣進 `setFailure`。
     */
    run([...messages, mine]);
  }

  /**
   * 不加新訊息、直接再生成一次（長按選單的「從這則重新生成」）。
   * 🔴 呼叫端要**先刪、再重讀**，把重讀回來的那份當 `base` 傳進來 —— 理由見 `run`。
   */
  function regenerate(base: Message[]) {
    setFailure(null);
    run(base);
  }
  function retry() {
    regenerate(messages); // 重送失敗當下的 local，真的重送，不只清橫幅（GAP-54）
  }
  /** 丟掉樂觀暫存，改讀伺服器那份。**切候選成功之後一定要叫它**（見檔頭 B1）。 */
  const reset = () => setLocal(null);
  const stop = () => abortRef.current?.abort(); // 停止生成（跨層票 H1／H6）：交給 catch 分支處理。

  /*
   * 🔴 `thinking`／`usage` 包成 `generation`——不是為了語意分組，是單純的行數：
   * `$chatId.tsx` 的呼叫端解構九個欄位就已經頂到 100 字元換行寬度，B4 加的
   * `usage` 會把它從兩行炸成十二行（一個屬性一行，biome 的格式）。包一層物件、
   * 欄位數不變，呼叫端拆出來也只多一行（`generation.thinking`／`.usage`）。
   */
  return {
    messages,
    streaming,
    generation: { thinking, usage },
    failureBanner,
    send,
    regenerate,
    reset,
    stop,
  };
}
