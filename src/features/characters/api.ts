import { get, post, postBytes } from '@/shared/lib/http';

export type Character = {
  id: string;
  /** 卡片原名。🔴 **不是拿來顯示的** —— 顯示要用 `displayName ?? name`（D-h）。 */
  name: string;
  /** 好友的顯示名。同一張卡加入多次時，第二個起會是 `某某(1)`。 */
  displayName?: string;
  description: string;
  firstMessage: string;
  avatar: string;
  createdAt: string;
};

export type NewCharacter = Omit<Character, 'id' | 'createdAt'>;

export const fetchCharacters = (): Promise<Character[]> => get<Character[]>('/api/characters');
export const createCharacter = (c: NewCharacter): Promise<Character> =>
  post<Character>('/api/characters', c);

/**
 * 🔴 **新功能，ST 沒有。** 把一張圖交給 Gemini，回名稱／描述／初始訊息。
 * 實查依據：ST 只有 Image Captioning extension（把圖轉描述插入對話，不碰角色欄位）；
 * `generateCharacter`／`createCharacterFrom` 在 `public/scripts/` 202 個檔裡零命中。
 */
export type ImageDraft = { name: string; description: string; firstMessage: string };
export const draftFromImage = (dataUrl: string): Promise<ImageDraft> =>
  post<ImageDraft>('/api/characters/from-image', { dataUrl });

/** 顯示用的名字。🔴 **每個要顯示名字的地方都走這支**，不要各自寫 `c.name`。 */
export const nameOf = (c: { name: string; displayName?: string }): string =>
  c.displayName && c.displayName.trim() !== '' ? c.displayName : c.name;

export const fetchCharacter = (id: string): Promise<Character> =>
  get<Character>(`/api/characters/${id}`);

/**
 * 匯入角色卡。
 * 🔴 **不做「這張卡已存在，要覆蓋嗎」的判斷**（Peter 裁定 D-e）：
 * 同一張卡可以加入多次，各自獨立。重複貼同一個網址就是再長出一個好友。
 */
export type ImportedCharacter = Character & {
  alternateGreetings: number;
  world?: { entries: number; disabledAtFactory: number };
};

/** 網址由**後端**去抓：瀏覽器直抓會撞 CORS，多數卡片站沒開。 */
export const importCardByUrl = (url: string): Promise<ImportedCharacter> =>
  post<ImportedCharacter>('/api/characters/import-url', { url });

export const importCardFile = (bytes: ArrayBuffer): Promise<ImportedCharacter> =>
  postBytes<ImportedCharacter>('/api/characters/import', bytes);
