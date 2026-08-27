import Box from '@mui/material/Box';
import { type ReactNode, useMemo } from 'react';
import { SERIF } from '@/app/theme';
import { segments } from '../render/frontend';
import { toHtml } from '../render/html';
import { FrontendNotice } from './FrontendNotice';

/**
 * 一則訊息的內容（M13 第一期）。
 *
 * 🔴 **在此之前訊息是當純文字印的**，而後端還先把 HTML 壓平
 * （`server/lib/renderChat.ts` 的 `htmlToText`，那支的檔頭自己寫著「這是過渡措施，等 U7」）。
 * 結果是卡片的狀態欄、表格、粗體、程式碼區塊**全部變成一整片沒有結構的字**。
 * ⇒ 現在後端不壓平了，這裡負責 markdown ＋ 淨化 ＋ 渲染。
 *
 * 🔴 **`dangerouslySetInnerHTML` 是刻意的，而且只在這一處。**
 * 內容來自網路上的角色卡 ⇒ 唯一的防線是 `toHtml()` 裡的 DOMPurify。
 * **不要在別的地方複製這個模式**：多一個入口就多一條沒被淨化的路。
 *
 * 🔴 **前端區塊怎麼呈現由呼叫端決定（`frontend`），這裡不直接用 `cardscripts`。**
 * 理由是相依方向：`cardscripts/runtime/bridge.ts` 要 import `@/features/chat` 的型別，
 * 反過來再 import 回去就是**循環相依**（閘門 A2 會擋，而且擋得對）。
 * ⇒ 頁面負責決定「跑它（`ScriptFrame`）還是先問（`FrontendNotice`）」，這一層只管切段。
 */

/** 一段前端區塊要畫成什麼。沒給就走引導卡（不執行、不印原始碼）。 */
/**
 * 🔴 **`messageId` 是給 `getCurrentMessageId()` 用的**（GAP-121）。
 * `index` 是**訊息內第幾個區塊**，不是第幾則訊息 —— 兩個都要，而且不能互相代替。
 */
export type FrontendRenderer = (part: {
  code: string;
  index: number;
  messageId: string;
}) => ReactNode;

export function MessageContent({
  text,
  frontend,
  messageId = '',
}: {
  text: string;
  frontend?: FrontendRenderer | undefined;
  /** 這段內容屬於哪一則訊息。串流中的暫存內容沒有 id ⇒ 空字串。 */
  messageId?: string;
}) {
  // 訊息很長（實測那張卡的開場白上萬字），每次 render 都重跑 markdown 會卡。
  const parts = useMemo(
    () => segments(text).map((s) => (s.kind === 'text' ? { ...s, html: toHtml(s.text) } : s)),
    [text],
  );

  return (
    <Box
      sx={{
        fontFamily: SERIF,
        wordBreak: 'break-word',
        // markdown 產出的元素要有合理的間距，否則整段會黏成一團。
        '& p': { my: 1 },
        '& p:first-of-type': { mt: 0 },
        '& p:last-of-type': { mb: 0 },
        '& pre': {
          my: 1,
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.hover',
          overflowX: 'auto',
          fontSize: '0.85em',
        },
        '& code': { fontFamily: 'ui-monospace, SFMono-Regular, monospace' },
        '& table': { borderCollapse: 'collapse', my: 1, display: 'block', overflowX: 'auto' },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5 },
        '& blockquote': { my: 1, ml: 0, pl: 1.5, borderLeft: 2, borderColor: 'divider' },
        '& img': { maxWidth: '100%', height: 'auto' },
        '& hr': { border: 0, borderTop: 1, borderColor: 'divider', my: 1.5 },
      }}
    >
      {parts.map((p, i) =>
        p.kind === 'frontend' ? (
          // 候選的順序就是它的身分，這裡同理：段落在訊息裡的位置就是它的 key。
          // biome-ignore lint/suspicious/noArrayIndexKey: 段落沒有別的主鍵，而且順序就是身分
          <Box key={`f${i}`}>
            {frontend?.({ code: p.code, index: i, messageId }) ?? (
              <FrontendNotice bytes={p.code.length} />
            )}
          </Box>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同上
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 唯一入口，已過 DOMPurify（見檔頭）
          <Box key={`t${i}`} dangerouslySetInnerHTML={{ __html: p.html }} />
        ),
      )}
    </Box>
  );
}
