import { useRef, useState } from 'react';
import { appendMessage, streamGenerate } from './api';
import type { Message } from './model';

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
export function useChatStream(chatId: string, fromServer: Message[] | undefined) {
  const [local, setLocal] = useState<Message[] | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = local ?? fromServer ?? [];

  async function send(text: string) {
    setFailure(null);
    // 🔴 **這一步失敗就把例外丟回去給 `Composer`**，它才知道「沒送出去，字要留著」。
    // 在此之前 `Composer` 是先清空再送 —— 網路一斷，打過的字就真的沒了。
    let mine: Message;
    try {
      mine = await appendMessage(chatId, 'user', text);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '送不出去');
      throw e;
    }
    setLocal([...messages, mine]);
    setStreaming('');

    const ac = new AbortController();
    abortRef.current = ac;
    let acc = '';
    await streamGenerate(
      chatId,
      (e) => {
        if (e.type === 'delta') {
          acc += e.text;
          setStreaming(acc);
        } else if (e.type === 'done') {
          setLocal((prev) => [...(prev ?? []), e.message]);
          setStreaming(null);
        } else {
          setStreaming(null);
          setFailure(e.message);
        }
      },
      ac.signal,
    );
  }

  /** 丟掉樂觀暫存，改讀伺服器那份。**切候選成功之後一定要叫它**（見檔頭 B1）。 */
  const reset = () => setLocal(null);

  return { messages, streaming, failure, setFailure, send, reset };
}
