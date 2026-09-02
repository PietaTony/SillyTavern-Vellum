/**
 * ST 對話檔（JSONL）解析。**第一行是 header，其後每行一則訊息。**
 *
 * 🔴 **每一行原樣留著。** 實測標的卡的對話檔：6 則訊息，鍵集**每行都不同**
 * （聯集 16 鍵；`extra` 的子鍵 6 行 6 種；`is_ejs_processed` 是 array 不是 bool）。
 * ⇒ 「解析成我們的欄位再寫回去」＝把沒認出來的欄位全部丟掉 ＝ 資料損毀。
 * 我們**投影**出視圖給 UI 用，正本永遠是那一行原文。
 *
 * 🔴 **這支只服務「匯入進來的對話」**（正本是那份 `.jsonl`）。原生在 Vellum 裡建立、
 * 從沒匯入過的對話沒有 `.jsonl` 可以重建 ⇒ 檔尾另外一段是**我們自己的格式**
 * （`NativeChatExport`，H1 落地票 2026-08-31 Peter 裁定：「原生 ST 沒有，但我們這邊要有，
 * 不用遷就 ST 相容」）。兩段互不相依，各自的 parse/write 成對放在一起方便對照。
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

// ── 我們自己的可攜格式（H1 落地票，2026-08-31）──────────────────────────────
//
// 🔴 **底線：自己匯出的自己一定要匯得回來。** 這一段的 parse/write 是一對，
// `parseNativeChat(writeNativeChat(x))` 必須不掉任何欄位——測試見
// `server/__tests__/chatFile.test.ts` 的 round-trip 案例。
//
// 🔴 **代價講清楚：這個格式 ST 讀不回去。** 我們沒有把它塞進 ST 的 `.jsonl` 形狀，
// 而是原樣放 `Message`（含 `swipes`／`swipeIndex`／`partial`／`usage` 這些 ST 沒有的
// 欄位）——換回 ST 相容格式就得丟掉這些欄位，Peter 裁定「不遷就」，所以兩個格式
// 分道揚鑣，`writeChatJsonl` 讀不懂這一段，`writeNativeChat` 也不產生 ST 認得的形狀。
import { z } from 'zod';
import { MessageSchema } from '../services/chatModel.ts';

/** 格式版本。將來欄位一旦不相容，就在這裡加一版、`parseNativeChat` 分支處理舊版。 */
export const NATIVE_CHAT_EXPORT_VERSION = 1;

export const NativeChatExportSchema = z.object({
  version: z.literal(NATIVE_CHAT_EXPORT_VERSION),
  characterName: z.string(),
  createdAt: z.string(),
  /** 🔴 原樣存整個 `Message`——`swipes`／`swipeIndex`／`partial`／`usage` 都在，不精簡。 */
  messages: z.array(MessageSchema),
});
export type NativeChatExport = z.infer<typeof NativeChatExportSchema>;

export class BadNativeChatFile extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'BadNativeChatFile';
  }
}

/** 匯出：把一段對話包成我們自己的格式。輸入只取用得到的三個欄位，呼叫端不用整包 `Chat`。 */
export function writeNativeChat(chat: Omit<NativeChatExport, 'version'>): string {
  const body: NativeChatExport = { version: NATIVE_CHAT_EXPORT_VERSION, ...chat };
  return JSON.stringify(body, null, 2);
}

/**
 * 匯入：驗證＋解析。
 * 🔴 **版本不符要明確拒絕，不要用「盡量讀」矇混**——沒有 migration 分支之前，
 * 讀錯版本的檔案，欄位對不上會在畫面上長出詭異的結果，而不是在這裡就喊停。
 */
export function parseNativeChat(text: string): NativeChatExport {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new BadNativeChatFile(`不是合法的 JSON：${e instanceof Error ? e.message : e}`);
  }
  const r = NativeChatExportSchema.safeParse(json);
  if (!r.success) {
    const versionMismatch = z.object({ version: z.number() }).safeParse(json);
    if (versionMismatch.success && versionMismatch.data.version !== NATIVE_CHAT_EXPORT_VERSION) {
      throw new BadNativeChatFile(
        `這個檔案是版本 ${versionMismatch.data.version}，這一版只認得版本 ${NATIVE_CHAT_EXPORT_VERSION}`,
      );
    }
    throw new BadNativeChatFile(`不是這個格式的對話檔：${r.error.issues.map((i) => i.message).join('; ')}`);
  }
  return r.data;
}
