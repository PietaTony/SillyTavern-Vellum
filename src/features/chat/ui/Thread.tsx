import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { Message } from '../model';
import type { MessageActions } from '../useRowActions';
import { useStickToBottom } from '../useStickToBottom';
import { useSwipeKeys } from '../useSwipeKeys';
import { type FrontendRenderer, MessageContent } from './MessageContent';
import { MessageRow } from './MessageRow';
import { ScrollToLatest } from './ScrollToLatest';
import { StopGenerating } from './StopGenerating';
import { ThemRow } from './ThemRow';
import { StreamCaret, Typing } from './Typing';

/**
 * 對話串。兩種形狀來自設計正本 `Foundations.dc.html` 的 Semantic 層：
 *   我的訊息 → `--bubble-me-line`：**D31 選 A3，描邊不是實底**，圓角 14
 *   他的回覆 → `--block-them-rule`：**沒有圓角、沒有容器**，只有一條左豎線
 * 兩個外框各自住 `MeRow`／`ThemRow`，一則訊息的完整長相在 `MessageRow`。
 *
 * 字型分工（乙案）：**內容襯線，介面無襯線**。這一區是「書」，所以走 SERIF。
 * 🔴 頭像用 `characterId` 現取，不把圖複製一份進對話。
 *
 * 🔴 **這一層不持有任何「某一則訊息」的狀態**：長按選單、編輯框、確認框都在
 * `MessageRow` 裡各自一份。放這裡的話一個 state 會被 N 則共用 ——
 * 按 A 開的選單會錨在 B 身上。
 */
export function Thread({
  messages,
  streaming,
  avatar,
  name,
  characterId,
  frontend,
  onSwipe,
  onAvatarClick,
  actions,
  thinking = false,
  onStop,
}: {
  messages: Message[];
  streaming: string | null;
  avatar?: string | undefined;
  name: string;
  /** 候選清單層要靠它去讀「這則開場會開啟幾條世界書」。沒給就只列候選文字。 */
  characterId?: string | undefined;
  /**
   * 🔴 卡片自己的前端區塊要畫成什麼 —— **由頁面決定**，這一層不認識 `cardscripts`
   * （相依方向的理由見 `MessageContent.tsx` 檔頭）。沒給就走引導卡。
   */
  frontend?: FrontendRenderer | undefined;
  onSwipe?: ((messageId: string, index: number) => void) | undefined;
  /** 沒給就不綁 —— 一顆點了沒反應的頭像比不能點更糟。 */
  onAvatarClick?: (() => void) | undefined;
  /** 長按一則訊息能做的四件事。沒給就不掛長按（見 `MessageRow`）。 */
  actions?: MessageActions | undefined;
  /**
   * 模型正在思考、但一個字都還沒吐（推理模型會先想十幾秒）。
   * 🔴 只影響那一列等待指示的**措辭**，不影響版面（見 `Typing`）。
   */
  thinking?: boolean;
  /**
   * 停止生成（跨層票 H1／H6，2026-08-28）。沒給就不掛那顆鈕——
   * 一顆按了沒反應的停止鈕比不能按更糟（同一套判準見 `onAvatarClick`）。
   */
  onStop?: (() => void) | undefined;
}) {
  // `←` `→` 切候選（ST 有，M12 G5）。掛在「最後一則有候選的訊息」上，同 ST 的 `.last_mes`。
  useSwipeKeys(messages, onSwipe);

  // 🔴 黏底規則照 LINE，四條判準在 `useStickToBottom`。這裡只定義「什麼算內容變了」：
  //    訊息數 ＋ 串流字數（串流時每一幀都變 ⇒ 黏住時每一幀跟著到底）。
  const stick = useStickToBottom(`${messages.length}:${streaming?.length ?? -1}`);

  // 🔴 只有第一則的候選是角色的開場白（`server/routes/chats.ts:73` 建的就只有它）。
  const firstId = messages[0]?.id;

  /**
   * 🔴 **等待要有動作。** 上一版是 `streaming || '⋯'` —— 一個**不會動的省略號**，
   * 在畫面上跟「當掉了」長得一模一樣，而推理模型先想十幾秒是常態
   *（Peter 2026-08-27）。有字之後接一個閃動游標，讓「還在寫」與「寫完了」分得出來。
   */
  const waiting = (
    <ThemRow key="streaming" avatar={avatar} name={name}>
      {streaming ? (
        <>
          <MessageContent text={streaming} frontend={frontend} />
          <StreamCaret />
        </>
      ) : (
        <Typing name={name} thinking={thinking} />
      )}
    </ThemRow>
  );

  return (
    /* 🔴 外面這一層不捲 —— 「回到最新」要浮在捲動區之上，放進去會跟著內容捲走。 */
    <Box sx={{ position: 'relative', height: '100%' }}>
      <Box
        ref={stick.ref}
        onScroll={stick.onScroll}
        sx={{ height: '100%', overflowY: 'auto', p: 2 }}
      >
        <Stack spacing={2.5}>
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              isGreeting={m.id === firstId}
              avatar={avatar}
              name={name}
              characterId={characterId}
              frontend={frontend}
              onSwipe={onSwipe}
              onAvatarClick={onAvatarClick}
              actions={actions}
            />
          ))}
          {streaming !== null ? waiting : null}
        </Stack>
      </Box>
      {stick.stuck ? null : <ScrollToLatest onClick={stick.toBottom} />}
      {streaming !== null && onStop ? <StopGenerating onClick={onStop} /> : null}
    </Box>
  );
}
