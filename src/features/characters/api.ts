import { get, patch, post, postBytes, postBytesWithProgress } from '@/shared/lib/http';

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
  /** 最後一次就地修改的時間。樂觀鎖用的（GAP-71）；沒改過就沒有這個欄位。 */
  updatedAt?: string;
  /** 開場白候選數。>1 時對話的第一則訊息會長出左右切換（M12 起不再攔在進對話之前）。 */
  greetings?: string[];
  /**
   * 🔴 **有這個鍵才有卡可以匯出**（`services/importCard.ts` 只在匯入時寫入 `${id}.png`）。
   * 自建角色從沒有這個欄位 ⇒ `GET /:id/card.png` 對它永遠 404（GAP-48）。
   * 前端拿它當「要不要畫匯出鈕」的判準，不要用別的欄位猜。
   */
  card?: string;
};

export type NewCharacter = Omit<Character, 'id' | 'createdAt'>;

/**
 * 清單只拿摘要。🔴 **不要在這裡拿 `greetings` 與 `outputRules`** ——
 * 一張卡的開場白＋替換字串就上百 KB，九個好友就是 1 MB，畫面會被卡住（實測過）。
 */
export type CharacterSummary = Omit<Character, 'greetings'> & { greetingCount: number };
export const fetchCharacters = (): Promise<CharacterSummary[]> =>
  get<CharacterSummary[]>('/api/characters');
export const createCharacter = (c: NewCharacter): Promise<Character> =>
  post<Character>('/api/characters', c);

/**
 * 🔴 **新功能，ST 沒有。** 把一張圖交給 Gemini，回一份草稿。
 * 實查依據：ST 只有 Image Captioning extension（把圖轉描述插入對話，不碰角色欄位）；
 * `generateCharacter`／`createCharacterFrom` 在 `public/scripts/` 202 個檔裡零命中。
 *
 * 🔴 **`kind` 必填，刻意不給預設值。** 兩個入口要的東西相反 ——
 * `'character'` 要**第三人稱**的角色簡介＋初始訊息（那是「對方」），
 * `'persona'` 要**第一人稱**的自我介紹、而且沒有初始訊息（那是「我方」）。
 * 有預設值的話，將來第三個入口會**默默拿到角色那一套**；必填等於逼呼叫端表態。
 * 兩套 prompt 與欄位的正本在 `server/lib/draftSpec.ts`。
 *
 * ⚠️ 回傳型別跟著 `kind` 走 —— persona 那邊拿到的物件**根本沒有 `firstMessage` 這一鍵**，
 * 想用會被 tsc 擋下來，不必靠人記得「那一欄要丟掉」。
 */
export type ImageDraftOf = {
  character: { name: string; description: string; firstMessage: string };
  persona: { name: string; description: string };
};
export type ImageDraftKind = keyof ImageDraftOf;
export const draftFromImage = <K extends ImageDraftKind>(
  dataUrl: string,
  kind: K,
): Promise<ImageDraftOf[K]> =>
  post<ImageDraftOf[K]>('/api/characters/from-image', { dataUrl, kind });

/** 顯示用的名字。🔴 **每個要顯示名字的地方都走這支**，不要各自寫 `c.name`。 */
export const nameOf = (c: { name: string; displayName?: string }): string =>
  c.displayName && c.displayName.trim() !== '' ? c.displayName : c.name;

export const fetchCharacter = (id: string): Promise<Character> =>
  get<Character>(`/api/characters/${id}`);

/**
 * 就地修改既有角色。**只送要改的鍵**。
 * 🔴 **只寫 `characters/<id>.json` 這份投影，永不寫回 PNG 卡本體**
 * —— 與 `displayName`「改名永不寫回角色卡」同一條（後端 `characterEdit.ts` 檔頭）。
 * ⚠️ 已知副作用：匯出走的是 PNG ⇒ 這裡改的東西匯出後看不到（`plans/90-BACKLOG.md`）。
 */
export const updateCharacter = (
  id: string,
  body: Partial<
    Pick<Character, 'displayName' | 'description' | 'firstMessage' | 'avatar' | 'greetings'>
  > & {
    /**
     * 🔴 **樂觀鎖**（GAP-71）：把你讀到的 `updatedAt` 送回來。
     * 對不上代表中間有別人改過 ⇒ 後端回 409，而不是默默覆蓋掉對方的寫入。
     * 省略 ＝ 不檢查。
     */
    ifUnmodifiedSince?: string | undefined;
  },
): Promise<Character> => patch<Character>(`/api/characters/${id}`, body);

/**
 * 開場白清單。**帶各自的名字**（卡片自己在 `<!-- title: … -->` 裡寫的）——
 * 「第 1 種／第 2 種」對使用者沒有意義，「大一．同班初遇」才有。
 */
export type GreetingChoice = {
  index: number;
  /**
   * 🔴 **在「額外問候語」那一層的編號**（GAP-67）。`null` ＝ 它就是原本的開場。
   * 兩頁用同一個編號，使用者才不會以為是兩則不同的東西。
   */
  alt: number | null;
  title: string | null;
  preview: string;
  lore: number;
};
export const fetchGreetings = (id: string): Promise<GreetingChoice[]> =>
  get<GreetingChoice[]>(`/api/characters/${id}/greetings`);

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

/**
 * 跟 `importCardFile` 送的是同一支路由，**只有 `import/drop` 這條路走這支**——
 * 那張畫面有百分比進度可以顯示；`ImportCardBox`（加入好友頁頂端的快速匯入）
 * 沒有對應的進度 UI，不動它原本的行為。見 `postBytesWithProgress` 檔頭。
 */
export const importCardFileWithProgress = (
  bytes: ArrayBuffer,
  onProgress: (fraction: number | null) => void,
): Promise<ImportedCharacter> =>
  postBytesWithProgress<ImportedCharacter>('/api/characters/import', bytes, onProgress);
