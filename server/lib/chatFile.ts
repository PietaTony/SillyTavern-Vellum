/**
 * ST 對話檔（JSONL）解析。**第一行是 header，其後每行一則訊息。**
 *
 * 🔴 **每一行原樣留著。** 實測標的卡的對話檔：6 則訊息，鍵集**每行都不同**
 * （聯集 16 鍵；`extra` 的子鍵 6 行 6 種；`is_ejs_processed` 是 array 不是 bool）。
 * ⇒ 「解析成我們的欄位再寫回去」＝把沒認出來的欄位全部丟掉 ＝ 資料損毀。
 * 我們**投影**出視圖給 UI 用，正本永遠是那一行原文。
 */

export type ChatFile = {
  header: Record<string, unknown>;
  entries: Record<string, unknown>[];
};

export class BadChatFile extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'BadChatFile';
  }
}

/**
 * 逐行解析。
 * 🔴 **壞掉的行要丟例外，不可以跳過。** 跳過等於「匯入成功但少了幾則訊息」——
 * 使用者不會發現，而那是最糟的失敗形式。空白行（檔尾常有）才可以忽略。
 */
export function parseChatJsonl(text: string): ChatFile {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new BadChatFile('對話檔是空的');
  const rows = lines.map((line, i) => {
    try {
      const v: unknown = JSON.parse(line);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('不是物件');
      return v as Record<string, unknown>;
    } catch (e) {
      throw new BadChatFile(`第 ${i + 1} 行不是合法的 JSON 物件：${e instanceof Error ? e.message : e}`);
    }
  });
  return { header: rows[0]!, entries: rows.slice(1) };
}

/** 寫回 JSONL：header 一行，其後每則一行。鍵序由 JSON.stringify 決定（A2 允許）。 */
export function writeChatJsonl(file: ChatFile): string {
  return [file.header, ...file.entries].map((r) => JSON.stringify(r)).join('\n') + '\n';
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type MessageView = {
  role: 'user' | 'model';
  text: string;
  sentAt: string;
  swipes: string[];
  swipeIndex: number;
};

/**
 * 投影出 UI 要的欄位。
 *
 * 🔴 `is_user` 才是角色的判準，**不是 `name`**（同一個 `name` 兩邊都可能出現）。
 * 🔴 `swipes` 只有部分訊息有（實測 6 則裡 2 則有，其一有 9 個 swipe）；
 *    沒有 `swipes` 的訊息**不要偽造成 `[mes]`**——那會讓「有沒有重生成過」這件事失真。
 */
export function viewOfEntry(entry: Record<string, unknown>): MessageView {
  const swipes = Array.isArray(entry['swipes'])
    ? (entry['swipes'] as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  return {
    role: entry['is_user'] === true ? 'user' : 'model',
    text: str(entry['mes']),
    sentAt: str(entry['send_date']),
    swipes,
    swipeIndex: typeof entry['swipe_id'] === 'number' ? entry['swipe_id'] : 0,
  };
}

/** header 只有三個鍵是我們用得到的；其餘（`chat_metadata` 等）原樣留在 `header` 裡。 */
export function viewOfHeader(header: Record<string, unknown>): { userName: string; characterName: string } {
  return { userName: str(header['user_name']), characterName: str(header['character_name']) };
}
