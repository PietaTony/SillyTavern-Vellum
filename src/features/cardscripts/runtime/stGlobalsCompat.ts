/**
 * 卡片查一個「ST 有、Vellum 沒有」的全域時，目前 100% 靜默——`findApi()` 這種
 * 能力偵測寫法直接讀 `window[name]`，落空就是 `undefined`，跟「還沒載完」一模一樣。
 *
 * 🔴 **稽核判過「加進 `preamble.ts` 的 `NAMES`」這條路**：`NAMES` 一律變成
 * `H[n] = function () { return call(n, …); }`，`typeof window[n] === 'function'`
 * 從此**永遠是 true**——這正是「`TavernHelp.getLorebookEntries` 的 fallback 分支
 * 永遠進不去」那個 GAP 的根因。把名字塞進 `NAMES` 等於騙卡片「我們支援這個」，
 * `triggerSlash` 尤其不行：那是「執行任意酒館指令」，Peter 已經裁定不做（見
 * `.claude/agents/commands.md`）。加進 `NAMES` 會讓「不做」變成「假裝做了」。
 *
 * ⇒ **這裡要的是「查得到、但不騙」**：警告，同時保證 `typeof window[name]`
 * 還是 `'undefined'`——能力偵測看到的落空是真的，不是我們演出來的。
 *
 * 🔴 **`configurable: true` 加一個 setter，不是純唯讀 getter。** 純 getter（沒有
 * setter）在 sloppy mode 下賦值是靜默 no-op——卡片自己 polyfill 同名全域
 * （`window.registerSlashCommand = function(){...}`，四個用途裡真的有卡在這樣做）
 * 会被我們吃掉、卡片以為裝上了，其實什麼都沒發生，比原本沒有這層還糟。
 * ⇒ setter 就地把自己換成一份普通的資料屬性，之後跟這個全域本來就不存在
 * 時卡片自己補一個沒有任何差別。
 *
 * ⚠️ **只保證 `typeof`，不保證 `in`。** `Object.defineProperty` 裝上去之後
 * `'triggerSlash' in window` 會是 `true`（原本應該是 `false`）——這是攔截讀取
 * 這個手法本身的極限，沒有辦法在「攔得到」跟「`in` 也騙得過」之間兩者兼得。
 * 已知的四個呼叫點（測試卡A桌寵）都用 `typeof … === 'function'`，不用 `in`。
 *
 * 🔴 **只印 console，不發 toast**（跟 `stCompat.ts` 的 DOM 白名單不同，這裡結論
 * 不一樣，理由也不同）：`stCompat.ts` 警告的是「卡片承諾的介面不會出現」——
 * 那是新資訊，使用者原本不知道。這裡警告的是「卡片的某個功能不會動」，
 * 但測試卡A桌寵的四個呼叫點裡已經有兩個**自己會講話**
 * （`generateLetter()` 丟看得見的例外、`bindToolbar()` 自己彈 warning toast）；
 * 我們認不出當下是不是這兩種——再發一次 toast 等於同一件事講兩次。
 * `console.warn` 已經經 `logShim.ts` 轉發到主頁 DevTools（開發者看得到），
 * 沒接住的那一種（`setupQR()` 靜默 return）至少多了這一行診斷可查，
 * 寧可只多這一條線也不要洗使用者的畫面。
 *
 * 🔴 **自足工廠**——會被 `toString()` 塞進 iframe（理由同 `stCompat.ts` 檔頭）：
 * 不可以引用模組範圍的任何東西。
 */
export const KNOWN_ST_ONLY_GLOBALS: readonly string[] = [
  'triggerSlash',
  'getButtonEvent',
  'registerSlashCommand',
  'SlashCommandParser',
  'generateQuietPrompt',
];

export type MissingGlobalWarn = (name: string) => void;

/** 每個名字只出聲一次——能力偵測常常在輪詢／重試裡重複查同一個名字。 */
export function makeMissingGlobalWarn(warn: (m: string) => void): MissingGlobalWarn {
  var seen: Record<string, boolean> = {};
  return function missingGlobalWarn(name) {
    if (seen[name]) return;
    seen[name] = true;
    warn(
      '[卡片腳本] 這張卡查詢了 window.' +
        name +
        '——那是 SillyTavern 專屬的全域，Vellum 沒有提供，用到它的那段功能不會動（能力偵測仍會看到 undefined，不受影響）。',
    );
  };
}

/**
 * 裝一個「讀了會出聲、但回傳值仍是 `undefined`」的 getter；`typeof` 不受影響。
 * `set` 讓卡片自己 polyfill 時整層原地換成普通資料屬性（見檔頭）。
 */
export function installLoudMissingGlobal(
  win: Record<string, unknown>,
  name: string,
  warnOnce: MissingGlobalWarn,
): void {
  Object.defineProperty(win, name, {
    configurable: true,
    enumerable: true,
    get: function () {
      warnOnce(name);
      return undefined;
    },
    set: function (v: unknown) {
      Object.defineProperty(win, name, {
        value: v,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    },
  });
}

export const ST_GLOBALS_SHIM = /* js */ `
  var KNOWN_ST_ONLY_GLOBALS = ${JSON.stringify(KNOWN_ST_ONLY_GLOBALS)};
  var missingGlobalWarn = (${makeMissingGlobalWarn.toString()})(function (m) { console.warn(m); });
  var installLoudMissingGlobal = ${installLoudMissingGlobal.toString()};
  KNOWN_ST_ONLY_GLOBALS.forEach(function (n) { installLoudMissingGlobal(window, n, missingGlobalWarn); });
`;
