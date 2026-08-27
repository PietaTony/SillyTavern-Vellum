import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { Message } from '../model';
import { useSwipeKeys } from '../useSwipeKeys';
import { type FrontendRenderer, MessageContent } from './MessageContent';
import { SwipeBar } from './SwipeBar';
import { ThemRow } from './ThemRow';
import { StreamCaret, Typing } from './Typing';

/**
 * 對話串。兩種形狀來自設計正本 `Foundations.dc.html` 的 Semantic 層：
 *   我的訊息 → `--bubble-me-line`：**D31 選 A3，描邊不是實底**，圓角 14
 *   他的回覆 → `--block-them-rule`：**沒有圓角、沒有容器**，只有一條左豎線
 * 🔴 上一版兩邊都做成實底氣泡，那是 Material 的預設長相，不是這個產品的。
 *
 * 字型分工（乙案）：**內容襯線，介面無襯線**。這一區是「書」，所以走 SERIF。
 * 🔴 頭像用 `characterId` 現取，不把圖複製一份進對話。
 */
function Content({ text, frontend }: { text: string; frontend?: FrontendRenderer | undefined }) {
  /**
   * 🔴 **M13 第一期：從「純文字」改成「markdown ＋ 淨化後的 HTML」。**
   * 在此之前這裡是 `whiteSpace: pre-wrap` 的純文字，而且後端還先把 HTML 壓平
   * ⇒ 卡片的狀態欄、表格、粗體、程式碼區塊全部變成一整片沒有結構的字。
   * 淨化在 `render/html.ts`，那是唯一一處 `dangerouslySetInnerHTML`。
   */
  return <MessageContent text={text} frontend={frontend} />;
}

export function Thread({
  messages,
  streaming,
  avatar,
  name,
  characterId,
  frontend,
  onSwipe,
  onAvatarClick,
  thinking = false,
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
  /**
   * 模型正在思考、但一個字都還沒吐（推理模型會先想十幾秒）。
   * 🔴 只影響那一列等待指示的**措辭**，不影響版面（見 `Typing`）。
   */
  thinking?: boolean;
}) {
  // `←` `→` 切候選（ST 有，M12 G5）。掛在「最後一則有候選的訊息」上，同 ST 的 `.last_mes`。
  useSwipeKeys(messages, onSwipe);

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
          <Content text={streaming} frontend={frontend} />
          <StreamCaret />
        </>
      ) : (
        <Typing name={name} thinking={thinking} />
      )}
    </ThemRow>
  );

  const theirs = (key: string, text: string, message?: Message) => (
    <ThemRow key={key} avatar={avatar} name={name} onAvatarClick={onAvatarClick}>
      {/*
       * 🔴 **`SwipeBar` 是把內容「包起來」，不是掛在下面。**
       * 上下各一條置中（Peter 2026-08-27）—— 開場白那種一整頁的訊息，
       * 只有下面一條時要一路捲到底才切得動。
       */}
      {message && onSwipe ? (
        <SwipeBar
          message={message}
          characterId={characterId}
          isGreeting={message.id === firstId}
          onSwipe={onSwipe}
        >
          <Content text={text} frontend={frontend} />
        </SwipeBar>
      ) : (
        <Content text={text} frontend={frontend} />
      )}
    </ThemRow>
  );

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 2 }}>
      <Stack spacing={2.5}>
        {messages.map((m) =>
          m.role === 'user' ? (
            <Box key={m.id} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box
                sx={{
                  maxWidth: '78%',
                  px: 1.5,
                  py: 1,
                  border: 1,
                  borderColor: 'vellum.bubbleMeLine',
                  borderRadius: (t) => `${t.palette.vellum.radiusBubble}px`,
                }}
              >
                <Content text={m.text} frontend={frontend} />
              </Box>
            </Box>
          ) : (
            theirs(m.id, m.text, m)
          ),
        )}
        {streaming !== null ? waiting : null}
      </Stack>
    </Box>
  );
}
