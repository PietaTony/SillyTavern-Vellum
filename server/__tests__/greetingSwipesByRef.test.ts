import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../lib/character.ts';
import type { Chat } from '../services/chatModel.ts';

/**
 * 🔴 **這支守的是量出來的那個問題本身有沒有真的被解掉**：
 * 建立對話時開場白的候選不再整批落字面 `swipes`（`chats.ts` 的 `POST /`），
 * 讀取時現拼（`GET /:id`），編輯會材質化（`chatMessages.ts`），角色卡問候語
 * 改了、還沒編輯過的候選要跟著變（附帶好處）。
 *
 * `chatSwipe.test.ts` 已經守「切換」與 B2／B3 那條世界書鏈——這裡不重複，
 * 只加「落檔形狀」「回應展開」「編輯材質化」「舊檔相容」「跟著角色卡變」五件事。
 */
let root: string;

async function app() {
  vi.resetModules();
  process.env['VELLUM_DATA'] = root;
  const { Hono } = await import('hono');
  const { chats } = await import('../routes/chats.ts');
  const { chatMessages } = await import('../routes/chatMessages.ts');
  return new Hono().route('/api/chats', chatMessages).route('/api/chats', chats);
}

const NINE = Array.from({ length: 9 }, (_v, i) => `<!-- lore: ${i} -->第 ${i} 則開場白，足夠長一點`);

const CH: Character = {
  id: 'char1',
  name: '九則開場',
  description: 'x',
  firstMessage: NINE[0] as string,
  avatar: '',
  createdAt: '2026-08-28T00:00:00.000Z',
  greetings: NINE,
};

const seedChar = async (ch: Character = CH) => {
  const { writeJson } = await import('../adapters/storage.ts');
  await writeJson(`characters/${ch.id}.json`, ch);
};

const readChatFile = async (id: string) => {
  const { readJson } = await import('../adapters/storage.ts');
  return readJson<Chat | null>(`chats/${id}.json`, null);
};

const chatFileBytes = (id: string): number => statSync(join(root, 'chats', `${id}.json`)).size;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vellum-greetingref-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env['VELLUM_DATA'];
});

describe('POST /api/chats —— 落檔形狀', () => {
  it('🔴 9 則開場白：磁碟上第一則訊息沒有字面 swipes，只有 greetingSwipes 標記', async () => {
    const a = await app();
    await seedChar();
    const res = await a.request('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: CH.id }),
    });
    expect(res.status).toBe(201);
    const onDisk = await readChatFile((await res.clone().json()).id);
    expect(onDisk?.messages[0]?.greetingSwipes).toBe(true);
    expect(onDisk?.messages[0]?.swipes).toBeUndefined();
    expect(onDisk?.messages[0]?.swipeIndex).toBe(0);
  });

  it('🔴 前後 bytes 對照：同一張 9 則開場白的卡，落檔大小遠小於「整批落字面 swipes」', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id }),
      })
    ).json();
    const actualBytes = chatFileBytes(created.id);

    // 舊行為的等價落檔：同一份 chat，但第一則訊息把 9 則候選整批寫成字面 swipes。
    const { writeJson, readJson } = await import('../adapters/storage.ts');
    const asIs = await readJson<Chat | null>(`chats/${created.id}.json`, null);
    const oldShape: Chat = structuredClone(asIs) as Chat;
    if (oldShape.messages[0]) {
      delete oldShape.messages[0].greetingSwipes;
      oldShape.messages[0].swipes = NINE.map((g) => g.replace(/^<!-- lore: \d+ -->/, ''));
    }
    await writeJson(`chats/old-shape.json`, oldShape);
    const oldBytes = chatFileBytes('old-shape');

    console.log(`greetingSwipes: true → ${actualBytes} bytes；字面 swipes（舊行為等價）→ ${oldBytes} bytes`);
    expect(actualBytes).toBeLessThan(oldBytes);
    // 9 則開場白全文佔了絕大多數重量——省下來的應該是大宗，不是零頭。
    expect(oldBytes - actualBytes).toBeGreaterThanOrEqual(oldBytes * 0.5);
  });

  it('回應（不是磁碟）仍然要展開 swipes——呼叫端當場要看到候選', async () => {
    const a = await app();
    await seedChar();
    const body = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id }),
      })
    ).json();
    expect(body.messages[0].swipes).toHaveLength(9);
    expect(body.messages[0].swipes[0]).toBe('第 0 則開場白，足夠長一點');
  });
});

describe('GET /api/chats/:id —— 讀取時現拼', () => {
  it('greetingSwipes 訊息展開成完整 swipes，字面訊息原樣通過', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id }),
      })
    ).json();
    const got = await (await a.request(`/api/chats/${created.id}`)).json();
    expect(got.messages[0].swipes).toHaveLength(9);
    expect(got.messages[0].swipeIndex).toBe(0);
  });

  /**
   * 🔴 **獨立驗收線抓到的坑，Peter 2026-08-28 又推翻了第一版修法**：角色卡的
   * `greetings` 變短（9 → 3），存著的 `swipeIndex: 4` 懸空。第一版夾回最後一格、
   * `text` 也跟著換——但那是用一句使用者從未選過的候選冒充他原本選的那句，
   * 比顯示壞掉的「5 / 3」更危險。現在改成：`text` 維持原樣（原文「第 5 則」），
   * `swipeIndex` 回 `null`（畫面要自己誠實標出「不在候選清單裡」，不是這支的責任）。
   * 順便證明 GET **沒有副作用**——回應前後磁碟上的檔案 md5 要一致（「只是看，不算數」）。
   */
  it('🔴 9→3 則：swipeIndex 4 讀出來 text 維持原樣、swipeIndex 回 null，且 GET 不寫回磁碟', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id, greetingIndex: 4 }),
      })
    ).json();
    expect(created.messages[0].swipeIndex).toBe(4);
    const originalText = created.messages[0].text;

    // 角色卡的問候語被砍到只剩 3 則（作者精簡開場白）。
    const { writeJson } = await import('../adapters/storage.ts');
    await writeJson(`characters/${CH.id}.json`, { ...CH, greetings: NINE.slice(0, 3) });

    const filePath = join(root, 'chats', `${created.id}.json`);
    const md5Before = createHash('md5').update(readFileSync(filePath)).digest('hex');

    const res = await a.request(`/api/chats/${created.id}`);
    expect(res.status).toBe(200);
    const got = await res.json();
    console.log('GET 實際回應（9→3 之後）：', JSON.stringify(got.messages[0]));
    expect(got.messages[0].swipes).toHaveLength(3);
    expect(got.messages[0].swipeIndex).toBeNull(); // 不猜替代品，誠實說「不知道」
    expect(got.messages[0].text).toBe(originalText); // 使用者當初真的選的那句，一個字都沒變
    expect(got.messages[0].text).toBe('第 4 則開場白，足夠長一點'); // 明講：不是「第 2 則」

    const md5After = createHash('md5').update(readFileSync(filePath)).digest('hex');
    console.log(`GET 前後檔案 md5：${md5Before} → ${md5After}`);
    expect(md5After).toBe(md5Before);
  });
});

describe('🔴 附帶好處：角色卡問候語改了，還沒編輯過的候選跟著更新', () => {
  it('切候選之後（仍是參照），改角色卡的開場白，再讀一次會拿到新內容', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id }),
      })
    ).json();

    // 使用者切到第 3 則看看（純切換，不編輯——保持參照）。
    await a.request(`/api/chats/${created.id}/messages/${created.messages[0].id}/swipe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: 2 }),
    });

    // 角色卡的問候語被改了（例如作者修正錯字）。
    const { writeJson } = await import('../adapters/storage.ts');
    const edited: Character = {
      ...CH,
      greetings: NINE.map((g, i) => (i === 2 ? '<!-- lore: 2 -->改過的第 2 則' : g)),
    };
    await writeJson(`characters/${CH.id}.json`, edited);

    const got = await (await a.request(`/api/chats/${created.id}`)).json();
    expect(got.messages[0].swipeIndex).toBe(2);
    expect(got.messages[0].swipes[2]).toBe('改過的第 2 則');
  });
});

describe('🔴 編輯把參照凍成快照', () => {
  it('編輯第一則開場白之後，材質化成字面 swipes；之後角色卡再改也不受影響', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id }),
      })
    ).json();
    const msgId = created.messages[0].id;

    await a.request(`/api/chats/${created.id}/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '使用者自己改過的開場白' }),
    });

    const onDisk = await readChatFile(created.id);
    expect(onDisk?.messages[0]?.swipes).toHaveLength(9);
    expect(onDisk?.messages[0]?.swipes?.[0]).toBe('使用者自己改過的開場白');
    expect(onDisk?.messages[0]?.greetingSwipes).toBeUndefined();

    // 切走再切回來，編輯還在（既有的 messageEdit 契約，材質化之後一樣要守住）。
    await a.request(`/api/chats/${created.id}/messages/${msgId}/swipe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: 3 }),
    });
    const back = await a.request(`/api/chats/${created.id}/messages/${msgId}/swipe`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: 0 }),
    });
    expect((await back.json()).text).toBe('使用者自己改過的開場白');

    // 角色卡之後再改問候語，這則已經材質化的訊息不受影響。
    const { writeJson } = await import('../adapters/storage.ts');
    await writeJson(`characters/${CH.id}.json`, {
      ...CH,
      greetings: NINE.map((g) => `${g}（改過）`),
    });
    const got = await (await a.request(`/api/chats/${created.id}`)).json();
    expect(got.messages[0].text).toBe('使用者自己改過的開場白');
  });
});

describe('🔴 舊檔相容：加這個欄位之前落的檔，結構完全沒有 greetingSwipes', () => {
  it('舊格式（字面 swipes，沒有 greetingSwipes 欄位）讀取、切換都正常', async () => {
    const a = await app();
    await seedChar();
    const { writeJson } = await import('../adapters/storage.ts');
    const legacy: Chat = {
      id: 'legacy1',
      characterId: CH.id,
      characterName: CH.name,
      createdAt: '2026-08-01T00:00:00.000Z',
      messages: [
        {
          id: 'm0',
          role: 'model',
          text: '舊資料的開場白',
          at: '2026-08-01T00:00:00.000Z',
          swipes: ['舊資料的開場白', '舊資料的第二則'],
          swipeIndex: 0,
        },
      ],
    };
    await writeJson('chats/legacy1.json', legacy);

    const got = await (await a.request('/api/chats/legacy1')).json();
    expect(got.messages[0].swipes).toEqual(['舊資料的開場白', '舊資料的第二則']);

    const swiped = await (
      await a.request('/api/chats/legacy1/messages/m0/swipe', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: 1 }),
      })
    ).json();
    expect(swiped.swipeIndex).toBe(1);
    expect(swiped.text).toBe('舊資料的第二則');
  });
});

/**
 * 🔴 **同一個坑、第三條路徑——編輯**（獨立驗收線 2026-08-28 追出完整流程抓到）：
 * `— / 3` 那個狀態（9→3、原 `swipeIndex: 4`）下按編輯，材質化第一版把 `swipeIndex`
 * 用 `...rest` 原封抄過去（還是懸空的 4），`editMessage()` 的 `currentSwipe()` 會夾回
 * 合法範圍（2），使用者的新文字就寫進「第 2 則」的候選格子——**永久蓋掉一則他從沒
 * 選過的候選**。這支釘住修好之後的行為：不准蓋掉任何一則原有候選。
 */
describe('🔴 「— / 3」狀態下編輯：不准覆蓋任何一則使用者沒選過的候選', () => {
  it('9→3、原 swipeIndex 4，編輯之後三則原候選一個字都沒被蓋掉', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id, greetingIndex: 4 }),
      })
    ).json();
    const msgId = created.messages[0].id;

    // 角色卡的問候語被砍到只剩 3 則——這則訊息現在站在一個不存在的位置上。
    const { writeJson, readJson } = await import('../adapters/storage.ts');
    await writeJson(`characters/${CH.id}.json`, { ...CH, greetings: NINE.slice(0, 3) });

    const before = await readJson<Chat | null>(`chats/${created.id}.json`, null);
    console.log('編輯前 chat json：', JSON.stringify(before?.messages[0]));

    const edited = await (
      await a.request(`/api/chats/${created.id}/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '使用者在「— / 3」狀態下打的字' }),
      })
    ).json();

    const after = await readJson<Chat | null>(`chats/${created.id}.json`, null);
    console.log('編輯後 chat json：', JSON.stringify(after?.messages[0]));

    // 🔴 驗收核心：三則原有候選一個字都不准被蓋掉。
    expect(after?.messages[0]?.swipes).toEqual([
      '第 0 則開場白，足夠長一點',
      '第 1 則開場白，足夠長一點',
      '第 2 則開場白，足夠長一點',
    ]);
    // text 真的改了（編輯本身要生效）。
    expect(after?.messages[0]?.text).toBe('使用者在「— / 3」狀態下打的字');
    expect(edited.text).toBe('使用者在「— / 3」狀態下打的字');
    // swipeIndex 誠實維持「不知道」，不是被夾成 2（那正是會蓋掉候選的錯誤路徑的癥狀）。
    expect(after?.messages[0]?.swipeIndex).toBeNull();
    expect(edited.swipeIndex).toBeNull();
  });

  /** 正常情況（index 在範圍內）完全不變——回歸釘，理由見 messageEdit.ts 檔頭。 */
  it('index 在範圍內：編輯照樣同步寫回 swipes[swipeIndex]（既有行為不能被這次改動動到）', async () => {
    const a = await app();
    await seedChar();
    const created = await (
      await a.request('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: CH.id, greetingIndex: 2 }),
      })
    ).json();
    const msgId = created.messages[0].id;

    const edited = await (
      await a.request(`/api/chats/${created.id}/messages/${msgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '正常編輯' }),
      })
    ).json();
    expect(edited.swipeIndex).toBe(2);

    const { readJson } = await import('../adapters/storage.ts');
    const after = await readJson<Chat | null>(`chats/${created.id}.json`, null);
    expect(after?.messages[0]?.swipes?.[2]).toBe('正常編輯');
    expect(after?.messages[0]?.swipes).toHaveLength(9);
    expect(after?.messages[0]?.swipeIndex).toBe(2);
  });
});
