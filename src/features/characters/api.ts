import { get, post } from '@/shared/lib/http';

export type Character = {
  id: string;
  name: string;
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

export const fetchCharacter = (id: string): Promise<Character> =>
  get<Character>(`/api/characters/${id}`);
