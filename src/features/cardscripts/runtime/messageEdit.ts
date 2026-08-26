/**
 * 卡片想動訊息時該發生什麼（2026-08-27，敵意驗收後改寫）。
 *
 * 🔴 **我們不開放改訊息文字**（竄改對話紀錄，後端也沒有對應端點，只有切候選的 swipe）。
 * 這一支管的是**失敗的方式**：從「假裝成功還順便空轉」變成「說得出是誰、說的是實話」。
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
 */
export const wantsTextEdit = (u: MessageUpdate | undefined): boolean => u?.message !== undefined;

/** 這一筆真的做得到事嗎（＝有指定要切到第幾個候選）。 */
export const isActionable = (u: MessageUpdate | undefined): boolean =>
  typeof u?.swipe_id === 'number';

/** 擋下的四種情形。每一種的說法不一樣 —— 講錯就是說謊。 */
export type Blocked =
  /** 只想改文字，什麼都沒發生。 */
  | { kind: 'text-only' }
  /** 想改文字，但同時也切了候選 —— **候選真的切了**，不可以說「沒有任何變更」。 */
  | { kind: 'text-with-swipe' }
  /** 指到的那一則不存在。 */
  | { kind: 'no-target'; total: number }
  /** 既沒要改文字、也沒指定候選 —— 這通常是呼叫端的 bug。 */
  | { kind: 'nothing' };

const SAID = new Set<string>();

const wordsFor = (b: Blocked): string => {
  switch (b.kind) {
    case 'text-only':
      return 'Vellum 不開放改寫對話紀錄，這次沒有任何變更。（切換候選 swipe 仍然可以）';
    case 'text-with-swipe':
      return 'Vellum 不開放改寫對話紀錄 —— 文字沒有變，這次只切換了候選。';
    case 'no-target':
      return `這段對話只有 ${b.total} 則訊息，找不到那一則，這次沒有任何變更。`;
    default:
      return '但沒有指定要切換到第幾個候選（swipe_id），這次沒有任何變更。';
  }
};

const verbFor = (b: Blocked): string =>
  b.kind === 'nothing' || b.kind === 'no-target' ? '動' : '改';

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
}): {
  applyUpdates: (updates: unknown) => Promise<void>;
  reportBlocked: (fn: string, messageId: number, b: Blocked) => void;
} {
  const reportBlocked = (fn: string, messageId: number, b: Blocked): void =>
    say(deps.chatId, fn, messageId, b);

  const applyUpdates = async (updates: unknown): Promise<void> => {
    const list = (Array.isArray(updates) ? updates : [updates]) as MessageUpdate[];
    const msgs = deps.messages();
    for (const u of list) {
      // 🔴 印**實際定位到的那一則**（`?? 0`），不是 `?` —— 印 `?` 而動的是第 0 則也是說謊。
      const id = u?.message_id ?? 0;
      const target = msgs[id];
      const texting = wantsTextEdit(u);
      if (!target) {
        reportBlocked('setChatMessages', id, { kind: 'no-target', total: msgs.length });
        continue;
      }
      if (!isActionable(u)) {
        reportBlocked('setChatMessages', id, { kind: texting ? 'text-only' : 'nothing' });
        continue;
      }
      if (texting) reportBlocked('setChatMessages', id, { kind: 'text-with-swipe' });
      await deps.swipe(target.id, u.swipe_id as number);
    }
  };
  return { applyUpdates, reportBlocked };
}

/** 測試用：清掉去重狀態。🔴 不清的話第二條測試會因為第一條已經講過而看不到警告。 */
export const resetTextEditWarnings = (): void => SAID.clear();
