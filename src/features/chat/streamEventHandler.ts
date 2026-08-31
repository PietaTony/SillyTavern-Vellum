import type { Dispatch, SetStateAction } from 'react';
import type { Message, StreamEvent, Usage } from './model';

/**
 * `run()` 的 SSE callback 抽出來。**抽出來的理由**跟 `stopGeneration.ts` 一樣：
 * `useChatStream.ts` 在動工前就已經卡在 150 行上限（`origin/staging` 量過，149
 * 行），B4 加的 `recordUsage` 分支塞不進去，唯一乾淨的路是另開檔案，不是把既有
 * 註解砍薄——那條路第一輪做過、被獨立驗收退回。
 *
 * 純粹的「事件 → 該呼叫哪些 setter」對照表，不持有任何狀態——狀態還是活在
 * `useChatStream` 裡，這裡只是把長長的 if/else 挪出去。
 * 🔴 `acc` 是**共用的可變盒子**，不是回傳值：`run()` 的 catch 分支（使用者中止時）
 * 要讀到「已經吐出來的字」去組半成品訊息（`applyStopGeneration`），普通函式回傳值
 * 做不到這件事，只能靠呼叫端傳一個會被就地改寫的物件進來。
 */
/** 四個 setter 包一層——理由是行數，不是語意，見 `useChatStream.ts` 呼叫端的註解。 */
export type RunSetters = {
  setThinking: (v: boolean) => void;
  setStreaming: (v: string | null) => void;
  setLocal: Dispatch<SetStateAction<Message[] | null>>;
  setFailure: (v: string | null) => void;
};

export function makeRunEventHandler(opts: {
  base: Message[];
  onDone?: (() => Promise<unknown>) | undefined;
  acc: { value: string };
  setters: RunSetters;
  recordUsage: (u: Usage | undefined) => void;
}): (e: StreamEvent) => void {
  const { base, onDone, acc, recordUsage } = opts;
  const { setThinking, setStreaming, setLocal, setFailure } = opts.setters;
  return (e) => {
    if (e.type === 'delta') {
      // 🔴 正文一開始吐就不再說「思考中」——它已經在寫了。
      setThinking(false);
      acc.value += e.text;
      setStreaming(acc.value);
    } else if (e.type === 'thinking') {
      setThinking(true);
    } else if (e.type === 'done') {
      setThinking(false);
      setLocal((prev) => [...(prev ?? base), e.message]);
      setStreaming(null);
      recordUsage(e.usage); // B4：這一輪的用量讀數，理由見 `useGenerationUsage.ts`。
      /*
       * 🔴 **重讀成功才丟掉樂觀暫存。** 失敗就留著 —— 那一則訊息已經存下來了，
       * 把它換成（還沒重讀到的）伺服器那份等於當場讓剛剛的回覆消失。
       */
      if (onDone)
        void onDone().then(
          () => setLocal(null),
          () => {},
        );
    } else {
      setThinking(false);
      setStreaming(null);
      setFailure(e.message);
    }
  };
}
