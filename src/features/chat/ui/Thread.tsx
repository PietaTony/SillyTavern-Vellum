import type { Message } from '../model';

/**
 * markup 逐字抄自 `Chat-Thread-Layout--5`：
 *   他的回覆 → `v-msg-group`（`v-avatar--sm` ＋ `v-msg-group__body`）> `v-msg v-msg--narration`
 *   我的訊息 → `vx-row` > `v-msg v-msg--mine`
 *
 * 🔴 `v-msg--dialogue` 存在於設計正本，但 **D31 的兩區塊交錯已暫緩**
 * （Peter 2026-08-25 判定體驗問題，見 `SPEC §10`）⇒ 他的回覆整則走 `v-msg--narration`。
 * 切分規則仍在 `../blocks.ts`（7 個測試），要恢復把 `splitBlocks()` 接回來即可。
 */
function AiTurn({ text }: { text: string }) {
  return (
    <div className="v-msg-group">
      <div className="v-avatar v-avatar--sm is-empty" />
      <div className="v-msg-group__body">
        <div className="v-msg v-msg--narration">{text}</div>
      </div>
    </div>
  );
}

export function Thread({ messages, streaming }: { messages: Message[]; streaming: string | null }) {
  return (
    <div className="v-thread">
      {messages.map((m) =>
        m.role === 'user' ? (
          <div className="vx-row" key={m.id}>
            <div className="v-msg v-msg--mine">{m.text}</div>
          </div>
        ) : (
          <AiTurn key={m.id} text={m.text} />
        ),
      )}
      {streaming !== null ? <AiTurn text={streaming || '⋯'} /> : null}
    </div>
  );
}
