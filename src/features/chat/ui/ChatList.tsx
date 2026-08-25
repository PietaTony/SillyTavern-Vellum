import { byRecency, lastActivityAt, previewOf, relativeTime } from '../list';
import type { Chat } from '../model';

/**
 * markup 逐字抄自 `Friends-And-Cards--1`：
 *   `v-listrow` > `v-avatar` ＋（`v-listrow__name` ／ `v-listrow__preview`）＋ `v-listrow__time`
 *
 * 🔴 只做「最近聊天」這一層。設計正本同一張圖上的**下拉搜尋**（`--1`）、
 * **左滑封存／刪除**（`--2`）、**右滑釘選**（`--3`）都還沒做，不要假裝有。
 *
 * 🔴 頭像跟 `Thread` 一樣現取 —— 對話檔裡不存 base64。
 */
export type ChatListItem = { chat: Chat; avatar: string | undefined };

function Row({
  item,
  now,
  onOpen,
}: {
  item: ChatListItem;
  now: Date;
  onOpen: (id: string) => void;
}) {
  const { chat, avatar } = item;
  const empty = chat.messages.length === 0;
  return (
    <button
      type="button"
      className={empty ? 'v-listrow vx-rowbtn is-empty' : 'v-listrow vx-rowbtn'}
      onClick={() => onOpen(chat.id)}
    >
      {avatar ? (
        <div className="v-avatar vx-upload">
          <img src={avatar} alt={chat.characterName} />
        </div>
      ) : (
        <div className="v-avatar is-empty" />
      )}
      <div className="vx-grow">
        <div className="v-listrow__name vx-truncate">{chat.characterName}</div>
        <div className="v-listrow__preview vx-truncate">{previewOf(chat)}</div>
      </div>
      <div className="v-listrow__time">{relativeTime(lastActivityAt(chat), now)}</div>
    </button>
  );
}

export function ChatList({
  items,
  now,
  onOpen,
}: {
  items: ChatListItem[];
  now: Date;
  onOpen: (chatId: string) => void;
}) {
  return (
    <div className="vx-stack">
      {byRecency(items.map((i) => i.chat)).map((chat) => {
        const item = items.find((i) => i.chat.id === chat.id);
        return item ? <Row key={chat.id} item={item} now={now} onOpen={onOpen} /> : null;
      })}
    </div>
  );
}
