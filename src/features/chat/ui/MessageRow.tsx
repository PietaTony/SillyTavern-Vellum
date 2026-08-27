import Box from '@mui/material/Box';
import type { Message } from '../model';
import { useLongPress } from '../useLongPress';
import { type MessageActions, useRowActions } from '../useRowActions';
import { DangerConfirm } from './DangerConfirm';
import { MeRow } from './MeRow';
import { type FrontendRenderer, MessageContent } from './MessageContent';
import { MessageEditor } from './MessageEditor';
import { MessageMenu } from './MessageMenu';
import { SwipeBar } from './SwipeBar';
import { ThemRow } from './ThemRow';

/**
 * 一列訊息：外框 ＋ 內容 ＋ 長按能做的四件事
 *（Peter 2026-08-27：「久按、更改訊息這些功能都還沒有」）。
 *
 * 🔴 **`Thread` 不再自己畫訊息**：長按選單、編輯框、確認框都是**每一則各一份**的狀態，
 * 留在 `Thread` 裡就會變成「一個 state 服務 N 則」——按 A 開的選單，錨點卻是 B 的。
 *
 * 🔴 **沒有 `actions` 就完全不掛長按**（`useLongPress` 收到 `undefined` 回傳空物件）。
 * 一塊按了會反白、按了又沒選單的區域，比不能按更難懂。
 */
export function MessageRow({
  message,
  isGreeting,
  avatar,
  name,
  characterId,
  frontend,
  onSwipe,
  onAvatarClick,
  actions,
}: {
  message: Message;
  /** 這則是不是對話的第一則 —— 只有它的候選才是開場白（見 `SwipePicker`）。 */
  isGreeting: boolean;
  avatar?: string | undefined;
  name: string;
  characterId?: string | undefined;
  frontend?: FrontendRenderer | undefined;
  onSwipe?: ((messageId: string, index: number) => void) | undefined;
  onAvatarClick?: (() => void) | undefined;
  actions?: MessageActions | undefined;
}) {
  const r = useRowActions(message.id, message.text, actions);
  const press = useLongPress(actions ? r.setAt : undefined);

  const body = r.editing ? (
    <MessageEditor
      messageId={message.id}
      text={message.text}
      busy={r.busy}
      onCancel={() => r.setEditing(false)}
      onSave={r.save}
    />
  ) : (
    /*
     * 🔴 **只在觸控裝置關掉選字**（`pointer: coarse`）。iOS 長按文字會跳自己的
     * 選取／「拷貝」浮層，跟我們的選單疊在一起；桌機沒有這個衝突，
     * 把選字一起關掉只會害人不能反白讀過的段落。
     */
    <Box
      {...press}
      sx={{ '@media (pointer: coarse)': { userSelect: 'none', WebkitTouchCallout: 'none' } }}
    >
      <MessageContent text={message.text} frontend={frontend} />
    </Box>
  );

  const regen = r.pending === 'regenerate';
  const menus = actions ? (
    <>
      <MessageMenu
        at={r.at}
        canRegenerate={message.role === 'model'}
        onClose={() => r.setAt(null)}
        onEdit={() => r.setEditing(true)}
        onCopy={r.copy}
        onDelete={() => r.setPending('delete')}
        onRegenerate={() => r.setPending('regenerate')}
      />
      <DangerConfirm
        open={r.pending !== null}
        busy={r.busy}
        title={regen ? '從這則重新生成？' : '刪掉這則訊息？'}
        body={
          regen
            ? '這則與它之後的訊息都會被刪掉，然後重新生成一次。刪掉的救不回來。'
            : '只刪這一則，救不回來。'
        }
        confirmLabel={regen ? '刪掉並重生成' : '刪除'}
        onClose={() => r.setPending(null)}
        onConfirm={r.confirm}
      />
    </>
  ) : null;

  if (message.role === 'user')
    return (
      <>
        <MeRow>{body}</MeRow>
        {menus}
      </>
    );

  return (
    <ThemRow avatar={avatar} name={name} onAvatarClick={onAvatarClick}>
      {/*
       * 🔴 `SwipeBar` 是把內容**包起來**、上下各一條置中（Peter 2026-08-27）——
       * 開場白那種一整頁的訊息，只有下面一條時要一路捲到底才切得動。
       */}
      {onSwipe ? (
        <SwipeBar
          message={message}
          characterId={characterId}
          isGreeting={isGreeting}
          onSwipe={onSwipe}
        >
          {body}
        </SwipeBar>
      ) : (
        body
      )}
      {menus}
    </ThemRow>
  );
}
