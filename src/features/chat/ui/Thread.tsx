import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { Message } from '../model';
import { useSwipeKeys } from '../useSwipeKeys';
import { type FrontendRenderer, MessageContent } from './MessageContent';
import { SwipeBar } from './SwipeBar';

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
}) {
  // `←` `→` 切候選（ST 有，M12 G5）。掛在「最後一則有候選的訊息」上，同 ST 的 `.last_mes`。
  useSwipeKeys(messages, onSwipe);

  // 🔴 只有第一則的候選是角色的開場白（`server/routes/chats.ts:73` 建的就只有它）。
  const firstId = messages[0]?.id;

  const theirs = (key: string, text: string, message?: Message) => (
    <Stack key={key} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      {/*
       * 🔴 **點頭像進角色設定**（Peter 2026-08-26）。
       * ⚠️ ST 點下去是開一張放大圖浮窗（實查 `script.js:12165`），**不是面板** ——
       * 這一條是我們自己加的，不是照抄。
       * 🔴 沒有 `onAvatarClick` 時**不可以看起來能點**：沒有游標變化、沒有 aria-label。
       */}
      <Avatar
        src={avatar}
        alt={name}
        {...(onAvatarClick
          ? {
              component: 'button' as const,
              type: 'button' as const,
              'aria-label': `${name} 的角色設定`,
              onClick: onAvatarClick,
            }
          : {})}
        sx={{
          width: 32,
          height: 32,
          mt: 0.5,
          flex: 'none',
          ...(onAvatarClick ? { cursor: 'pointer', border: 0, p: 0 } : {}),
        }}
      >
        {name.slice(0, 1)}
      </Avatar>
      <Box sx={{ borderLeft: 2, borderColor: 'vellum.blockThemRule', pl: 1.5, flex: 1 }}>
        <Content text={text} frontend={frontend} />
        {message && onSwipe ? (
          <SwipeBar
            message={message}
            characterId={characterId}
            isGreeting={message.id === firstId}
            onSwipe={onSwipe}
          />
        ) : null}
      </Box>
    </Stack>
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
        {streaming !== null ? theirs('streaming', streaming || '⋯') : null}
      </Stack>
    </Box>
  );
}
