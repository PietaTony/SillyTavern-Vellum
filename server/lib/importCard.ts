/**
 * 匯入一張角色卡：**落檔 ＋ 抽資產 ＋ 產生索引紀錄**。
 *
 * 從 route 抽出來的理由不只是行數：匯入是**有順序要求的一串副作用**
 * （先寫卡、再抽資產、最後寫索引），而 route 應該只負責「收 request、回 response」。
 *
 * 🔴 **卡片只解析一次。** 這張真卡 6.8 MB、兩份各 3 MB base64；
 * 每多一次 `readCard` 就多解一次 base64 ＋ 多 parse 一次 3 MB JSON。
 */
import { readCard, viewOf, type Card } from './card.ts';
import { worldFromCard, type CharWorld } from './charWorld.ts';
import { spriteBytes, spriteExt, spritesInCard } from './sprite.ts';
import { listJson, writeBin, writeJson } from './storage.ts';
import { displayNameOf, uniqueDisplayName } from './displayName.ts';
import { fromRegexScripts } from './outputRules.ts';
import type { Character } from './character.ts';
import { inventoryOf } from './cardScripts.ts';

export type ImportedAsset = { path: string; mime: string; bytes: number; from: string };

export type ImportedCard = {
  id: string;
  card: Card;
  view: ReturnType<typeof viewOf>;
  assets: ImportedAsset[];
  world: CharWorld;
};

/**
 * 把卡片與其資產寫進資料目錄。**呼叫端負責寫索引 JSON**——
 * 順序是刻意的：先有實體檔，才有指向它的紀錄。反過來會留下指向不存在檔案的紀錄。
 */
export async function importCardFiles(png: Buffer, id: string): Promise<ImportedCard> {
  const card = readCard(png);
  await writeBin(`characters/${id}.png`, png);

  // 內嵌的大圖抽成獨立檔（規格 P7 硬約束 3）。
  // ⚠️ **抽出來 ≠ 從卡裡刪掉**：卡內原欄位依 A1 原樣保留，這裡只是另存一份可用的。
  const assets: ImportedAsset[] = [];
  for (const [i, sp] of spritesInCard(card.payloads[card.primary]).entries()) {
    try {
      const path = `characters/${id}.assets/${i}.${spriteExt(sp.mime)}`;
      await writeBin(path, spriteBytes(sp));
      assets.push({ path, mime: sp.mime, bytes: sp.bytes, from: sp.at });
    } catch {
      // 壞掉的 base64：跳過這一張，其餘照抽。**角色本體比貼圖重要**，不因此擋下整次匯入。
    }
  }
  /**
   * D-f：把卡內嵌的世界書複製成**這個好友專屬**的一份，並在同一刻留下出廠快照。
   * 🔴 **不問使用者要不要**（不沿用 ST 的「Import Card Lore」彈窗）——複製是「加入」的一部分。
   * 🔴 **每個好友一份**：共用的話，在 A 切線 B 會跟著變。
   */
  const world = worldFromCard(card, id, new Date().toISOString());
  // 🔴 **放 `worlds/` 不是 `characters/`。** `listJson('characters')` 會讀那個目錄下
  // **每一個 `.json`** —— 世界書放進去就會被當成一個沒有名字的角色回傳，
  // 前端讀 `description.replace(...)` 當場整頁崩潰。實際踩過一次。
  await writeJson(`worlds/${id}.json`, world);

  return { id, card, view: viewOf(card), assets, world };
}

/**
 * 匯入的本體：檔案上傳與網址匯入**走同一條路**。
 * 🔴 兩條路各寫一份的話，之後只會有一邊被修到 —— 那是最容易長出「行為不一致」的地方。
 */
export async function intoCharacter(png: Buffer) {
  const id = crypto.randomUUID();
  const imported = await importCardFiles(png, id);
  const { view, assets, world } = imported;
  const exts = (imported.card.payloads[imported.card.primary] as {
    data?: { extensions?: { regex_scripts?: unknown; tavern_helper?: unknown } };
  }).data?.extensions;
  // 🔴 **背景腳本與顯示介面一起盤**（見 `cardScripts.ts` 檔頭 ②）——
  // 只盤 `tavern_helper` 會漏掉使用者真正會點的那份 HTML。
  const scripts = inventoryOf(exts);

  const base = view.name || '未命名角色';
  // D-h：加入時主動避開重名。第一個保持原名，第二個起 `(1)`、`(2)`…
  const existing = (await listJson<Character>('characters')).map(displayNameOf);
  const displayName = uniqueDisplayName(base, existing);
  const ch: Character = {
    id,
    name: base,
    ...(displayName !== base ? { displayName } : {}),
    description: view.description,
    firstMessage: view.firstMessage,
    // 🔴 全部候選都存下來。選哪一則是使用者的事——M12 起是**進對話後**左右切（同 ST）。
    greetings: [view.firstMessage, ...view.alternateGreetings].filter((g) => g.trim() !== ''),
    outputRules: fromRegexScripts(exts?.regex_scripts ?? []),
    /**
     * 🔴 **卡片自帶腳本要盤點下來**（M13 第二期）。
     * 在此之前我們只取 `regex_scripts`，`tavern_helper`（那張卡是 **2 MB**）整包丟掉。
     * ✅ 資料本來就沒丟（PNG 原文完整保留），但**沒有被投影出來 ＝ 上層看不到它存在**，
     * 於是「這張卡需要腳本才會動」這件事對使用者是隱形的。
     * ⚠️ 這裡只存盤點結果（幾支／多大／會不會去外面抓 code／指紋），**不存內容**。
     */
    ...(scripts ? { cardScripts: scripts } : {}),
    // 相對路徑：dev 由 Vite 代理到後端、Docker 是同一個 process，兩邊都通。
    avatar: `/api/characters/${id}/avatar.png`,
    createdAt: new Date().toISOString(),
    card: `${id}.png`,
    ...(assets.length > 0 ? { assets } : {}),
  };
  await writeJson(`characters/${id}.json`, ch);
  return {
    ...ch,
    alternateGreetings: view.alternateGreetings.length,
    world: {
      entries: world.entries.length,
      disabledAtFactory: Object.values(world.origin.entries).filter((e) => !e.enabled).length,
    },
  };
}
