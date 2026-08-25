import { get, patch, post, put } from '@/shared/lib/http';

/** persona ＝ **我方**。角色卡是對方。`name` 驅動 `{{user}}`，`description` 進 prompt。 */
export type Persona = {
  id: string;
  name: string;
  avatar: string;
  description: string;
  position: 'in_prompt' | 'top_an' | 'bottom_an' | 'at_depth' | 'none';
  depth: number;
  role: number;
  title: string;
  archived: boolean;
  createdAt: string;
};

export type PersonaList = { personas: Persona[]; defaultPersonaId: string | null };
export type PersonaDraft = Partial<Omit<Persona, 'id' | 'createdAt' | 'archived'>> & {
  name: string;
};

export const fetchPersonas = (): Promise<PersonaList> => get<PersonaList>('/api/personas');
export const createPersona = (d: PersonaDraft): Promise<Persona> =>
  post<Persona>('/api/personas', d);
/** 回傳帶 `renamed` —— 改名要告知使用者歷史訊息不會跟著變（驗收 C6）。 */
export const updatePersona = (
  id: string,
  d: Partial<PersonaDraft>,
): Promise<Persona & { renamed: boolean }> =>
  patch<Persona & { renamed: boolean }>(`/api/personas/${id}`, d);
export const setDefaultPersona = (id: string): Promise<{ defaultPersonaId: string }> =>
  put<{ defaultPersonaId: string }>(`/api/personas/default/${id}`, {});

/** 這一段對話生效中的 persona 來自哪一層。🔴 看得出哪層生效，使用者才不會以為壞了（C4）。 */
export type PersonaLayer = 'chat' | 'friend' | 'group' | 'global' | 'none';
export const LAYER_LABEL: Record<PersonaLayer, string> = {
  chat: '這段對話',
  friend: '這個好友',
  group: '這個群組',
  global: '全域預設',
  none: '尚未設定',
};

/** 設定／清除「這一段對話」的 persona。傳 null ＝ 跟隨上層（驗收 C5）。 */
export const setChatPersona = (chatId: string, personaId: string | null): Promise<unknown> =>
  patch(`/api/chats/${chatId}/persona`, { personaId });
