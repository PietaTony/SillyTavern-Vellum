/**
 * 卡片想動訊息時該發生什麼（2026-08-27，敵意驗收後改寫）。
 *
 * 🔴 **2026-08-27 起開放改訊息文字。** 擋它的理由一直是「後端沒有對應端點」，
 * 而 `PATCH /api/chats/:id/messages/:messageId` 已於 v0.2.12 上線 ⇒ 理由消失了。
 * ⚠️ 連帶要改的是**文案**：原本那兩句「Vellum 不開放改寫對話紀錄」現在會是**謊話**，
 * 而留著一句過期的拒絕比沒有訊息更糟 —— 它會讓下一個人以為這是刻意的policy。
 *
 * 這一支管的仍然是**失敗的方式**：說得出是誰、說的是實話。
 *
 * 🔴 **三條敵意驗收抓到的，逐條記在這裡，不要改回去**：
 * ① **文案說謊**：上一版對 `setChatMessage('文字', 1, {swipe_id:1})` 說「這次沒有任何變更」，
 *    但那次呼叫**真的切了候選**。⇒ 現在文字與候選分開講。
 * ② **跨對話永久靜默**：去重的 key 沒有帶對話 ⇒ 換一段對話之後、同一個 `message_id`
 *    **再也不會出聲**。⇒ key 帶 `chatId`。
 * ③ **只有改文字這一種失敗會出聲**：`{message_id:99, swipe_id:1}`（訊息不存在）、
 *    `{message_id:0}`（沒指定候選）全都靜默 no-op。⇒ 四種失敗各有各的話。
 *
 * ⚠️ **一則訊息的每一種失敗只講一次**：那支腳本是每收到一則訊息就呼叫一次，
 * 不去重的話 console 會被洗版，而洗版的警告等於沒有警告。
 */

/** 卡片送進來的一筆更新。 */
export type MessageUpdate = { message_id?: number; swipe_id?: number; message?: unknown };

/**
 * 這一筆想改文字嗎。
 * 🔴 **判準是「有沒有給」不是「是不是字串」**：上一版只認 `typeof === 'string'`，
 * 於是 `setChatMessage({text:'x'}, 1)` 這種**照樣被靜默丟掉**。
 * 現在「有給但不是字串」會走 `bad-text` 出聲，不再是靜默 no-op。
 */
export const wantsTextEdit = (u: MessageUpdate | undefined): boolean => u?.message !== undefined;

/**
 * 取出真的可以送出去的那段文字；拿不到回 `undefined`。
 * 🔴 後端要求非空（`z.string().min(1)`），所以只有空白的也算拿不到 ——
 * **在這裡擋掉才說得出原因**，送出去只會拿到一句 400。
 */
export const textOf = (u: MessageUpdate | undefined): string | undefined => {
  if (typeof u?.message !== 'string') return undefined;
  const t = u.message.trim();
  return t === '' ? undefined : t;
};

/** 這一筆真的做得到事嗎（＝有指定要切到第幾個候選）。 */
export const isActionable = (u: MessageUpdate | undefined): boolean =>
  typeof u?.swipe_id === 'number';

/**
 * 擋下的三種情形。每一種的說法不一樣 —— 講錯就是說謊。
 * ⚠️ 少掉的 `text-only`／`text-with-swipe` 是刻意的：那兩種現在**會成功**。
 */
export type Blocked =
  /** 指到的那一則不存在。 */
  | { kind: 'no-target'; total: number }
  /** 說要改文字，但給的不是一段可用的文字（物件、空白、只有空格）。 */
  | { kind: 'bad-text' }
  /** 既沒要改文字、也沒指定候選 —— 這通常是呼叫端的 bug。 */
  | { kind: 'nothing' };

const SAID = new Set<string>();

const wordsFor = (b: Blocked): string => {
  switch (b.kind) {
    case 'bad-text':
      return '但給的內容不是一段文字（或只有空白），這次沒有任何變更。';
    case 'no-target':
      return `這段對話只有 ${b.total} 則訊息，找不到那一則，這次沒有任何變更。`;
    default:
      return '但沒有指定要切換到第幾個候選（swipe_id），這次沒有任何變更。';
  }
};

const verbFor = (b: Blocked): string => (b.kind === 'bad-text' ? '改' : '動');

/**
 * 說出「哪一段對話、哪一支、哪一則、發生了什麼」。
 * 🔴 `messageId` 要傳**實際定位到的那一則**（呼叫端已經套過 `?? 0`），
 * 不可以印 `?` —— 印 `?` 而實際動的是第 0 則，是另一種說謊。
 */
function say(chatId: string, fn: string, messageId: number, b: Blocked): void {
  const key = `${chatId}:${fn}:${messageId}:${b.kind}`;
  if (SAID.has(key)) return;
  SAID.add(key);
  console.warn(
    `[卡片腳本] 這張卡想用 ${fn}() ${verbFor(b)}第 ${messageId} 則訊息 —— ${wordsFor(b)}`,
  );
}

/**
 * 卡片動訊息的那條路 —— **判準、文案、要不要重讀，全收在這裡**。
 *
 * 🔴 卡片用 `setChatMessages` 做兩件事：改訊息文字、**切候選**。我們只接後者。
 *
 * 🔴 **每一種做不到的情形都要出聲**（敵意驗收 2026-08-27）。上一版只有「改文字」會講話，
 * 「指到不存在的那一則」與「沒指定候選」全是靜默 no-op —— 那還是靜默失敗，只是換了位置。
 *
 * 🔴 **切完不再自己 refresh** —— `deps.swipe` 那條路自己就會重讀（見 `bridge.ts` 的 `swipe`）。
 * ⚠️ 這也順帶解掉「一筆成功、下一筆拋錯 ⇒ 狀態已變卻不重讀」：
 *    每一筆成功當下就重讀過了，例外逸出時畫面已經是對的。
 */
export function makeApplyUpdates(deps: {
  chatId: string;
  messages: () => { id: string }[];
  swipe: (messageId: string, index: number) => Promise<unknown>;
  /** 改一則訊息的文字。🔴 後端會連 `swipes[swipeIndex]` 一起寫回（見 `server/lib/messageEdit.ts`）。 */
  edit: (messageId: string, text: string) => Promise<unknown>;
}): {
  /** `fn` ＝ 使用者實際叫的那一支名字；出事時要說得出來（預設 `setChatMessages`）。 */
  applyUpdates: (updates: unknown, fn?: string) => Promise<void>;
  reportBlocked: (fn: string, messageId: number, b: Blocked) => void;
} {
  const reportBlocked = (fn: string, messageId: number, b: Blocked): void =>
    say(deps.chatId, fn, messageId, b);

  const applyUpdates = async (updates: unknown, fn = 'setChatMessages'): Promise<void> => {
    const list = (Array.isArray(updates) ? updates : [updates]) as MessageUpdate[];
    const msgs = deps.messages();
    for (const u of list) {
      // 🔴 印**實際定位到的那一則**（`?? 0`），不是 `?` —— 印 `?` 而動的是第 0 則也是說謊。
      const id = u?.message_id ?? 0;
      const target = msgs[id];
      const texting = wantsTextEdit(u);
      const text = textOf(u);
      if (!target) {
        reportBlocked(fn, id, { kind: 'no-target', total: msgs.length });
        continue;
      }
      if (texting && text === undefined) {
        reportBlocked(fn, id, { kind: 'bad-text' });
        continue;
      }
      if (!texting && !isActionable(u)) {
        reportBlocked(fn, id, { kind: 'nothing' });
        continue;
      }
      // 🔴 **先切候選再改文字**：後端寫的是「目前站著的那一則候選」，
      // 反過來的話字會寫進切換前的那一則，然後被切換蓋掉。
      if (isActionable(u)) await deps.swipe(target.id, u.swipe_id as number);
      if (text !== undefined) await deps.edit(target.id, text);
    }
  };
  return { applyUpdates, reportBlocked };
}

/** 測試用：清掉去重狀態。🔴 不清的話第二條測試會因為第一條已經講過而看不到警告。 */
export const resetTextEditWarnings = (): void => SAID.clear();
