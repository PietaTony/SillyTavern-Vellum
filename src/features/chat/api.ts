import { del, get, patch, post } from '@/shared/lib/http';
import { type Chat, type Message, parseSse, type StreamEvent } from './model';

/**
 * 桌寵開關（E1）。**全域設定，不分對話** —— 端點借住在 `/api/chats/settings/companion`
 * （理由見 `server/routes/companionSettings.ts` 檔頭），路徑長得像對話底下的東西，
 * 語意其實不是。
 */
export const fetchCompanionEnabled = (): Promise<{ enabled: boolean }> =>
  get('/api/chats/settings/companion');
export const setCompanionEnabled = (enabled: boolean): Promise<{ enabled: boolean }> =>
  patch('/api/chats/settings/companion', { enabled });

export const fetchChats = (): Promise<Chat[]> => get<Chat[]>('/api/chats');
export const fetchChat = (id: string): Promise<Chat> => get<Chat>(`/api/chats/${id}`);
/**
 * `greetingIndex` ＝ 開場時**先站在哪一則候選**。省略＝第一則。
 * ⚠️ M12 起**沒有人會傳它**：進對話不再有選開場關卡，一律從第一則開始、進去再左右切。
 * 參數留著是因為端點語意仍然成立（「從第 N 則開場」），刪掉會讓 API 少一個維度。
 */
export const createChat = (characterId: string, greetingIndex?: number): Promise<Chat> =>
  post<Chat>('/api/chats', {
    characterId,
    ...(greetingIndex === undefined ? {} : { greetingIndex }),
  });

/**
 * 切換某則訊息的候選。
 * 🔴 **回傳帶 `lore`**：開場白切換會連帶重算世界書開關（驗收 B3），
 * 呼叫端要看得到「這一切真的有作用」，不然使用者只會覺得「字換了而已」。
 */
export type SwipeResult = {
  id: string;
  swipeIndex: number;
  text: string;
  lore: {
    include: string[];
    exclude: string[];
    changed: number;
    dangling: string[];
    /** 🔴 因為「切換」而被關掉的別條線專屬條目（GAP-120）。空陣列 ＝ 沒有別條線要讓位。 */
    turnedOff: string[];
  } | null;
};
/**
 * 🔴 卡片腳本的變數（淺層合併）。桌寵把自己的尺寸存在這裡 ——
 * 在此之前我們沒有存變數的地方，於是它每次讀回來都是空的（見 `cardscripts/runtime/vars.ts`）。
 */
export const patchChatVariables = (
  chatId: string,
  vars: Record<string, unknown>,
): Promise<{ variables: Record<string, unknown> }> =>
  patch(`/api/chats/${chatId}/variables`, { patch: vars });

export const swipeMessage = (
  chatId: string,
  messageId: string,
  index: number,
): Promise<SwipeResult> =>
  patch<SwipeResult>(`/api/chats/${chatId}/messages/${messageId}/swipe`, { index });
export const appendMessage = (
  chatId: string,
  role: 'user' | 'model',
  text: string,
): Promise<Message> => post<Message>(`/api/chats/${chatId}/messages`, { role, text });

/**
 * 改一則訊息的內容。**兩種 role 都能改**（ST 也是）。
 *
 * 🔴 有候選的訊息，後端會**同時寫回 `swipes[swipeIndex]`**，不是只改 `text` ——
 * 不然改完切走再切回來，改動會被 `swipes[i]` 蓋掉
 *（判準與測試在 `server/lib/messageEdit.ts`）。沒有候選時 `swipeIndex` 是 `null`。
 */
export type EditedMessage = { id: string; text: string; swipeIndex: number | null };
export const editMessage = (
  chatId: string,
  messageId: string,
  text: string,
): Promise<EditedMessage> =>
  patch<EditedMessage>(`/api/chats/${chatId}/messages/${messageId}`, { text });

/**
 * 刪一則訊息；`cascade` 時連同**它之後的全部**一起刪
 *（「從這則重新生成」要用它，不然新回覆會接在舊回覆後面，變成同一段講兩次）。
 *
 * ⚠️ 回傳的 `deleted` 是**真的被刪掉的 id、依原順序**，不是「請求刪哪些」。
 * 🔴 後端會擋下「把整段對話刪光」並回 400 ＋ 一句人看得懂的話（`ApiError.message`
 * 會原文顯示）—— 擋的是「刪完還剩幾則」，不是「這則是不是開場白」。
 */
export const deleteMessage = (
  chatId: string,
  messageId: string,
  opts: { cascade?: boolean } = {},
): Promise<{ deleted: string[] }> =>
  del<{ deleted: string[] }>(
    `/api/chats/${chatId}/messages/${messageId}${opts.cascade ? '?cascade=1' : ''}`,
  );

/**
 * 生成。🔴 **不是 `EventSource`** —— 它只支援 GET、也沒辦法帶 body。
 * 走 `fetch` ＋ `response.body` 的 reader 迴圈，中止靠 `AbortController`。
 */
export async function streamGenerate(
  chatId: string,
  onEvent: (e: StreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId }),
    signal,
  });
  if (!res.ok || !res.body) {
    const t = await res.text();
    onEvent({ type: 'error', message: t.slice(0, 300) || `HTTP ${res.status}` });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const { events, rest } = parseSse(buf);
    buf = rest;
    for (const e of events) onEvent(e);
  }
}
