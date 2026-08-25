import type { Message } from '../model';

/**
 * markup 逐字抄自 `Chat-Thread-Layout--5`：
 *   他的回覆 → `v-msg-group`（`v-avatar--sm` ＋ `v-msg-group__body`）> `v-msg v-msg--narration`
 *   我的訊息 → `vx-row` > `v-msg v-msg--mine`
 *
 * 🔴 頭像用 `characterId` 現取，**不把圖複製一份進對話**——
 * 那會是每段對話多帶一份 149 KB 的 base64，而且角色換圖之後對話裡那份就過期了。
 *
 * 🔴 `v-msg--dialogue` 存在於設計正本，但 D31 的兩區塊交錯**已暫緩**
 * （Peter 2026-08-25 判定體驗問題，見 `SPEC §10`）⇒ 他的回覆整則走 `v-msg--narration`。
 */
function Avatar({ src, name }: { src: string | undefined; name: string }) {
  return src ? (
    <div className="v-avatar v-avatar--sm vx-upload">
      <img src={src} alt={name} />
    </div>
  ) : (
    <div className="v-avatar v-avatar--sm is-empty" />
  );
}

function AiTurn({
  text,
  avatar,
  name,
}: {
  text: string;
  avatar: string | undefined;
  name: string;
}) {
  return (
    <div className="v-msg-group">
      <Avatar src={avatar} name={name} />
      <div className="v-msg-group__body">
        <div className="v-msg v-msg--narration">{text}</div>
      </div>
    </div>
  );
}

export function Thread({
  messages,
  streaming,
  avatar,
  name,
}: {
  messages: Message[];
  streaming: string | null;
  avatar?: string | undefined;
  name: string;
}) {
  return (
    <div className="v-thread">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div className="vx-row" key={m.id}>
            <div className="v-msg v-msg--mine">{m.text}</div>
          </div>
        ) : (
          <AiTurn key={m.id} text={m.text} avatar={avatar} name={name} />
        ),
      )}
      {streaming !== null ? <AiTurn text={streaming || '⋯'} avatar={avatar} name={name} /> : null}
    </div>
  );
}
