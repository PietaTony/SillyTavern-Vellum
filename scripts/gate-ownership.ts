/**
 * 這支在守什麼：`AGENTS.md` 的唯一規則——**一個檔案只有一個寫入者**——真的成立。
 * 三種壞法都要抓：
 *   ① 沒人認領（兩個 agent 都覺得可以動）
 *   ② 兩人認領（正是這整套要防的東西）
 *   ③ 🔴 新檔沒被任何定義檔納入——症狀是「什麼都沒發生」，最常發生也最難發現
 *
 * 解析對象：`.claude/agents/*.md` 的「## 1 · Files you own」區塊 ＋ `AGENTS.md`
 * 「## 2 · Files nobody owns」區塊。這是文字探勘，不是型別系統，所以下面四個坑
 * 都真的誤報過一次，改的時候不要繞過去重犯：
 *   1. 只解析 §1 到「## 2 · Files you must not write」之間——§2 是別人的檔
 *   2. `🔴` 開頭的說明段整段跳過，直到下一個 bullet——它常提到別層的檔名
 *   3. `- \`dir/\` — a.ts` 之後的縮排續行要沿用同一個 dir 前綴
 *   4. `**except** \`x.ts\`` 是排除語句，不是認領——解析前先整句剝掉
 *
 * 2026-08-28 補洞（第一輪）：一支 fresh-context verifier 做了 23 次突變，判決是
 * 「無孤兒」只在原本劃定的掃描範圍內成立，範圍外放新檔進去，本閘門 exit 0 靜默
 * PASS。又加了兩類判斷，改的時候一樣不要繞過去重犯：
 *   5. `covered()` 原本 own → X → glob **依序查、從不互撞**——一個 agent 在 §1
 *      具名認領了「AGENTS.md §2 的無主檔」或「別人 glob 底下的既有檔」都會靜默
 *      PASS。`crossCheckClaims()` 補上這兩種對撞；合法的 `**except**` 具名例外
 *      不算——例外清單從**未剝除 except 子句的原文**單獨抽取（`extractExceptions`），
 *      跟被剝過的 `ownedSection()` 是兩條平行的解析路徑，不要合併，合併就會把
 *      例外本身也剝掉，讓它拿不到自己要放行的那個路徑。
 *   6. 掃描範圍（`buildTargets`）本身太窄：`listFiles()` 不遞迴、副檔名縮限，
 *      造成五個位置的孤兒永遠測不到——`server/` 根目錄、`server/lib/` 以下的新子
 *      目錄、`src/app/` 以下的新子目錄、`src/` 根目錄、`src/app/routes/*.ts`（原本
 *      只 walk `.tsx`）。現在 `server/` 與 `src/app/` 全部遞迴掃（除了下面第 8 點
 *      排除的 `__tests__/`），`src/` 根目錄與 repo 根目錄的具名檔另外列。
 *   7. `src/features/**` 維持**目錄粒度**，不遞迴到檔案層。10 個現存子目錄底下
 *      約 202 個檔，每一個都已被某個 agent 的 `src/features/<name>/**` glob
 *      整組認領；遞迴進去對「抓孤兒」買不到任何東西，只會讓標的數暴增。
 *      四個綠地層（audio/commands/extensions/presets）的 glob 指向的目錄現在
 *      還不存在，那是刻意的（`AGENTS.md` §1：先宣告檔案再寫它）——`readdirSync`
 *      只列現存目錄，不存在的目錄不會被當孤兒，也不需要額外的「未使用 glob」
 *      檢查去豁免它們。
 *   8. `server/__tests__/` `src/app/__tests__/`（AGENTS.md X4，兩個扁平目錄、
 *      檔名決定歸屬）完全沒有機制守——這一輪刻意排除，**但排除的檔數要印出來**
 *      （PASS 訊息裡的「另外排除」那段），不然它會變成下一個看不見的洞。
 *      X4 的文字本身不影響這支的掃描結果——它的排除規則寫死在 `buildTargets()`
 *      裡（`SKIP` 這個目錄名集合），不是讀 `AGENTS.md` 解析出來的；兩邊只是
 *      約定要講同一句話，不是同一份資料來源。
 *
 * 2026-08-28 補洞（第二輪）：同一支 verifier 再打了約 20 次，判「部分成立」——
 * 上一輪修的東西裡有一半**沒被 `--selftest` 真的守到**，是裝飾品。這輪修四個：
 *   9. 🔴 **`--selftest` 從沒呼叫過 `walk()`／`buildTargets()`。** 把 `walk()`
 *      的遞迴呼叫整條砍掉，標的數從 171 崩到 29，`--selftest` 跟真跑都照樣 PASS。
 *      現在 `--selftest` 直接對 `walk()` 跑一棵臨時造的巢狀 fixture（用完即刪），
 *      斷言遞迴真的鑽得到三層深；另外對 `buildTargets()` 的**六個掃描根各自**
 *      斷言至少一個標的證明那一段邏輯真的執行了（server/ 與 src/app/ 用「巢狀
 *      深度」證明遞迴有效，其餘四段用「該類標的存在」證明那行程式碼真的跑了）。
 *   10. 🔴 **涵蓋率閘只擋 0，不擋「變很少但還不到 0」。** 加了 `coverageFloor()`：
 *      拿 `server/` 與 `src/app/` 這兩個遞迴掃描根的「深/淺比」當尺——不寫死一個
 *      會過期的總數常數（新增檔案時深、淺兩邊會一起長，比例不太動；只有 `walk()`
 *      真的不遞迴了，深的那邊才會塌到跟淺的一樣）。實測現況比例約 12.8（深 154／
 *      淺 12），門檻定 3 留了大量安全邊界；`walk()` 遞迴被砍掉時比例塌到約 1。
 *   11. `crossCheckClaims()` 原本只拿 `own`（具名認領）去對撞 X／Xg／別人的
 *      glob——**glob 對 glob 本身從不對撞任何東西**，而 `src/features/**` 這類
 *      目錄多半就是靠 glob 宣告，不是具名逐檔，第②類壞法在 glob 層級完全失守。
 *      補了兩件事：(a) `globs` 原本用 `Map.set()` 累積，兩個 agent 逐字宣告
 *      同一個 glob 時後寫入的會**靜默覆蓋**前一個，連「兩人都宣告」這件事本身
 *      都消失——改成跟具名檔同一套 `claim`/`addDup` 機制（`claimGlob`），寫進
 *      `globDup`；(b) 就算字面不同但前綴重疊（例如某 agent 宣告了 Xg 底下的
 *      `src/shared/**`，或兩個 agent 一個宣告 `x/**` 一個宣告 `x/y/**`），
 *      `crossCheckClaims()` 現在兩兩比對所有 glob 前綴，也比對 X／Xg。
 *   12. `**except** \`x.ts\`` 的例外清單原本只用來「不要誤判成重複」，從不驗證
 *      那個路徑真的有主——手滑漏寫某個 agent 的具名認領時，那支檔會靜默被排除
 *      清單掩蓋、改姓給宣告 glob 的那一層，沒有紅燈。加了 `unclaimedExceptions()`：
 *      每一個例外路徑都要能在 `own` 裡找到真正的認領者，找不到就是孤兒穿著例外
 *      的外衣，直接 FAIL。順便把 `extractExceptions()` 的擷取正則收緊：舊版是
 *      「`**except**` 之後這一行所有反引號 `.ts` 檔名全算」，連寫在括號說明文字
 *      裡順口提到的檔名（`**except** \`a.ts\` (replaces the old \`b.ts\` shim)`
 *      裡的 `b.ts`）都會被誤收進合法例外——現在要求每個被算進例外的檔名**緊接著
 *      自己的一組 `(...)`**（既有寫法 `\`a.ts\` (H5's)` 本來就是這個形狀），
 *      只在括號說明文字裡被提到、後面沒有立刻接自己括號的檔名不算。
 *
 * 2026-08-28 補洞（第三輪）：同一支 verifier 再打了約 25 次，判「部分成立」——
 * 找到兩個新洞（其中兩處其實是同一個病）：
 *   🔴 **每加一條新的平行解析路徑，都要重新問一次上面這份舊坑清單。** 這支檔第
 *      一輪就承認過「例外清單跟 `ownedSection()` 是兩條平行路徑，不要合併」，
 *      但沒有把這句話推廣成規則——結果坑②（🔴 說明段跳過）在具名檔那條路徑修過
 *      一次之後，同一個坑在 glob 那條路徑、`nobodyOwns()` 那條路徑完全沒補到。
 *      下面 5-2、5-1 就是這兩個沒補到的坑，補的方式是把「說明段跳過」收成
 *      `stripNotes()` 一個函式，三條路徑都呼叫它，不再各自維護一份判斷。
 *   5-2. `parseClaims()` 原本只在具名檔那段逐行呼叫 `nextNoteState`；glob 的擷取
 *      （`body.matchAll(GLOB_RE)`）是對整段原文跑的，說明段裡順口提到別人的 glob
 *      做澄清（例如「🔴 not \`x/**\`，that's H9's」）會被誤認領成自己的。現在
 *      glob 擷取跟具名檔一樣，先過 `stripNotes()`。
 *   5-1. `nobodyOwns()`（`AGENTS.md` §2）完全沒有說明段的概念——不是漏補
 *      `stripNotes()`，是它原本對整段 §2 原文（一張 markdown 表格）跑正則，
 *      不分欄。§2 沒有「🔴 段落」這種結構，有的是「表格欄位」：Why／What to do
 *      欄本來就會提到別人的檔名做澄清（X4 那一列現在就在用：「\`chatFile.test.ts\`
 *      is H1's」），跟坑②是同一條律的另一種寫法——「只有結構上指定的宣告位置算數，
 *      其餘都是解釋文字」，只是具名檔／glob 用「🔴 開頭到下一個 bullet」界定，
 *      §2 用「表格第幾欄」界定。加了 `pathsColumnOnly()`：只取每一列的第 2 個
 *      cell（Paths 欄），其餘欄位與表格外的散文（例如「### Not owned by anyone」
 *      那段）一律不算。
 *   5-3. PASS 訊息裡「排除 __tests__ N 個檔」的 N 是錯的——舊版只加
 *      `server/__tests__/` 與 `src/app/__tests__/` 兩個寫死的路徑，漏算了
 *      `src/app/screens/__tests__/`（同一個目錄名，巢狀在更深的地方；`walk()`
 *      的 `SKIP` 判斷其實在任何深度都會跳過它，回報用的計數卻只知道兩個固定
 *      位置）。改成 `countTestFiles()`：遞迴找「目錄名剛好叫 __tests__」，
 *      不管深度，跟 `walk()` 實際跳過的範圍用同一套判斷方式，數字才不會脫節。
 *      一個錯的數字比沒有數字更糟——它看起來像已經被量過了。
 *   A2. `coverageFloor()` 的深/淺比會被**合規的成長**壓垮：往 `server/` 或
 *      `src/app/` 頂層加檔（合規、常見的成長模式）會讓「淺」那邊漲得比「深」
 *      快，比例往下掉，跟「遞迴真的斷了」長得一樣，紅燈訊息卻只會講後者，
 *      把人導去查一個沒壞的地方。換成兩把不受頂層新檔影響的尺（`deep` 絕對數
 *      下限 ＋ `maxDepth` 遞迴層數下限），細節見 `coverageFloor()` 自己的檔頭。
 *
 * 2026-08-28 補洞（第五輪）：同一支 verifier 再打了約 25 次，判「部分成立」——
 * 找到四個洞，優先序照嚴重度排：
 *   C2（最高）：`coverageFloor()` 量的是「整個掃描根」的總深度／總鑽層數，粒度
 *      太粗——**整個子目錄**（`server/lib/` 48 檔、`server/routes/` 20 檔、
 *      `src/app/screens/` 19 檔）從 `targets` 消失，deep／maxDepth 兩把舊尺全部
 *      放行，而且這些檔根本沒進 `targets`，孤兒偵測永遠測不到它們——比「floor
 *      沒抓到」更安靜，連 FAIL 訊息都不會有。補了 `subdirCoverage()`：對每個
 *      掃描根底下的一級子目錄，用 Node 內建的 `readdirSync(dir, {recursive:true})`
 *      （不是 `walk()` 那段手寫遞迴）獨立算一次「有沒有 .ts 檔」，跟 `targets`
 *      對不上就是整個子目錄被跳過了。細節、以及「為什麼這把尺不會跟 `walk()`
 *      一起壞」見 `subdirCoverage()` 自己的檔頭。
 *   B3：說明段的判斷原本只認「🔴 在行首」——`providers.md:21` 這種「🔴 在句子
 *      中間、整行本身又是 bullet」的形狀完全不觸發，🔴 之後的文字被當成正常內容
 *      解析。今天安全只是巧合（那句說明裡沒帶反引號檔名）；複驗造了同款帶檔名
 *      的版本餵給真正的 `parseClaims()`，檔名被靜默誤認領——四個洞裡唯一一個
 *      「閘門維持綠燈但歸屬是錯的」。
 *   B1：說明段只在「下一個 bullet」出現時才結束——`bullet → 🔴 說明 → 真續行`
 *      這種形狀裡，真續行不是 bullet，被整段吃掉，沒人認領。這不是這輪的迴歸，
 *      是 `nextNoteState` 從第一輪就有的重置條件本身的洞，現有的定義檔剛好都
 *      是「先列完檔、🔴 說明才放最後」，所以從沒踩過——但這是這個 repo 最自然的
 *      下一步編輯。
 *   B3／B1 兩個一起改：`stripNotes()` 現在逐字元找 🔴（不假設在行首、不假設這行
 *      不是 bullet），🔴 之前的文字照常解析；說明段的結束條件除了「下一個 bullet」
 *      多加一條「整行只由反引號檔名／逗號／空白組成」（`isPureFileListLine()`）
 *      ——這才是坑③要接回去的真續行的樣子，跟散文說明句在形狀上不會混淆。
 *   D：`extractExceptions()` 的 `**except**` 例外清單原本假設「一組括號只幫一個
 *      緊接著的檔名背書」——`` `a.ts`, `b.ts` (both H5's) `` 這種一組括號幫一串
 *      逗號分隔檔名背書的寫法下，只有緊接括號的 `b.ts` 進例外清單，`a.ts` 沒有，
 *      會被 `unclaimedExceptions()`（坑⑫）誤判成孤兒穿例外外衣、悄悄改姓給宣告
 *      glob 的那個 agent。`EXCEPT_GROUP_RE` 先抓「一串連續、逗號分隔、緊接同一組
 *      括號」的檔名區塊，再從區塊裡逐一抽檔名——中等坑 4（括號說明文字裡順口提到
 *      的檔名不算）沒有被這次改動打開，因為「區塊」在遇到非「逗號+反引號檔名」的
 *      字元就停止延伸，括號內文字不會被當成區塊的一部分。
 *
 * 🔴 **46 條全綠只證明這 46 種已知形狀被擋住，不證明沒有第 47 種。** 這一輪找到
 * 的四個洞都不在原本那 46 條裡，而且 B3 用的是 repo 裡**已經存在**的寫法
 * （`providers.md:21`）、C2 打的是**最普通**的一種 bug（子目錄整個被跳過）——
 * 兩者都不是刁鑽的邊界案例，是這支檔案本來就該擋、卻沒擋住的日常形狀。改這支
 * 檔案的人下一次也不該假設「現有案例都綠 = 沒有下一個洞」。
 *
 * 2026-08-28 補洞（第六輪，範圍限定 A3）：複驗判「部分成立」，B1/B2/B3/B4/D1/D2
 * 全過，只留一個洞——**C2 那把「第二把尺」自己也只查一級**。用真實
 * `buildTargets()` 輸出證明：`server/providers/formats/`（二級目錄，5 檔）與
 * `src/app/routes/settings/providers/`（三級目錄）整個從 `targets` 消失時，舊版
 * `subdirCoverage()` 兩個都放行——因為它只問「`server/providers/` 這個**一級**
 * 子目錄底下還有沒有任何標的」，`server/providers/registry.ts` 等同層檔案還在，
 * 就被掩護過去，完全沒問 `formats/` 這個路徑自己有沒有標的。C2 那一輪的檔頭原本
 * 就在講「子目錄整個消失」，卻只把這句話兌現到第一層，同一種盲區只是被推到下一
 * 層。改法、以及為什麼還是不會跟 `walk()` 一起壞，見 `collectSubdirCounts()` 與
 * `subdirCoverage()` 自己的檔頭（往上找 A3 這個標籤）。
 *
 * 順便修了同一段程式碼裡的另一個舊坑：`independentSubdirFileCount()`（現已改名為
 * `collectSubdirCounts()`）原本的 `try/catch` 把任何 `readdirSync` 失敗都吞成
 * `entries = []` → `count = 0` → 跟「這個目錄真的是空的」長得一模一樣，靜默通過。
 * 用 `chmod 000` 實測過：今天不會變成靜默綠燈，只因為 `walk()`（沒有 try/catch）
 * 會先在同一個掃描根撞到同一個錯誤整個當機——那是執行順序的巧合，不是設計，未來
 * 任何把 `walk()` 包一層 try/catch「加固」的合理重構都會把這裡從「當機」降級成
 * 「靜默通過」。現在讀取失敗會記進 `failedDirs`、讓這一輪 FAIL，不會被當成 0。
 *
 * 自證：pnpm exec tsx scripts/gate-ownership.ts --selftest
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { dirOf, groupByDir, singleOwnerDirs } from './gate-ownership-dirgrain.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const AGENTS_DIR = join(ROOT, '.claude/agents');

type OwnerMap = Map<string, string>;
type DupMap = Map<string, Set<string>>;

const GLOB_RE = /`([\w$./@-]+\/\*\*)`/g;
const FILE_RE = /`([\w$./-]+\.tsx?|package\.json)`/g;
// 例外清單只算「緊接著自己那組括號說明」的檔名——見檔頭第 12 點。
// 第五輪坑 D：一組括號可以幫**逗號分隔的一串檔名**背書（`a.ts`, `b.ts` (both H5's)），
// 不是只有「單一檔名 + 自己的括號」這一種形狀——`EXCEPT_GROUP_RE` 先抓「一串連續、
// 以逗號分隔、緊接著同一組括號」的檔名區塊，`EXCEPT_FILE_RE` 再從那個區塊裡逐一
// 抽出檔名。括號*說明文字裡*順口提到的檔名不會落在「區塊」裡（區塊在遇到非「逗號+
// 反引號檔名」的字元就會停止延伸），所以中等坑 4（`gemini.ts` (replaces the old
// `legacyAdapter.ts` shim)）依然只抽得到 `gemini.ts`，不會被這次的改動打開。
const EXCEPT_GROUP_RE =
  /((?:`(?:[\w$./-]+\.tsx?|package\.json)`)(?:\s*,\s*`(?:[\w$./-]+\.tsx?|package\.json)`)*)\s*\([^)]*\)/g;
const EXCEPT_FILE_RE = /`([\w$./-]+\.tsx?|package\.json)`/g;
const DIR_BULLET = /^\s*-\s*`([\w/.$-]+\/)`\s*—(.*)$/;
const BULLET = /^\s*-\s/;
const TEST_DIR_NAME = '__tests__';
// repo-root 具名檔——Peter 2026-08-28 裁定，見 `.claude/agents/platform.md` §1「Build & ship」
const ROOT_FILES = ['package.json', 'vite.config.ts', 'vitest.config.ts'];
// 涵蓋率下限的兩個常數（`MIN_DEEP_COUNT`、`MIN_RECURSION_DEPTH`）定義在 `coverageFloor` 旁邊——
// 見那邊的檔頭，A2 那一輪把深/淺比換成這兩把絕對尺。

function claim(own: OwnerMap, dup: DupMap, path: string, agent: string): void {
  const existing = own.get(path);
  if (existing === undefined) {
    own.set(path, agent);
    return;
  }
  if (existing !== agent) addDup(dup, path, existing, agent);
}

function addDup(dup: DupMap, path: string, a: string, b: string): void {
  const s = dup.get(path) ?? new Set<string>();
  s.add(a);
  s.add(b);
  dup.set(path, s);
}

/**
 * Glob 認領跟具名檔用同一套衝突偵測（見檔頭第 11 點 a）。直接 `Map.set()` 會讓
 * 後寫入的 agent 覆蓋前一個，兩個 agent 逐字宣告同一個 glob 就會從紀錄裡消失
 * ——不是「沒偵測到」，是資料本身在解析階段就被抹掉了。
 */
function claimGlob(globs: OwnerMap, globDup: DupMap, g: string, agent: string): void {
  const existing = globs.get(g);
  if (existing === undefined) {
    globs.set(g, agent);
    return;
  }
  if (existing !== agent) addDup(globDup, g, existing, agent);
}

/** 只取 §1（坑①）。 */
export function extractSection(text: string): string {
  const m = text.match(/## 1 · Files you own\n([\s\S]*?)\n## 2 · Files you must not write/);
  return m?.[1] ?? '';
}

/** 坑④：把 **except** 排除句整句剝掉，剩下的才拿去找「認領」。先過 `stripNotes()`。 */
export function ownedSection(text: string): string {
  return stripNotes(extractSection(text)).replace(/\*\*except\*\*[^\n]*/g, '');
}

/**
 * 例外清單要在剝除 `**except**` 之前抽——剝完之後那句話本身就不在了，
 * 沒有東西可以抽。跟 `ownedSection()` 是兩條平行路徑，不要合併。
 *
 * 一行可以列不只一個例外（`**except** \`a.ts\` (H8's), \`b.ts\` (H9's)`）——
 * `**except**` 後面到行尾的每一個「具名檔緊接自己括號說明」都算。只出現在
 * 別的檔名括號說明文字裡的反引號檔名不算——見檔頭第 12 點。
 *
 * 內部自己呼叫 `stripNotes()`（不假設呼叫方已經處理過）——說明段裡順口寫一句
 * 帶 `**except**` 字樣的話（例如解釋另一支檔為什麼不算例外）不該被誤收。
 */
export function extractExceptions(rawSection: string): Set<string> {
  const out = new Set<string>();
  for (const line of stripNotes(rawSection).split('\n')) {
    const idx = line.indexOf('**except**');
    if (idx === -1) continue;
    const glob = [...line.slice(0, idx).matchAll(GLOB_RE)].pop()?.[1] ?? '';
    if (!glob) continue;
    // 第五輪坑 D：先抓「檔名, 檔名, ... (括號)」整塊，再從塊裡逐一抽檔名——
    // 一組括號底下可能不只一個檔名。
    for (const gm of line.slice(idx).matchAll(EXCEPT_GROUP_RE)) {
      const group = gm[1] ?? '';
      for (const fm of group.matchAll(EXCEPT_FILE_RE)) {
        const file = fm[1] ?? '';
        if (file) out.add(glob.slice(0, -2) + file);
      }
    }
  }
  return out;
}

/**
 * 一行「去掉所有反引號檔名 token、逗號、空白之後」還剩不剩東西——用來分辨
 * 「純粹是檔名列表的續行」（坑③要接得回去的那種）跟「說明段的散文續行」
 * （坑②要繼續跳過的那種）。見第五輪坑 B1 的檔頭說明。
 */
function isPureFileListLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const residue = trimmed.replace(/`(?:[\w$./-]+\.tsx?|package\.json)`/g, '').replace(/[,\s]/g, '');
  return residue.length === 0;
}

/**
 * 🔴 說明段跳過的**唯一實作**——第三輪的教訓：這支檔案有三條平行的解析路徑
 * （具名檔、glob、`nobodyOwns()`），坑②原本只在具名檔那條路徑手工做了一次
 * （逐行呼叫舊版的 `nextNoteState`），glob 那條路徑對整段 `body` 原文做正則、完全
 * 不管說明段；`nobodyOwns()` 更誇張——連「說明段」這個概念都沒有，是對整個 §2
 * 原文做正則。兩邊都被複驗用「模仿既有行文的澄清句」打穿，見檔頭 5-1／5-2。
 *
 * 現在只有這一個函式知道「🔴 到下一個 bullet 之間不算」，`parseClaims()` 的具名檔
 * 迴圈與 glob 擷取都呼叫它，不再各自維護一份 `note` 狀態機。
 *
 * 第五輪補了兩個這個函式自己漏掉的形狀（複驗坑 B3／B1，見檔頭第五輪說明）：
 *   B3：舊版只認「🔴 在行首」（`line.trimStart().startsWith('🔴')`）。`providers.md:21`
 *      的真實寫法是 `` - `server/adapters/gemini.ts` — 🔴 in `adapters/`, not `lib/` `` ——
 *      🔴 在句子中間，這整行本身又是一個 bullet，舊版判斷「先看 🔴 再看 bullet」，
 *      bullet 贏，於是整行被當成「不是說明段」，🔴 之後的文字完全沒被剝掉。今天
 *      安全只是運氣好（🔴 後面沒帶反引號檔名）；同一句型只要換成提另一個 agent
 *      的檔名，就會被「行是 bullet」這個判斷誤放行、靜默認領。現在改成**在行內找
 *      🔴 的位置**，不管它是不是在行首、這行是不是 bullet——🔴 之前的文字照常解析
 *      （bullet／dir 前綴／檔名都在那一段），🔴 之後（含它自己）進入說明段狀態，
 *      沿用到下一個 bullet 或下一個「純檔名列表行」為止。
 *   B1：舊版的說明段只在遇到「下一個 bullet」才結束——`bullet → 🔴 說明 → 真續行`
 *      這種形狀裡，真續行不是 bullet，於是被整行吃掉，沒人認領。這不是這一輪的
 *      迴歸，是 `nextNoteState` 從第一輪就有的重置條件本身的洞（見檔頭第三輪
 *      5-1/5-2 之後的教訓：往設計層查，不要往抽取過程查）。現有八支定義檔目前都
 *      是「先列完檔、最後才接 🔴」，所以這個洞從沒被踩過——但這正是這個 repo 最
 *      自然的下一步編輯（先列幾個檔、中間插一句澄清、再補幾個檔）。用
 *      `isPureFileListLine()` 當第二個結束說明段的條件：一行如果**整行**只由反
 *      引號檔名（加逗號、空白）組成、沒有任何散文字，判定它是坑③要接的真續行，
 *      不是說明段的自然語言延伸——說明段的每一句到現在為止都至少帶一個介詞／
 *      標點以外的英文字，兩者不會混淆。這是啟發式，不是語法分析：如果哪天有人
 *      寫出「見 `a.ts`, `b.ts`」這種說明句、又剛好整行只有這兩個 token 跟逗號，
 *      會被誤判成真續行——但目前 repo 裡沒有這種寫法，而且這種誤判的後果只是
 *      「多認領兩個本來就相關的檔名」，不是「弄丟一個孤兒」，風險不對稱地小。
 */
export function stripNotes(body: string): string {
  const out: string[] = [];
  let note = false;
  for (const line of body.split('\n')) {
    if (note) {
      if (BULLET.test(line) || isPureFileListLine(line)) {
        note = false; // 新 bullet 或純檔名續行都會結束說明段——往下重新解析這一行
      } else {
        out.push('');
        continue;
      }
    }
    const idx = line.indexOf('🔴');
    if (idx === -1) {
      out.push(line);
      continue;
    }
    out.push(line.slice(0, idx)); // 🔴 之前的文字照常保留（bullet／檔名都在這一段）
    note = true; // 🔴 自己與之後的文字都算說明段，即使這一行本身是 bullet
  }
  return out.join('\n');
}

/** 坑③：`- \`dir/\` — a.ts` 更新目錄前綴；續行（非 bullet）沿用舊前綴。 */
function nextLineContext(line: string, cur: string | null): { cur: string | null; rest: string } {
  const dm = line.match(DIR_BULLET);
  if (dm) return { cur: dm[1] ?? null, rest: dm[2] ?? '' };
  if (BULLET.test(line)) return { cur: null, rest: line };
  return { cur, rest: line };
}

function claimFilesIn(
  rest: string,
  cur: string | null,
  agent: string,
  own: OwnerMap,
  dup: DupMap,
): void {
  for (const fm of rest.matchAll(FILE_RE)) {
    const f = fm[1] ?? '';
    if (f.includes('.test.') || f.startsWith('<')) continue;
    const path = f.includes('/') && cur === null ? f : (cur ?? '') + f;
    claim(own, dup, path, agent);
  }
}

/**
 * 坑② + 坑③：逐行解析，說明段跳過、目錄前綴延續到續行。
 *
 * 5-2：glob 擷取原本對整段 `body` 原文跑 `GLOB_RE`，跑在說明段跳過**之前**——
 * 一句「🔴 not `x/**` (that's H9's, just flagging for clarity)」會讓 `x/**`
 * 被本 agent 誤認領。現在跟具名檔那條路徑共用同一份 `stripNotes()`，兩條路徑
 * 看到的都是已經拿掉說明段的文字，不再各自決定「要不要跳」。
 */
export function parseClaims(
  body: string,
  agent: string,
  own: OwnerMap,
  dup: DupMap,
  globs: Map<string, string>,
  globDup: DupMap,
): void {
  const stripped = stripNotes(body);
  for (const g of stripped.matchAll(GLOB_RE)) claimGlob(globs, globDup, g[1] ?? '', agent);

  let cur: string | null = null;
  for (const line of stripped.split('\n')) {
    const ctx = nextLineContext(line, cur);
    cur = ctx.cur;
    claimFilesIn(ctx.rest, cur, agent, own, dup);
  }
}

function loadAgentClaims(): {
  own: OwnerMap;
  dup: DupMap;
  globs: Map<string, string>;
  globDup: DupMap;
  exceptions: Set<string>;
} {
  const own: OwnerMap = new Map();
  const dup: DupMap = new Map();
  const globs = new Map<string, string>();
  const globDup: DupMap = new Map();
  const exceptions = new Set<string>();
  for (const f of readdirSync(AGENTS_DIR)
    .filter((n) => n.endsWith('.md'))
    .sort()) {
    const agent = f.slice(0, -3);
    const raw = readFileSync(join(AGENTS_DIR, f), 'utf8');
    // 曾經在這裡手刻一份 `.replace(/\*\*except\*\*.../, '')`，跟 `ownedSection()`
    // 是同一段邏輯的第二份拷貝——兩份一致是巧合，不是保證。現在只有一份。
    for (const p of extractExceptions(extractSection(raw))) exceptions.add(p);
    parseClaims(ownedSection(raw), agent, own, dup, globs, globDup);
  }
  return { own, dup, globs, globDup, exceptions };
}

/**
 * 5-1：`AGENTS.md` §2 是 markdown 表格（`| 標籤 | Paths | Why | What to do |`），
 * 舊版對整段 §2 原文跑 `FILE_RE`／`GLOB_RE`，不分欄——「Why」「What to do」欄本來
 * 就會提到別的 agent 的檔名做澄清（X4 那一列現在就在用這種寫法：「`chatFile.test.ts`
 * is H1's」），舊版把這種澄清當成「這個檔案沒人管」，跟具名認領它的 agent 撞出假重複。
 *
 * 這是跟 5-2 同一條律的另一種寫法：具名檔／glob 那兩條路徑用 `🔴` 開頭的**段落**
 * 界定「這不是宣告」；§2 是表格，沒有段落可言，界定「這是宣告」的結構是**欄位**——
 * 只有「Paths」欄（每一列的第 2 個 cell）算數，其餘欄位、以及表格外的說明段落
 * （例如「### Not owned by anyone」那段散文），無論裡面提到什麼檔名都不算。
 */
export function pathsColumnOnly(section: string): string {
  const out: string[] = [];
  for (const line of section.split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    out.push(line.split('|')[2] ?? '');
  }
  return out.join('\n');
}

export function parseNobodyOwnsSection(section: string): { X: Set<string>; Xg: Set<string> } {
  const body = pathsColumnOnly(section);
  return {
    X: new Set([...body.matchAll(FILE_RE)].map((x) => x[1] ?? '')),
    Xg: new Set([...body.matchAll(GLOB_RE)].map((x) => x[1] ?? '')),
  };
}

function nobodyOwns(): { X: Set<string>; Xg: Set<string> } {
  const text = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
  const m = text.match(/## 2 · Files nobody owns\n([\s\S]*?)\n## 3 ·/);
  return parseNobodyOwnsSection(m?.[1] ?? '');
}

/**
 * 坑⑤＋坑⑪：`own`（具名認領）跟 `globs`（glob 認領）都要跟「沒人認領」與
 * 「別人的宣告」對撞，不只跟同類的自己對撞。
 *   ⑤a／⑤b own  vs X／Xg／別人的 glob（見檔頭第 5 點）
 *   ⑪a     glob 對 glob 逐字重複——`globDup` 在解析階段就記下來了，這裡併回主 dup
 *   ⑪b     glob vs X／Xg／別人的 glob（前綴重疊，字面不同）——見檔頭第 11 點
 * 全域跑（不只掃 targets 裡的檔）——宣告本身衝突，不需要等它出現在掃描範圍裡才算數。
 */
export function crossCheckClaims(
  own: OwnerMap,
  dup: DupMap,
  X: Set<string>,
  Xg: Set<string>,
  globs: Map<string, string>,
  exceptions: Set<string>,
  globDup: DupMap,
): void {
  for (const [path, agent] of own) {
    if (X.has(path)) addDup(dup, path, agent, 'X');
    for (const g of Xg) if (path.startsWith(g.slice(0, -2))) addDup(dup, path, agent, 'X');

    if (exceptions.has(path)) continue;
    for (const [g, gAgent] of globs) {
      if (gAgent === agent) continue;
      if (path.startsWith(g.slice(0, -2))) addDup(dup, path, agent, gAgent);
    }
  }

  // ⑪a：逐字重複的 glob——`globDup` 已經在 parseClaims 階段記過，這裡併回主 dup。
  for (const [g, agents] of globDup) {
    const list = [...agents];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) addDup(dup, g, list[i] ?? '', list[j] ?? '');
  }

  // ⑪b：字面不同但前綴重疊——glob vs X／Xg／別人的 glob。
  const entries = [...globs.entries()];
  for (let i = 0; i < entries.length; i++) {
    const [gA, agentA] = entries[i] ?? ['', ''];
    const prefixA = gA.slice(0, -2);

    for (const x of X) if (x.startsWith(prefixA)) addDup(dup, gA, agentA, 'X');
    for (const gx of Xg) {
      const prefixX = gx.slice(0, -2);
      if (prefixA.startsWith(prefixX) || prefixX.startsWith(prefixA)) addDup(dup, gA, agentA, 'X');
    }
    for (let j = i + 1; j < entries.length; j++) {
      const [gB, agentB] = entries[j] ?? ['', ''];
      if (agentA === agentB) continue;
      const prefixB = gB.slice(0, -2);
      if (prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA))
        addDup(dup, gA, agentA, agentB);
    }
  }
}

/** 坑⑫：例外清單裡的每一個路徑，都要能在 `own` 裡找到真正的具名認領者。 */
export function unclaimedExceptions(exceptions: Set<string>, own: OwnerMap): string[] {
  return [...exceptions].filter((p) => !own.has(p)).sort();
}

/**
 * 2026-08-28 補洞（第七輪，`INBOX/20260828-ownership-extract-deadlock.md`）：
 * `server/lib/` `server/routes/` `server/services/` `src/app/screens/` 這幾個逐檔
 * 具名（不是 glob）的目錄，一旦頂到 `gate:file-size` 的 150 行上限逼人抽檔，新抽出
 * 的檔案在同一輪 PR 裡沒登記進 §1 就是孤兒——即使那個目錄事實上只有一個 owner，
 * 抽檔完全不會引發「這支到底歸誰」的疑問。`dirOwners`（`singleOwnerDirs()`，見
 * `gate-ownership-dirgrain.ts` 自己的檔頭）在具名／X／glob 都查不到之後再查一次：
 * 這個路徑的直屬目錄，如果**目前所有具名認領都屬於同一個 agent**，就放行給那個
 * agent。🔴 共用目錄（`server/services/` 這種 2 個以上 agent 在同一個目錄都有具名
 * 檔）**不放行**——`singleOwnerDirs()` 自己就會把這種目錄整個排除在回傳的 map
 * 之外，不是這裡再判斷一次；這裡收到的 `dirOwners` 已經是篩過的安全清單，多一層
 * 判斷只會製造「兩個地方各自維護一份判準、遲早兜不攏」的下一個坑。
 * 預設空 Map——舊有呼叫點（`--selftest` 裡近 20 個 `decide()`／`covered()` 呼叫）
 * 不用全部改簽名，行為跟這輪之前完全一樣。
 */
function covered(
  path: string,
  own: OwnerMap,
  X: Set<string>,
  Xg: Set<string>,
  globs: Map<string, string>,
  dirOwners: Map<string, string> = new Map(),
): string | null {
  if (own.has(path)) return own.get(path) ?? null;
  if (X.has(path)) return 'X';
  for (const g of Xg) if (path.startsWith(g.slice(0, -2))) return 'X';
  for (const [g, a] of globs) if (path.startsWith(g.slice(0, -2))) return a;
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const soleAgent = dirOwners.get(dir);
  if (soleAgent) return soleAgent;
  return null;
}

function listFiles(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isFile() && ext.test(n))
    .sort();
}

/** 遞迴 walk；`skipDirNames` 命中的目錄整棵不下鑽（用來排除 `__tests__/`）。 */
function walk(
  dir: string,
  ext: RegExp,
  out: string[] = [],
  skipDirNames: ReadonlySet<string> = new Set(),
): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (skipDirNames.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ext, out, skipDirNames);
    else if (ext.test(p)) out.push(relative(ROOT, p));
  }
  return out;
}

/**
 * 5-3：`server/__tests__/` 底下的檔數 ＋ `src/app/__tests__/` 底下的檔數——
 * 舊版只加這兩個**寫死的路徑**，漏算了 `src/app/screens/__tests__/`（巢狀在
 * `src/app/screens/` 底下，同一個目錄名，`walk()` 的 `SKIP` 判斷其實在任何深度
 * 都會跳過它，但舊版的「回報用」計數只知道兩個固定位置，兩者對不上）。
 * 改成跟 `walk()` 用同一套判斷方式——遞迴找「目錄名剛好叫 `__tests__`」，不管
 * 深度，數字就不會再跟 `SKIP` 實際跳過的範圍脫節。
 *
 * 🔴 只數 `server/` 與 `src/app/` 這兩個遞迴掃描根底下的——`src/features/**` 是
 * 目錄粒度（本來就不會遞迴進去看 `__tests__/`），`src/shared/**` 是 X1（本來就
 * 不在這支的掃描範圍內）。這兩類的 `__tests__/` 不是「排除」，是「本來就沒被掃到」，
 * 兩種概念不一樣，不能混進同一個數字——混了這個數字就又變成一個「講不清楚在講
 * 什麼量」的洞。
 */
function countTestFiles(dir: string, ext: RegExp): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (!statSync(p).isDirectory()) continue;
    if (n === TEST_DIR_NAME) count += walk(p, ext).length;
    else count += countTestFiles(p, ext);
  }
  return count;
}

/** 一段路徑相對於 prefix 之後，最多鑽了幾層——用來證明遞迴真的往下鑽，不是只掃頂層。 */
function maxDepthUnder(prefix: string, targets: string[]): number {
  let max = 0;
  for (const t of targets) {
    if (!t.startsWith(prefix)) continue;
    const depth = t.slice(prefix.length).split('/').length;
    if (depth > max) max = depth;
  }
  return max;
}

export function buildTargets(): { targets: string[]; excludedTests: number } {
  const TS_EXT = /\.tsx?$/;
  const SKIP = new Set([TEST_DIR_NAME]);
  const targets = new Set<string>();

  // server/** 全遞迴（含根目錄 app.ts/index.ts/static.ts，含未來任何深子目錄）
  for (const f of walk(join(ROOT, 'server'), TS_EXT, [], SKIP)) targets.add(f);
  // src/app/** 全遞迴（含 routes 底下的 .ts，不再只抓 .tsx；含未來任何深子目錄）
  for (const f of walk(join(ROOT, 'src/app'), TS_EXT, [], SKIP)) targets.add(f);
  // src/ 根目錄的具名檔（不含 src/app、src/features——那兩個各自另外處理）
  for (const f of listFiles(join(ROOT, 'src'), TS_EXT)) targets.add(`src/${f}`);
  // repo 根目錄具名檔——Peter 2026-08-28 裁定
  for (const f of ROOT_FILES) if (existsSync(join(ROOT, f))) targets.add(f);
  // electron/**：目前只有頂層 .cjs，platform.md 的 `electron/**` glob 蓋得到
  for (const f of listFiles(join(ROOT, 'electron'), /\.cjs$/)) targets.add(`electron/${f}`);
  // src/features/**：刻意維持目錄粒度，見檔頭第 7 點
  if (existsSync(join(ROOT, 'src/features')))
    for (const n of readdirSync(join(ROOT, 'src/features')))
      if (statSync(join(ROOT, 'src/features', n)).isDirectory()) targets.add(`src/features/${n}/`);

  const excludedTests =
    countTestFiles(join(ROOT, 'server'), TS_EXT) + countTestFiles(join(ROOT, 'src/app'), TS_EXT);

  return {
    targets: [...targets].filter((t) => !t.includes('routeTree.gen')),
    excludedTests,
  };
}

type RootFloor = { deep: number; shallow: number; maxDepth: number; ok: boolean };

/**
 * A2：門檻改成「絕對深度數下限」＋「遞迴深度真的鑽到位」，兩者都要過，而且兩者都
 * **只會隨成長變大，不會被合規成長壓小**——不再是深/淺比例。
 *
 * 舊版（深/淺比 ≥3x）在 `src/app/` 只留了 1.8x 的安全邊際（現況 5.4x）。往
 * `src/app/` 頂層合規地加 12 個新檔（這一輪本身就往 X3 加了 `src/main.tsx`
 * 這種模式）會讓淺的那邊漲得比深的那邊快，比例塌到 2.90x，紅燈——但沒有任何
 * 東西壞掉，紅燈訊息卻說「像是遞迴掃描被改壞了」，把人導去查一個沒壞的地方。
 * 這是量測管道自己在說謊：分母（淺）會被合規成長稀釋，分子（深）不會同步跟上。
 *
 * 改成兩把**不受頂層新檔影響**的尺：
 *   1. `deep >= MIN_DEEP_COUNT`——遞迴掃到的絕對檔數下限，訂在現況（server 104、
 *      app 49）之下留出安全邊際，但遠高於「遞迴整個失效」時會塌到的量級（塌到
 *      跟 `listFiles()` 只掃頂層差不多，server ~3、app ~9）。往頂層加檔只會讓
 *      這個數字變大，不會變小，永遠不會被合規成長觸發。
 *   2. `maxDepth >= MIN_RECURSION_DEPTH`——遞迴真的鑽到至少三層，不是只鑽一層
 *      就停。這一段補的是絕對數字擋不住的洞：實測「`walk()` 只鑽一層」這種
 *      改法（很寫實，不是刻意逼近門檻）幾乎不影響絕對檔數（server 104→99、
 *      app 49→33，都遠高於下限）——因為這個 repo 大多數檔案本來就只有兩層深。
 *      但這種改法會讓「三層以上」的檔案全部消失，`maxDepth` 直接塌到 2，
 *      這一段抓得到，前一段抓不到。同樣不受頂層新檔影響：加在頂層的新檔
 *      深度是 1，不會把 `maxDepth` 往下拉。
 *      🔴 `server/` 現況 `maxDepth` 剛好等於 3（只靠 `server/providers/formats/`
 *      這五個檔撐著），margin 很薄——如果哪天這個子目錄被攤平，這裡會紅，
 *      那是真的門檻該調，不是尺壞了；調之前先確認不是遞迴真的斷了。
 *
 * 🔴 兩個根**分開算、都要過**，不能合成一個總數：只拿掉 `server/` 那條掃描時
 * （整個 104 個深檔案消失），合成的深度數字仍然會被 `src/app/` 那邊撐住，
 * forward 閘門照樣 PASS——這正是「量測管道本身在說謊」的那種假陽性。分開算
 * 之後，`server/` 那一半自己塌到 0，立刻低於門檻，不靠另一半掩護。
 */
const MIN_DEEP_COUNT: Record<'server' | 'app', number> = { server: 30, app: 20 };
const MIN_RECURSION_DEPTH = 3;

function rootFloor(dir: string, prefix: string, minDeep: number, targets: string[]): RootFloor {
  const TS_EXT = /\.tsx?$/;
  const shallow = listFiles(join(ROOT, dir), TS_EXT).length;
  const deep = targets.filter((t) => t.startsWith(prefix)).length;
  const maxDepth = maxDepthUnder(prefix, targets);
  return { deep, shallow, maxDepth, ok: deep >= minDeep && maxDepth >= MIN_RECURSION_DEPTH };
}

export function coverageFloor(targets: string[]): {
  ok: boolean;
  server: RootFloor;
  app: RootFloor;
} {
  const server = rootFloor('server', 'server/', MIN_DEEP_COUNT.server, targets);
  const app = rootFloor('src/app', 'src/app/', MIN_DEEP_COUNT.app, targets);
  return { ok: server.ok && app.ok, server, app };
}

/**
 * 第五輪坑 C2（最高優先）：`coverageFloor()` 量的是「總深度／總鑽層數」，粒度是
 * 整個 `server/` 或整個 `src/app/`——**一整個子目錄被跳過**（`server/lib/`
 * 48 檔全消失、`server/routes/` 20 檔全消失、`src/app/screens/` 19 檔全消失）
 * 完全不會讓總數塌到門檻下：deep 從 104 掉到 56 依然 ≥30，`maxDepth` 撐住是因為
 * 深度 3 的那五個檔在 `server/providers/formats/`，跟被跳過的子目錄無關。而且
 * 後果比「floor 沒抓到」更重——這些檔根本沒進 `targets`，`decide()` 的孤兒偵測
 * 只查 `targets` 裡的東西，沒進陣列的檔案永遠不會被判成孤兒，是比「紅燈變綠」
 * 更安靜的失敗：連 FAIL 訊息都不會有。觸發條件極普通：`SKIP` 集合手滑多收一個
 * 目錄名、或排除條件寫錯。
 *
 * 🔴 **這是跟 `walk()` 不共用任何一行程式碼的第二把尺**——`walk()` 的歷史 bug
 * （檔頭第 6 點、A2）全部長在「遞迴 + `skipDirNames` 判斷」這段自己維護的邏輯
 * 裡；如果第二把尺也呼叫 `walk()` 或複製同一段 SKIP 判斷，`walk()` 壞掉那天
 * 兩把尺會一起壞，就不是交叉驗證，只是同一個 bug 被問了兩次。這裡改用 Node fs
 * **內建**的遞迴列舉（`readdirSync(dir, { recursive: true })`，Node ≥20.1，這
 * 個 repo 鎖定 `engines.node >= 20.19`）——遞迴邏輯本身是 Node 自己實作的，不是
 * 這支檔案手寫、可能手滑的那段，`SKIP`／`skipDirNames` 那一段判斷完全沒有被複製
 * 過來。兩者除了都在最底層呼叫 `readdirSync`／`statSync` 這兩個 Node 原生 API
 * 之外（這無法避免，任何檔案系統走訪最終都要落地到這兩個呼叫），沒有共用一行
 * 判斷邏輯，尤其是「這個目錄該不該跳過」這一段——這正是歷史上真正壞過的地方。
 *
 * 判準刻意放得很寬（只問「有沒有」，不比對絕對數字）：對 `server/`／`src/app/`
 * 底下**每一個目錄節點**（不只一級，見下方 A3），獨立算一次「這個目錄底下遞迴有
 * 沒有 `.ts`/`.tsx` 檔（排除 `__tests__/`）」；只要算出來 >0，就必須在 `targets`
 * 裡至少出現一個以這個目錄的完整路徑開頭的標的。兩把尺排除 `__tests__/` 的寫法
 * 不同（這把用路徑片段比對、`walk()` 用目錄名整棵跳過），細微的檔案數落差是預期
 * 的，所以不比對絕對數字，只比對「至少一個」——粒度是「整個目錄消失」，不是「差
 * 一兩個檔」，比對太精確只會在兩把尺各自排除方式的正常落差裡製造假警報。
 *
 * 🔴 A3（第六輪，複驗打穿）：上面這段判準原本只對**一級**子目錄做——`server/`
 * 底下的 `providers`、`lib`、`routes` 這種第一層。這救不了巢狀更深的洞：
 * `server/providers/formats/*`（真實存在的二級目錄）整個從 `targets` 消失時，
 * 一級尺量的是「`server/providers/` 底下**還有沒有任何**標的」——`server/
 * providers/registry.ts` 等其他檔案還在，一級尺看到「還有」就放行，完全不問
 * `formats/` 這個路徑本身有沒有標的。`src/app/routes/settings/providers/*`
 * 同理，被 `settings/about.tsx` 等同層檔案掩護過去。兩個都是複驗用真實
 * `buildTargets()` 輸出打穿的，不是假設情境。
 *
 * 改法：`collectSubdirCounts()` 手動遞迴走訪整棵樹，對**每一個**目錄節點（第一
 * 層、第二層、第三層……）都獨立重複同一套「有沒有檔案 → 有沒有對應標的」檢查，
 * 不再只停在第一層。`server/providers/formats/` 現在是它自己的一個節點，不會被
 * `server/providers/` 這個祖先節點底下的其他檔案掩護過去。
 *
 * 為什麼還是不會跟 `walk()` 一起壞：「往下鑽一層」那段（`readdirSync(parentDir)`
 * 逐層手寫遞迴）確實跟 `walk()` 同類型的手寫遞迴，但每一個節點「有沒有檔案」的
 * 判斷仍然呼叫 Node **內建**的 `readdirSync(p, { recursive: true })`（跟 C2 那
 * 一輪同一招），完全不複製 `walk()` 的 `SKIP` 判斷。就算「往下鑽」那段被改壞
 * （例如漏掉某個目錄名的遞迴），後果是「少驗那一層」，不是「跟 `walk()` 一樣整批
 * 標的憑空消失卻沒人發現」——下面 `--selftest` 用臨時巢狀 fixture 斷言遞迴真的
 * 鑽得到三層深來擋這一段自己的迴歸。
 *
 * fs 讀取失敗（例如 `chmod 000`）：舊版的 `try/catch` 把任何 `readdirSync` 失敗
 * 都吞成 `entries = []` → `count = 0` → `if (count === 0) continue` 直接跳過，
 * 跟「這個目錄真的是空的」長得一模一樣，靜默通過。今天不會變成靜默綠燈，只因為
 * `walk()`（沒有 try/catch）會先在同一個掃描根撞到同一個錯誤整個當機——那是執行
 * 順序的巧合，不是設計；未來任何把 `walk()` 包一層 try/catch「加固」的合理重構，
 * 都會意外把這裡從「當機」降級成「靜默通過」。改成：讀取失敗記進 `failedDirs`，
 * 訊息誠實印出「N 個子目錄讀取失敗，視為未驗證」，且**視為未驗證要讓這輪 FAIL**
 * ——讀不到就是不能保證沒有孤兒，不能算過關，寧可誤報也不要吞成 0。
 */
function collectSubdirCounts(
  parentDir: string,
  ext: RegExp,
  counts: Map<string, number>,
  failedDirs: string[],
): void {
  let children: string[];
  try {
    children = readdirSync(parentDir);
  } catch {
    failedDirs.push(relative(ROOT, parentDir));
    return;
  }
  for (const n of children) {
    if (n === TEST_DIR_NAME) continue; // X4：這兩支掃描根底下的 __tests__ 本就不算數
    const p = join(parentDir, n);
    let isDir: boolean;
    try {
      isDir = statSync(p).isDirectory();
    } catch {
      failedDirs.push(relative(ROOT, p));
      continue;
    }
    if (!isDir) continue;

    let entries: string[] | null = null;
    try {
      entries = readdirSync(p, { recursive: true }) as string[];
    } catch {
      failedDirs.push(relative(ROOT, p));
    }
    if (entries === null) continue; // 讀不到就不往下鑽——鑽下去只會用同一個原因再失敗一次

    let count = 0;
    for (const e of entries) {
      if (e.split(/[\\/]/).includes(TEST_DIR_NAME)) continue;
      if (!ext.test(e)) continue;
      const full = join(p, e);
      try {
        if (statSync(full).isFile()) count++;
      } catch {
        // 列舉之後、stat 之前檔案消失——競態，不是本輪要抓的錯，略過即可
      }
    }
    counts.set(relative(ROOT, p), count);

    // A3 核心：往下鑽一層，對每一個更深的目錄節點重複同一套獨立檢查，不是只查
    // parentDir 的直接子目錄。
    collectSubdirCounts(p, ext, counts, failedDirs);
  }
}

export function subdirCoverage(
  dir: string,
  targets: string[],
): {
  ok: boolean;
  missing: string[];
  checked: number;
  failedDirs: string[];
  maxDepthChecked: number;
} {
  const TS_EXT = /\.tsx?$/;
  const root = join(ROOT, dir);
  const counts = new Map<string, number>();
  const failedDirs: string[] = [];
  if (existsSync(root)) collectSubdirCounts(root, TS_EXT, counts, failedDirs);

  const missing: string[] = [];
  let maxDepthChecked = 0;
  for (const [relDir, count] of counts) {
    const depth = relDir.slice(dir.length + 1).split('/').length;
    if (depth > maxDepthChecked) maxDepthChecked = depth;
    if (count === 0) continue;
    const has = targets.some((t) => t.startsWith(`${relDir}/`));
    if (!has) missing.push(relDir);
  }
  missing.sort();
  failedDirs.sort();
  return {
    ok: missing.length === 0 && failedDirs.length === 0,
    missing,
    checked: counts.size,
    failedDirs,
    maxDepthChecked,
  };
}

export function decide(
  targets: string[],
  own: OwnerMap,
  dup: DupMap,
  X: Set<string>,
  Xg: Set<string>,
  globs: Map<string, string>,
  dirOwners: Map<string, string> = new Map(),
): { code: number; orphans: string[]; dupList: [string, string[]][] } {
  if (targets.length === 0) return { code: 2, orphans: [], dupList: [] };
  const orphans = targets.filter((t) => !covered(t, own, X, Xg, globs, dirOwners));
  const dupList = [...dup.entries()].map(([k, v]) => [k, [...v].sort()] as [string, string[]]);
  return { code: orphans.length || dupList.length ? 1 : 0, orphans, dupList };
}

if (process.argv.includes('--selftest')) {
  runSelftest();
} else {
  run();
}

function run(): void {
  const { own, dup, globs, globDup, exceptions } = loadAgentClaims();
  const { X, Xg } = nobodyOwns();
  crossCheckClaims(own, dup, X, Xg, globs, exceptions, globDup);

  const unclaimed = unclaimedExceptions(exceptions, own);
  if (unclaimed.length) {
    console.error(
      `gate:ownership FAIL — ${unclaimed.length} 個 **except** 例外沒有被任何 agent 具名認領` +
        `（孤兒穿著例外的外衣溜走）：`,
    );
    for (const p of unclaimed) console.error(`    ${p}`);
    process.exit(1);
  }

  const { targets, excludedTests } = buildTargets();

  if (targets.length === 0) {
    console.error('gate:ownership FAIL — 掃到 0 個標的（尺壞了，不是乾淨）');
    process.exit(2);
  }

  const floor = coverageFloor(targets);
  if (!floor.ok) {
    // A2：不再說「像是遞迴掃描被改壞了」——這個門檻本身已經對頂層新檔免疫
    // （見 `coverageFloor` 檔頭），所以會紅只可能是遞迴真的少掃到東西，不可能
    // 是「新檔變多」。訊息如實列出兩把尺各自的數字，不用再用詞含糊帶過。
    console.error('gate:ownership FAIL — 遞迴掃描少掃到東西了（不是新檔變多能造成的）：');
    if (!floor.server.ok)
      console.error(
        `    server/ 深度掃到 ${floor.server.deep} 個檔（下限 ${MIN_DEEP_COUNT.server}）、` +
          `最深鑽 ${floor.server.maxDepth} 層（下限 ${MIN_RECURSION_DEPTH}）`,
      );
    if (!floor.app.ok)
      console.error(
        `    src/app/ 深度掃到 ${floor.app.deep} 個檔（下限 ${MIN_DEEP_COUNT.app}）、` +
          `最深鑽 ${floor.app.maxDepth} 層（下限 ${MIN_RECURSION_DEPTH}）`,
      );
    process.exit(1);
  }

  // C2＋A3：第二把尺，跟上面的 coverageFloor 不共用程式碼——見 `subdirCoverage` 檔頭。
  // A3：現在對每一層巢狀目錄都獨立檢查，不再只查一級。
  const subServer = subdirCoverage('server', targets);
  const subApp = subdirCoverage('src/app', targets);
  if (!subServer.ok || !subApp.ok) {
    console.error('gate:ownership FAIL — 有目錄（不限第一層）從掃描標的裡消失了（第二把尺抓到）：');
    if (subServer.missing.length)
      console.error(
        `    server/ 底下這些目錄有 .ts 檔卻沒有任何標的：${subServer.missing.join(', ')}`,
      );
    if (subApp.missing.length)
      console.error(
        `    src/app/ 底下這些目錄有 .ts 檔卻沒有任何標的：${subApp.missing.join(', ')}`,
      );
    if (subServer.failedDirs.length)
      console.error(
        `    server/ 底下 ${subServer.failedDirs.length} 個目錄讀取失敗，視為未驗證：` +
          subServer.failedDirs.join(', '),
      );
    if (subApp.failedDirs.length)
      console.error(
        `    src/app/ 底下 ${subApp.failedDirs.length} 個目錄讀取失敗，視為未驗證：` +
          subApp.failedDirs.join(', '),
      );
    process.exit(1);
  }

  // 第七輪：單一owner目錄放寬——見 covered() 檔頭與 gate-ownership-dirgrain.ts。
  // 🔴 `singleOwnerDirs()` 只看 `own`（具名認領字串），不知道哪些目錄真的存在
  // 掃描到的檔案——`FILE_RE` 對「glob 宣告行括號裡順口列出的完整相對路徑」
  // （`worldbook.md:14` 的 `src/app/routes/worlds/**（\`index.tsx\` ...
  // \`$worldId/index.tsx\`）`）解析出來的是**沒有目錄前綴的裸字串**
  // `$worldId/index.tsx`（這是既有 `claimFilesIn()` 的既有行為，不是這輪動的），
  // 對 `own` 而言完全無害（沒有任何真實 target 字面等於 `$worldId/index.tsx`），
  // 但會在 `singleOwnerDirs()` 裡冒出一個 `$worldId/` 幽靈目錄。用 `targets` 過濾掉
  // 「沒有任何掃描到的檔案落在這個目錄底下」的項目——對真正要放寬的情境完全無感
  // （新孤兒檔案本身就是自己那個目錄底下的一個 target，恆成立），只濾掉這種解析
  // 副作用產生的幽靈路徑，PASS 訊息才不會印出誤導人的「放寬了一個目錄」。
  const dirOwners = new Map(
    [...singleOwnerDirs(own, X, Xg, globs)].filter(([dir]) =>
      targets.some((t) => t.startsWith(dir)),
    ),
  );
  const { code, orphans, dupList } = decide(targets, own, dup, X, Xg, globs, dirOwners);
  if (code === 1) {
    console.error(`gate:ownership FAIL — 掃了 ${targets.length} 個標的`);
    if (orphans.length) {
      console.error(`  沒人認領 ${orphans.length} 個：`);
      // 第七輪：孤兒的目錄如果剛好是「2 個以上 agent 都有具名檔」的共用目錄，訊息
      // 直接講出來——這不是尺壞了，是這個目錄本來就不吃單一owner放寬（見 covered()
      // 檔頭），人類看到訊息就知道要去具名登記，不用自己再查一次 groupByDir()。
      const byDir = groupByDir(own);
      for (const o of orphans) {
        const agents = [...(byDir.get(dirOf(o)) ?? [])].sort();
        const hint =
          agents.length >= 2
            ? `（共用目錄，具名 owner 已有 ${agents.join('、')}——不吃單一owner放寬，需具名登記）`
            : '';
        console.error(`    ${o}${hint}`);
      }
    }
    if (dupList.length) {
      console.error(`  重複認領 ${dupList.length} 個：`);
      for (const [k, agents] of dupList) console.error(`    ${k} ← ${agents.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(
    `gate:ownership PASS — 掃了 ${targets.length} 個標的，無孤兒、無重複、涵蓋率健康` +
      `（server/ 深 ${floor.server.deep} 檔／鑽 ${floor.server.maxDepth} 層、` +
      `src/app/ 深 ${floor.app.deep} 檔／鑽 ${floor.app.maxDepth} 層，` +
      `子目錄涵蓋（第二把尺，逐層遞迴、不只一級）server/ ${subServer.checked} 個節點／` +
      `最深 ${subServer.maxDepthChecked} 層、src/app/ ${subApp.checked} 個節點／` +
      `最深 ${subApp.maxDepthChecked} 層都對得上）` +
      `（另外排除 server/ 與 src/app/ 底下（含巢狀）共 ${excludedTests} 個 __tests__ 檔——` +
      `X4 沒有機制守，這一輪刻意排除；不含 src/features/**（目錄粒度，本就不遞迴）` +
      `與 src/shared/**（X1，本就不掃）底下的 __tests__）` +
      `（單一owner目錄放寬涵蓋 ${dirOwners.size} 個目錄：` +
      `${[...dirOwners.entries()].map(([d, a]) => `${d}→${a}`).join('、') || '無'}）`,
  );
}

/** 嚴重1：`walk()` 真的鑽得到巢狀目錄，也真的排除 `skipDirNames`。用完即刪。 */
function testWalkRecursion(): boolean {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'gate-ownership-walk-'));
  try {
    mkdirSync(join(fixtureRoot, 'a/b/c'), { recursive: true });
    mkdirSync(join(fixtureRoot, '__tests__'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'shallow.ts'), '');
    writeFileSync(join(fixtureRoot, 'a/mid.ts'), '');
    writeFileSync(join(fixtureRoot, 'a/b/c/deep.ts'), '');
    writeFileSync(join(fixtureRoot, '__tests__/skip.ts'), '');

    const found = walk(fixtureRoot, /\.ts$/, [], new Set([TEST_DIR_NAME]));
    return (
      found.length === 3 &&
      found.some((f) => f.endsWith('shallow.ts')) &&
      found.some((f) => f.endsWith('a/mid.ts')) &&
      found.some((f) => f.endsWith('a/b/c/deep.ts')) &&
      !found.some((f) => f.includes('__tests__'))
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function runSelftest(): void {
  const own1: OwnerMap = new Map();
  const dup1: DupMap = new Map();
  const globs1 = new Map<string, string>();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/lib/` — `real.ts`\n\n' +
        '## 2 · Files you must not write\n\n- `server/lib/notMine.ts`\n',
    ),
    'a',
    own1,
    dup1,
    globs1,
    new Map(),
  );

  // 坑②：decoy 這次寫成**裸檔名**（沒有 dir 前綴）。note 邏輯正常 ⇒ 這整行被跳過，
  // decoy 永遠不會被認領。note 邏輯被改壞（例如永遠回傳 false）⇒ 這行變成續行，
  // 沿用 cur='server/lib/' 前綴，產生 own2.get('server/lib/decoy.ts') === 'b' ——
  // 斷言因此真的會翻盤，不像舊版那樣因為前綴重複而永遠測不到。
  const own2: OwnerMap = new Map();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/lib/` — `real2.ts`\n' +
        '  🔴 not `decoy.ts` (someone else’s)\n\n' +
        '## 2 · Files you must not write\n',
    ),
    'b',
    own2,
    new Map(),
    new Map(),
    new Map(),
  );

  const own3: OwnerMap = new Map();
  parseClaims(
    ownedSection(
      '## 1 · Files you own\n\n- `server/lib/` — `one.ts`\n  `two.ts`\n\n' +
        '## 2 · Files you must not write\n',
    ),
    'c',
    own3,
    new Map(),
    new Map(),
    new Map(),
  );

  const own4: OwnerMap = new Map();
  const globs4 = new Map<string, string>();
  const rawExcept =
    '## 1 · Files you own\n\n- `server/adapters/**` **except** `excluded.ts` (H5’s)\n\n' +
    '## 2 · Files you must not write\n';
  parseClaims(ownedSection(rawExcept), 'd', own4, new Map(), globs4, new Map());
  const exceptions4 = extractExceptions(extractSection(rawExcept));

  // 坑⑫ / 中等4：括號說明文字裡順口提到的檔名不算例外，只有緊接自己括號的才算。
  const rawProse =
    '## 1 · Files you own\n\n' +
    '- `server/adapters/**` **except** `gemini.ts` (replaces the old `legacyAdapter.ts` shim)\n\n' +
    '## 2 · Files you must not write\n';
  const exceptionsProse = extractExceptions(extractSection(rawProse));

  // 第五輪坑 D：一組括號幫一串逗號分隔的檔名背書——兩個檔名都要進例外清單，
  // 不能只有緊接括號的那一個。同時確認中等坑 4 的對照組（單一檔名 + 自己的括號）
  // 依然只抽得到那一個，沒有被這次改動打開。
  const rawExceptGroup =
    '## 1 · Files you own\n\n' +
    "- `server/adapters/**` **except** `a.ts`, `b.ts` (both H9's)\n\n" +
    '## 2 · Files you must not write\n';
  const exceptionsGroup = extractExceptions(extractSection(rawExceptGroup));

  const orphanRun = decide(['x/orphan.ts'], new Map(), new Map(), new Set(), new Set(), new Map());
  const dupOwn: OwnerMap = new Map([['x/dup.ts', 'a']]);
  const dupDup: DupMap = new Map([['x/dup.ts', new Set(['a', 'b'])]]);
  const dupRun = decide(['x/dup.ts'], dupOwn, dupDup, new Set(), new Set(), new Map());
  const zeroRun = decide([], new Map(), new Map(), new Set(), new Set(), new Map());

  // 坑⑤a：具名認領撞到 AGENTS.md §2 的無主檔／無主 glob（X／Xg）
  const dup5a: DupMap = new Map();
  crossCheckClaims(
    new Map([['server/services/settings.ts', 'chat-core']]),
    dup5a,
    new Set(['server/services/settings.ts']),
    new Set(),
    new Map(),
    new Set(),
    new Map(),
  );
  const dup5b: DupMap = new Map();
  crossCheckClaims(
    new Map([['src/shared/tokens.ts', 'chat-core']]),
    dup5b,
    new Set(),
    new Set(['src/shared/**']),
    new Map(),
    new Set(),
    new Map(),
  );

  // 坑⑤b：具名認領撞到「別人」的 glob——非法（chat-core 名下的檔落在 platform 的 glob 裡）
  const dup5c: DupMap = new Map();
  crossCheckClaims(
    new Map([['server/adapters/backgrounds.ts', 'chat-core']]),
    dup5c,
    new Set(),
    new Set(),
    new Map([['server/adapters/**', 'platform']]),
    new Set(),
    new Map(),
  );
  // 坑⑤b 的對照組：合法的 **except** 例外不算重複（providers 具名認領 gemini.ts，
  // platform 的 glob 蓋到同一個路徑，但那正是 platform.md 自己宣告的例外）
  const dup5d: DupMap = new Map();
  crossCheckClaims(
    new Map([['server/adapters/gemini.ts', 'providers']]),
    dup5d,
    new Set(),
    new Set(),
    new Map([['server/adapters/**', 'platform']]),
    new Set(['server/adapters/gemini.ts']),
    new Map(),
  );

  // 坑⑪a：兩個 agent 逐字宣告同一個 glob——`globs.set()` 直接覆蓋會讓這件事整個
  // 消失，改成 `claimGlob` 之後要進 `globDup`，再由 `crossCheckClaims` 併回主 dup。
  const globsG: OwnerMap = new Map();
  const globDupG: DupMap = new Map();
  const rawGlobDup =
    '## 1 · Files you own\n\n- `server/adapters/**`\n\n## 2 · Files you must not write\n';
  parseClaims(ownedSection(rawGlobDup), 'e', new Map(), new Map(), globsG, globDupG);
  parseClaims(ownedSection(rawGlobDup), 'f', new Map(), new Map(), globsG, globDupG);
  const dup11a: DupMap = new Map();
  crossCheckClaims(new Map(), dup11a, new Set(), new Set(), globsG, new Set(), globDupG);

  // 坑⑪b：字面不同但前綴重疊——glob 撞 Xg（worldbook 手滑宣告了 X1 的 `src/shared/**`）
  const dup11b: DupMap = new Map();
  crossCheckClaims(
    new Map(),
    dup11b,
    new Set(),
    new Set(['src/shared/**']),
    new Map([['src/shared/**', 'worldbook']]),
    new Set(),
    new Map(),
  );

  // 坑⑪b：glob 撞 X（某 agent 的 glob 蓋到 AGENTS.md §2 具名列出的無主檔）
  const dup11c: DupMap = new Map();
  crossCheckClaims(
    new Map(),
    dup11c,
    new Set(['server/adapters/legacyGlobal.ts']),
    new Set(),
    new Map([['server/adapters/**', 'platform']]),
    new Set(),
    new Map(),
  );

  // 坑⑪b：兩個 agent 的 glob 前綴重疊但字面不同（一個是另一個的子目錄）
  const dup11d: DupMap = new Map();
  crossCheckClaims(
    new Map(),
    dup11d,
    new Set(),
    new Set(),
    new Map([
      ['server/adapters/**', 'platform'],
      ['server/adapters/legacy/**', 'ghost'],
    ]),
    new Set(),
    new Map(),
  );

  // 坑⑫：**except** 例外沒有被任何 agent 具名認領——孤兒被例外掩蓋。
  const unclaimedOk = unclaimedExceptions(new Set(['server/adapters/gemini.ts']), new Map());
  const unclaimedClean = unclaimedExceptions(
    new Set(['server/adapters/gemini.ts']),
    new Map([['server/adapters/gemini.ts', 'providers']]),
  );

  // 嚴重1：walk() 真的遞迴，且排除 skipDirNames——用臨時 fixture 樹驗，不是 mock。
  const walkOk = testWalkRecursion();

  // 嚴重1：buildTargets() 的六個掃描根，各自要有一個標的能證明那段邏輯真的跑了。
  const built = buildTargets();
  const serverDeepOk = maxDepthUnder('server/', built.targets) >= 3;
  const appDeepOk = maxDepthUnder('src/app/', built.targets) >= 3;
  const srcRootOk = built.targets.some((t) => /^src\/[^/]+$/.test(t));
  const rootFilesOk = ROOT_FILES.filter((f) => existsSync(join(ROOT, f))).every((f) =>
    built.targets.includes(f),
  );
  const electronOk = built.targets.some((t) => t.startsWith('electron/'));
  const featuresGrainOk =
    built.targets.some((t) => /^src\/features\/[^/]+\/$/.test(t)) &&
    !built.targets.some((t) => /^src\/features\/[^/]+\/[^/]+/.test(t));

  // 嚴重1：涵蓋率下限——健康的真實標的要過門檻；把它退化成「只剩頂層」要塌到門檻下。
  const floorHealthy = coverageFloor(built.targets);
  const shallowOnly = built.targets.filter((t) => {
    if (t.startsWith('server/')) return t.split('/').length === 2;
    if (t.startsWith('src/app/')) return t.split('/').length === 3;
    return true;
  });
  const floorBroken = coverageFloor(shallowOnly);
  // 兩個根分開算的理由本身要有 selftest 守：只拿掉 server/ 那一半（src/app/ 仍健康），
  // 合成單一比例會被 src/app/ 撐住而放行（實測發生過，見 coverageFloor 檔頭 🔴）。
  // 分開算之後，server/ 那一半自己要塌到門檻下，不能靠另一半掩護。
  const serverOnlyBroken = built.targets.filter((t) => !t.startsWith('server/'));
  const floorServerOnlyBroken = coverageFloor(serverOnlyBroken);

  // 迴歸（Peter 2026-08-28 指名）：server/lib/worldPresets.ts 一次踩到坑①＋坑③——
  // presets.md 在 §2 提到它（坑①要放過，不算認領），worldbook.md 在 §1 用第三條
  // 續行認領它（坑③要接得回 `server/lib/` 前綴）。用真檔，不是造出來的 fixture。
  const real = loadAgentClaims();
  const realX = nobodyOwns();
  crossCheckClaims(
    real.own,
    real.dup,
    realX.X,
    realX.Xg,
    real.globs,
    real.exceptions,
    real.globDup,
  );
  const realUnclaimed = unclaimedExceptions(real.exceptions, real.own);

  // 第七輪（`INBOX/20260828-ownership-extract-deadlock.md`）：單一owner目錄放寬。
  // 用真實 agents 資料——不是造出來的 fixture——因為這張票點名的四個共用目錄
  // （票裡踩過孤兒卡關的兩個＋另外兩個同型）本來就已經存在於這個 repo。
  const realDirOwners = singleOwnerDirs(real.own, realX.X, realX.Xg, real.globs);

  // 案例1（票 §4 第1點）：owner 在自己單一擁有的目錄新增檔 → 綠。用真實單一owner
  // 目錄 `src/app/routes/chat/`（只有 chat-core 具名），造一個真實不存在、沒被
  // 任何 agent 具名列出的檔名，走完整的 `decide()` pipeline（不是只呼叫
  // `singleOwnerDirs()`）——要真的降到 0 個孤兒，證明 `covered()`／`decide()`
  // 有把 `dirOwners` 接進主流程，不是算好了沒人用的裝飾品。
  const newFileInSingleOwnerDir = 'src/app/routes/chat/brandNewFile.tsx';
  const singleOwnerRun = decide(
    [newFileInSingleOwnerDir],
    real.own,
    new Map(),
    realX.X,
    realX.Xg,
    real.globs,
    realDirOwners,
  );
  // 🔴 嚴重1同款鐵律：把 `dirOwners` 換成空 Map（等同把這輪的放寬整段拔掉）重跑
  // 同一個 `decide()` 呼叫，斷言結果會翻盤回孤兒——這才證明上面那個「綠」不是巧合
  // 或本來就綠（例如目錄其實是 glob 覆蓋掉的），是這個放寬真的在起作用。
  const singleOwnerRunWithoutRelax = decide(
    [newFileInSingleOwnerDir],
    real.own,
    new Map(),
    realX.X,
    realX.Xg,
    real.globs,
    new Map(),
  );

  // 案例2（票 §4 第2點，🔴 最重要的安全欄杆）：共用目錄——2 個以上 agent 都有
  // 具名檔——新檔仍然要判孤兒，不能被放寬掩護過去，也不能「先到先贏」隨便指定給
  // 走訪順序先出現的那個 agent。用真實共用目錄 `server/services/`（chat-core 與
  // card-scripts 等 8 個 agent）＋真實 `server/routes/`（10 個 agent）＋真實
  // `src/app/screens/`（4 個 agent，票裡 D2 真的撞到的那個目錄）各自造一個不存在
  // 的新檔名，全部要維持孤兒。
  const sharedDirOrphans = [
    'server/services/brandNewSharedFile.ts',
    'server/routes/brandNewSharedFile.ts',
    'server/lib/brandNewSharedFile.ts',
    'src/app/screens/BrandNewSharedScreen.tsx',
  ];
  const sharedDirRun = decide(
    sharedDirOrphans,
    real.own,
    new Map(),
    realX.X,
    realX.Xg,
    real.globs,
    realDirOwners,
  );

  // 案例3（票 §4 第3點）：兩個 owner 共用同一個目錄——`server/services/` 是票裡
  // 點名「最難的情境」，本判準的做法（票 §3 方向 (a)）是維持嚴格，上面
  // `sharedDirRun` 已經涵蓋；這裡再單獨斷言 `realDirOwners` 本身完全不包含這四個
  // 目錄——不是靠 `decide()` 的某個旁路意外擋住，是 `singleOwnerDirs()` 從一開始
  // 就沒把它們算進放行清單。

  // 案例4（票 §4 第4點）：既有 170 個標的的判定不變——用真實 `buildTargets()` 全量
  // 跑一次完整 `decide()`（含 `realDirOwners`），結果要跟不放寬時完全一樣（0 個
  // 孤兒、0 個重複）——證明這輪放寬對「已經被具名認領的既有檔案」零影響，只在
  // `covered()` 前面幾層都查不到的**新**檔案上才會被查到。
  const fullRunWithRelax = decide(
    built.targets,
    real.own,
    real.dup,
    realX.X,
    realX.Xg,
    real.globs,
    realDirOwners,
  );
  const fullRunWithoutRelax = decide(
    built.targets,
    real.own,
    real.dup,
    realX.X,
    realX.Xg,
    real.globs,
  );

  // 5-2：glob 擷取現在也走 stripNotes()——複驗的原句實測。audio 在自己的說明段裡
  // 提到 extensions 的 glob 做澄清，那句話不該被 audio 認領；同一批 real claim 裡
  // extensions 自己真的宣告了那個 glob，兩者不該被誤判成重複。
  const globNoteGlobs: OwnerMap = new Map();
  const globNoteDup: DupMap = new Map();
  const rawGlobNote =
    '## 1 · Files you own\n\n- `src/features/audio/**`\n' +
    "  🔴 not `src/features/extensions/**` (that's H9's, not ours — just flagging for clarity)\n\n" +
    '## 2 · Files you must not write\n';
  parseClaims(ownedSection(rawGlobNote), 'audio', new Map(), new Map(), globNoteGlobs, globNoteDup);
  const rawGlobReal =
    '## 1 · Files you own\n\n- `src/features/extensions/**`\n\n## 2 · Files you must not write\n';
  parseClaims(
    ownedSection(rawGlobReal),
    'extensions',
    new Map(),
    new Map(),
    globNoteGlobs,
    globNoteDup,
  );
  const dup5_2: DupMap = new Map();
  crossCheckClaims(new Map(), dup5_2, new Set(), new Set(), globNoteGlobs, new Set(), globNoteDup);

  // 5-1：§2 只有「Paths」欄（第 2 個 cell）算數——複驗的原句實測，模仿 X4 那一列
  // 既有的「順口提到別的 agent 檔名做澄清」寫法，分別放在（a）表格裡別的欄位、
  // （b）表格外的散文段落。兩種都不該被當成「這個檔沒人管」。
  const rawTableClarify =
    '| **X-test** | `real/unowned.ts` | why | ' +
    "**What to do**: e.g. `server/lib/audio.ts` is H8's, not unowned — only the paths column counts. |\n";
  const parsedTableClarify = parseNobodyOwnsSection(rawTableClarify);
  const rawProseClarify =
    '| **X-test** | `real/unowned2.ts` | why | what |\n\n' +
    '### Not owned by anyone\n\n' +
    "（For avoidance of doubt, e.g. `server/lib/audio2.ts` is H8's, not unowned — only the table counts.）\n";
  const parsedProseClarify = parseNobodyOwnsSection(rawProseClarify);

  // 5-3：countTestFiles() 真的遞迴找任何深度的 __tests__/，不是寫死兩個固定路徑。
  // fixture：頂層一個、巢狀兩層深一個都要數到；非 __tests__ 目錄裡的檔不算。
  function testCountTestFilesRecursion(): boolean {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'gate-ownership-tests-'));
    try {
      mkdirSync(join(fixtureRoot, '__tests__'), { recursive: true });
      mkdirSync(join(fixtureRoot, 'a/b/__tests__'), { recursive: true });
      mkdirSync(join(fixtureRoot, 'a/b'), { recursive: true });
      writeFileSync(join(fixtureRoot, '__tests__/top.ts'), '');
      writeFileSync(join(fixtureRoot, 'a/b/__tests__/nested.ts'), '');
      writeFileSync(join(fixtureRoot, 'a/b/notTest.ts'), '');
      return countTestFiles(fixtureRoot, /\.ts$/) === 2;
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
  const countTestFilesOk = testCountTestFilesRecursion();
  // 迴歸：真實 excludedTests 要等於「三個已知 __tests__ 目錄」各自獨立重新 walk() 的和
  // ——如果有人把 countTestFiles() 改回舊版那種寫死兩個路徑相加，這裡的數字會對不上
  // （因為漏了 src/app/screens/__tests__）。
  //
  // 🔴 2026-08-28（GAP：另一條線要新增 server/__tests__/buildTurn.test.ts，總數從
  // 56 變 57，把這條選錯方向的斷言打紅）：這裡曾經多 `&& built.excludedTests === 56`
  // 一截——**寫死當下量到的絕對值**，等同懲罰「有人真的多寫了一支測試」。拿掉那截，
  // `expectedExcludedTests` 不是同一份計算抄兩遍：`countTestFiles()`（`buildTargets()`
  // 實際用的那條）是「遞迴找任何深度、名字剛好叫 __tests__ 的目錄」；下面這段是
  // 「對三個寫死的已知路徑各自呼叫 `walk()` 再相加」——演算法不同、路徑寫死的方式也
  // 不同（前者靠目錄名比對、後者靠三條硬編路徑），只有兩者算出的**檔案總數**理論上
  // 該相等這件事本身是不變量，不是 `x === x` 的套套邏輯。舊版的 `56` 才是那個會過期
  // 的數字：這兩條路徑本來就該隨著任何一個 `__tests__` 目錄裡加減檔案而同步增減，
  // `built.excludedTests === expectedExcludedTests` 這一行本身完全不受影響、也完全
  // 不需要知道「現在是多少」。（歷史對照：舊版 `countTestFiles()` 漏了
  // `src/app/screens/__tests__`，那時算出 52 ≠ 這裡三段式算出的 56——那是這條斷言
  // 真的抓到迴歸的案例，不是巧合；後面新增的第 57 支測試檔則是兩條路徑會一起同步
  // 變成 57、57，合規成長，不該被打紅。）
  const expectedExcludedTests =
    walk(join(ROOT, 'server/__tests__'), /\.tsx?$/).length +
    walk(join(ROOT, 'src/app/__tests__'), /\.tsx?$/).length +
    walk(join(ROOT, 'src/app/screens/__tests__'), /\.tsx?$/).length;

  // A2：新門檻對「往頂層合規加檔」免疫——12 個全部正確認領（用假路徑串接進 targets
  // 就好，coverageFloor 本身不看有沒有主）的新檔，不該讓 floor 變紅。
  const legitGrowthTargets = [
    ...built.targets,
    ...Array.from({ length: 12 }, (_, i) => `src/app/legitNew${i}.tsx`),
  ];
  const floorLegitGrowth = coverageFloor(legitGrowthTargets);

  // A2：「只鑽一層就停」的改法幾乎不動絕對檔數（這個 repo 大多數檔案本來就只有
  // 兩層深），舊的深/淺比也抓不太到（server 33.0x、幾乎沒掉）。真正抓得住的是
  // maxDepth——三層以上的檔案會整批消失。這裡刻意只讓絕對數字仍然健康、只讓深度
  // 塌下去，證明 maxDepth 這一段真的在拉自己的重量，不是絕對數字順便帶到的。
  function depthLimitedTo(targets: string[], prefix: string, maxRelDepth: number): string[] {
    return targets.filter((t) => {
      if (!t.startsWith(prefix)) return true;
      return t.slice(prefix.length).split('/').length <= maxRelDepth;
    });
  }
  const oneLevelTargets = depthLimitedTo(built.targets, 'src/app/', 2);
  const floorOneLevel = coverageFloor(oneLevelTargets);

  // A2：反過來也要驗——絕對數字下限自己要拉自己的重量，不能靠 maxDepth 順便帶到。
  // 只留 server/ 底下深度 ≥3 的那 5 個檔（`server/providers/formats/*.ts`），
  // maxDepth 仍然是 3（healthy），但總數塌到 5、遠低於下限 30。如果只靠 maxDepth
  // 判斷（把 `deep >= minDeep` 那段拿掉），這裡會誤放行——這是實測過的真突變，
  // 不是假設。
  const countOnlyBrokenTargets = built.targets.filter((t) => {
    if (!t.startsWith('server/')) return true;
    return t.slice('server/'.length).split('/').length >= 3;
  });
  const floorCountOnlyBroken = coverageFloor(countOnlyBrokenTargets);

  // C2：第二把尺——健康的真實標的兩個根都要過。
  const subServerHealthy = subdirCoverage('server', built.targets);
  const subAppHealthy = subdirCoverage('src/app', built.targets);

  // C2：複驗實測的三個真實案例——整個子目錄從 targets 消失，coverageFloor（舊尺）
  // 全部誤放行，這把新尺要抓到。用真實 built.targets 過濾掉該子目錄，不是造假資料。
  const targetsNoLib = built.targets.filter((t) => !t.startsWith('server/lib/'));
  const subServerNoLib = subdirCoverage('server', targetsNoLib);
  const floorNoLib = coverageFloor(targetsNoLib); // 對照：舊尺對這個突變沒有免疫力

  const targetsNoRoutes = built.targets.filter((t) => !t.startsWith('server/routes/'));
  const subServerNoRoutes = subdirCoverage('server', targetsNoRoutes);
  const floorNoRoutes = coverageFloor(targetsNoRoutes);

  const targetsNoScreens = built.targets.filter((t) => !t.startsWith('src/app/screens/'));
  const subAppNoScreens = subdirCoverage('src/app', targetsNoScreens);
  const floorNoScreens = coverageFloor(targetsNoScreens);

  // 🔴 A3（第六輪）：複驗打穿的正是「只查一級」——上面 NoLib／NoRoutes／NoScreens
  // 三組砍掉的都是**一級**子目錄整個消失，一級尺本來就抓得到（那是 C2 那輪的成果，
  // 不是這輪要補的洞）。這輪要補的是**二級以下**的子目錄消失、但同一個一級目錄
  // 底下還有其他檔案撐著——一級尺會被那些檔案掩護過去，必須逐層查才抓得到。
  // 用複驗指名的三個真實巢狀目錄，一個都不是造出來的 fixture：
  //   `server/providers/formats/`（server/providers/ 底下還有 registry.ts 等撐著）
  //   `src/app/routes/settings/providers/`（settings/ 底下還有 about.tsx 等撐著）
  //   `src/app/routes/worlds/$worldId/`（worlds/ 底下還有 index.tsx 等撐著）
  const targetsNoFormats = built.targets.filter((t) => !t.startsWith('server/providers/formats/'));
  const subServerNoFormats = subdirCoverage('server', targetsNoFormats);
  const floorNoFormats = coverageFloor(targetsNoFormats); // 對照：舊一級尺一樣被掩護過去

  const targetsNoSettingsProviders = built.targets.filter(
    (t) => !t.startsWith('src/app/routes/settings/providers/'),
  );
  const subAppNoSettingsProviders = subdirCoverage('src/app', targetsNoSettingsProviders);
  const floorNoSettingsProviders = coverageFloor(targetsNoSettingsProviders);

  const targetsNoWorldId = built.targets.filter(
    (t) => !t.startsWith('src/app/routes/worlds/$worldId/'),
  );
  const subAppNoWorldId = subdirCoverage('src/app', targetsNoWorldId);
  const floorNoWorldId = coverageFloor(targetsNoWorldId);

  // A3：多層遞迴本身要有自己的 fixture 迴歸——不能只靠真實 repo 結構（那會隨編輯
  // 漂移）。造一棵 root/level1/level2/level3 的臨時樹，只讓 targets 缺 level2 這
  // 一層（level1 頂層還有別的檔撐著、level3 也還在，模擬「中間層被跳過」這個最
  // 貼近複驗打穿案例的形狀），斷言：(a) level2 節點本身被獨立記錄且抓到缺失，
  // (b) level1 節點因為還有別的檔案而不受影響。
  function testMultiLevelSubdirCoverage(): { deepCaught: boolean; shallowUnaffected: boolean } {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'gate-ownership-subdir-'));
    const relBase = relative(ROOT, fixtureRoot).split(/[\\/]/).join('/');
    try {
      mkdirSync(join(fixtureRoot, 'level1/level2/level3'), { recursive: true });
      writeFileSync(join(fixtureRoot, 'level1/sibling.ts'), '');
      writeFileSync(join(fixtureRoot, 'level1/level2/mid.ts'), '');
      writeFileSync(join(fixtureRoot, 'level1/level2/level3/deep.ts'), '');

      // targets 只缺 level2（及其底下的 level3）——level1 的其他檔案仍在，模擬
      // 一級尺會被掩護過去的那個形狀。
      const fakeTargets = [`${relBase}/level1/sibling.ts`];
      const result = subdirCoverage(relBase, fakeTargets);
      return {
        deepCaught: result.missing.includes(`${relBase}/level1/level2`),
        shallowUnaffected: !result.missing.includes(`${relBase}/level1`),
      };
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
  const multiLevel = testMultiLevelSubdirCoverage();

  // A3：讀取失敗要誠實顯示、不能被當成 0（過去坑）——用 `chmod 000` 造一個真的讀
  // 不到的目錄，斷言它被記進 `failedDirs` 且 `ok === false`，不是被吞成 0 悄悄放行。
  // 測完把權限改回來，finally 保證即使斷言失敗也會恢復。
  // 🔴 用 `root/mid/locked`（不是 `root/locked`）刻意隔開兩條會各自偵測到失敗的
  // 路徑，突變測試才真的只打中「算檔案數那段」：如果直接鎖 `root` 的**直接子目錄**，
  // 拿掉「讀失敗就不要往下鑽」那道 `continue` 之後，程式碼還是會嘗試遞迴進那個
  // 目錄本身，而遞迴用的 `readdirSync(parentDir)`（沒有 recursive 選項）對同一個
  // 被鎖的目錄一樣會丟同一種錯，被另一個 catch 接住、繼續誠實回報——兩條路徑對
  // 同一層意外形成了保險，反而讓「拿掉 continue」這個突變測不出來（實測過，見下面
  // 的突變測試表）。`mid` 這一層本身沒有被鎖、`readdirSync(mid)`（不遞迴）讀得到，
  // 只有「遞迴列舉 `mid` 底下所有檔案」（`readdirSync(mid, {recursive:true})`，
  // 算檔案數那段唯一在用的呼叫）會因為 `mid/locked` 讀不到而整個丟錯——這才是只有
  // 「算檔案數」那個 catch 會擋到、遞迴那個 catch 擋不到的形狀。
  function testUnreadableDirHonest(): { midRecorded: boolean; notOk: boolean } {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'gate-ownership-perm-'));
    const relBase = relative(ROOT, fixtureRoot).split(/[\\/]/).join('/');
    const midDir = join(fixtureRoot, 'mid');
    const lockedDir = join(midDir, 'locked');
    try {
      mkdirSync(lockedDir, { recursive: true });
      writeFileSync(join(lockedDir, 'x.ts'), '');
      chmodSync(lockedDir, 0o000);
      const result = subdirCoverage(relBase, []); // targets 全空，不管有沒有讀到都該缺標的
      return {
        midRecorded: result.failedDirs.includes(`${relBase}/mid`),
        notOk: result.ok === false,
      };
    } finally {
      chmodSync(lockedDir, 0o755);
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
  const unreadable = testUnreadableDirHonest();

  // B3：複驗的原句型——`providers.md:21` 本尊，🔴 在句子中間、整行本身又是 bullet。
  // 用真實 loadAgentClaims() 的結果確認 gemini.ts 依然正確歸 providers（不要為了修
  // B3 把這個合法寫法擋掉）。
  const providersGeminiOk = real.own.get('server/adapters/gemini.ts') === 'providers';

  // B3：同款句型但說明裡帶一個別人的 .ts 檔名——舊版會把它靜默誤認領，因為整行是
  // bullet，🔴 之後的文字從沒被剝掉過。
  const own_b3: OwnerMap = new Map();
  const rawB3 =
    '## 1 · Files you own\n\n' +
    "- `server/adapters/gemini.ts` — 🔴 in `adapters/`, not `lib/audioFiles.ts` (H8's)\n\n" +
    '## 2 · Files you must not write\n';
  parseClaims(ownedSection(rawB3), 'providers-b3', own_b3, new Map(), new Map(), new Map());

  // B1：`bullet → 🔴 單行說明 → 真續行（純檔名列表）→ 下一個新 bullet`——真續行
  // 現在要被正確接回同一個 dir 前綴認領，不能被說明段一路吃到下一個 bullet 才停。
  const own_b1: OwnerMap = new Map();
  const rawB1 =
    '## 1 · Files you own\n\n' +
    '- `server/lib/` — `first.ts`\n' +
    '  🔴 A clarifying sentence about naming.\n' +
    '  `second.ts`\n\n' +
    '## 2 · Files you must not write\n';
  parseClaims(ownedSection(rawB1), 'b1', own_b1, new Map(), new Map(), new Map());

  const cases: [string, boolean][] = [
    ['坑①：§2 must-not-write 不算認領', !own1.has('server/lib/notMine.ts')],
    ['§1 的檔正常認領', own1.get('server/lib/real.ts') === 'a'],
    ['坑②：🔴 說明段提到的檔名不算認領', !own2.has('server/lib/decoy.ts')],
    ['🔴 之前那行正常認領', own2.get('server/lib/real2.ts') === 'b'],
    ['坑③：續行沿用目錄前綴（第一個）', own3.get('server/lib/one.ts') === 'c'],
    ['坑③：續行沿用目錄前綴（第二個）', own3.get('server/lib/two.ts') === 'c'],
    ['坑④：**except** 排除句不是認領', !own4.has('excluded.ts')],
    ['坑④：glob 本身仍算認領', globs4.get('server/adapters/**') === 'd'],
    ['坑④：例外清單抽得到排除的那個檔', exceptions4.has('server/adapters/excluded.ts')],
    [
      '中等4：括號說明文字裡順口提到的檔名不算例外',
      exceptionsProse.has('server/adapters/gemini.ts') &&
        !exceptionsProse.has('server/adapters/legacyAdapter.ts'),
    ],
    [
      '第五輪坑 D：一組括號幫一串逗號分隔的檔名背書——兩個都要進例外清單',
      exceptionsGroup.has('server/adapters/a.ts') && exceptionsGroup.has('server/adapters/b.ts'),
    ],
    ['造孤兒 → 閘門變紅', orphanRun.code === 1 && orphanRun.orphans.includes('x/orphan.ts')],
    ['造重複 → 閘門變紅', dupRun.code === 1 && dupRun.dupList.length === 1],
    ['涵蓋率：0 個標的 → exit 2，不是 PASS', zeroRun.code === 2],
    ['坑⑤a：具名認領撞到 X 具名檔 → 算重複', dup5a.has('server/services/settings.ts')],
    ['坑⑤a：具名認領撞到 Xg glob → 算重複', dup5b.has('src/shared/tokens.ts')],
    ['坑⑤b：具名認領撞到別人的 glob（非法）→ 算重複', dup5c.has('server/adapters/backgrounds.ts')],
    ['坑⑤b：合法的 **except** 例外 → 不算重複', !dup5d.has('server/adapters/gemini.ts')],
    [
      '坑⑪a：兩個 agent 逐字宣告同一個 glob → globDup 記到、crossCheck 併回主 dup',
      dup11a.has('server/adapters/**'),
    ],
    ['坑⑪b：glob 撞 Xg（前綴重疊）→ 算重複', dup11b.has('src/shared/**')],
    ['坑⑪b：glob 撞 X（具名無主檔落在 glob 底下）→ 算重複', dup11c.has('server/adapters/**')],
    ['坑⑪b：兩個 agent 的 glob 前綴重疊（字面不同）→ 算重複', dup11d.has('server/adapters/**')],
    [
      '坑⑫：**except** 例外沒被任何人具名認領 → 回報孤兒',
      unclaimedOk.includes('server/adapters/gemini.ts'),
    ],
    ['坑⑫：例外有被具名認領時 → 不回報', unclaimedClean.length === 0],
    ['嚴重1：walk() 真的鑽得到巢狀目錄，也排除 skipDirNames', walkOk],
    ['嚴重1：buildTargets() server/ 遞迴（深度 ≥3）真的執行了', serverDeepOk],
    ['嚴重1：buildTargets() src/app/ 遞迴（深度 ≥3）真的執行了', appDeepOk],
    ['嚴重1：buildTargets() src/ 根目錄具名檔那段真的執行了', srcRootOk],
    ['嚴重1：buildTargets() repo 根目錄具名檔那段真的執行了', rootFilesOk],
    ['嚴重1：buildTargets() electron/** 那段真的執行了', electronOk],
    ['嚴重1：buildTargets() src/features/** 維持目錄粒度、沒有誤遞迴', featuresGrainOk],
    ['嚴重1：涵蓋率下限——健康的真實標的過門檻', floorHealthy.ok],
    ['嚴重1：涵蓋率下限——退化成只剩頂層時塌到門檻下', !floorBroken.ok],
    [
      '嚴重1：涵蓋率下限——只拿掉 server/ 半邊不能靠 src/app/ 半邊掩護',
      !floorServerOnlyBroken.ok && !floorServerOnlyBroken.server.ok && floorServerOnlyBroken.app.ok,
    ],
    ['C2：健康的真實標的，第二把尺 server/ 過關', subServerHealthy.ok],
    ['C2：健康的真實標的，第二把尺 src/app/ 過關', subAppHealthy.ok],
    [
      'C2：整個 server/lib/（48 檔）從 targets 消失 → 第二把尺抓到',
      !subServerNoLib.ok && subServerNoLib.missing.includes('server/lib'),
    ],
    [
      'C2：對照組——舊尺（coverageFloor）對「整個跳過 server/lib/」沒有免疫力（複驗實測的現象）',
      floorNoLib.ok,
    ],
    [
      'C2：整個 server/routes/（20 檔）從 targets 消失 → 第二把尺抓到',
      !subServerNoRoutes.ok && subServerNoRoutes.missing.includes('server/routes'),
    ],
    ['C2：對照組——舊尺對「整個跳過 server/routes/」一樣沒有免疫力', floorNoRoutes.ok],
    [
      'C2：整個 src/app/screens/（19 檔）從 targets 消失 → 第二把尺抓到',
      !subAppNoScreens.ok && subAppNoScreens.missing.includes('src/app/screens'),
    ],
    ['C2：對照組——舊尺對「整個跳過 src/app/screens/」一樣沒有免疫力', floorNoScreens.ok],
    [
      'A3：真實二級目錄 server/providers/formats/ 從 targets 消失 → 逐層尺抓到（一級尺被同層檔案掩護過去）',
      !subServerNoFormats.ok && subServerNoFormats.missing.includes('server/providers/formats'),
    ],
    [
      'A3：對照組——舊尺（coverageFloor）對這個突變只是**運氣好**才抓到：' +
        'server/ 的 maxDepth 剛好只靠這 5 個檔（深度 3）撐著，檔頭自己承認的薄邊際，' +
        '不是設計上就擋得住（下面兩組同型突變證明它其實擋不住）',
      !floorNoFormats.ok,
    ],
    [
      'A3：真實三級目錄 src/app/routes/settings/providers/ 從 targets 消失 → 逐層尺抓到',
      !subAppNoSettingsProviders.ok &&
        subAppNoSettingsProviders.missing.includes('src/app/routes/settings/providers'),
    ],
    [
      'A3：對照組——舊尺對這個突變完全沒抓到（settings/about.tsx 等同層檔案撐住，' +
        'maxDepth 也還有 worlds/$worldId/ 撐著不受影響）——複驗打穿的正是這一格',
      floorNoSettingsProviders.ok,
    ],
    [
      'A3：真實三級目錄 src/app/routes/worlds/$worldId/ 從 targets 消失 → 逐層尺抓到',
      !subAppNoWorldId.ok && subAppNoWorldId.missing.includes('src/app/routes/worlds/$worldId'),
    ],
    ['A3：對照組——舊尺對這個突變一樣完全沒抓到（worlds/index.tsx 等撐住）', floorNoWorldId.ok],
    [
      'A3：臨時 fixture——中間層（level2）被跳過要抓到，第一層（level1）不能被誤傷',
      multiLevel.deepCaught && multiLevel.shallowUnaffected,
    ],
    [
      'A3：目錄讀取失敗（chmod 000）要誠實記進 failedDirs 並讓這輪 FAIL，不能被吞成 0 靜默通過',
      unreadable.midRecorded && unreadable.notOk,
    ],
    ['B3：providers.md:21 現況照樣 PASS——沒有為了修 B3 把合法寫法擋掉', providersGeminiOk],
    [
      'B3：🔴 在句子中間、整行本身是 bullet——之後提到的別人檔名不該被靜默誤認領（複驗打穿的洞）',
      own_b3.get('server/adapters/gemini.ts') === 'providers-b3' &&
        !own_b3.has('lib/audioFiles.ts') &&
        !own_b3.has('server/lib/audioFiles.ts') &&
        !own_b3.has('audioFiles.ts'),
    ],
    [
      'B1：bullet → 🔴 單行說明 → 真續行——續行要被正確接回同一個 dir 前綴認領',
      own_b1.get('server/lib/first.ts') === 'b1' && own_b1.get('server/lib/second.ts') === 'b1',
    ],
    [
      '迴歸：server/lib/worldPresets.ts 只屬於 worldbook（坑①＋坑③一次全踩）',
      real.own.get('server/lib/worldPresets.ts') === 'worldbook' &&
        !real.dup.has('server/lib/worldPresets.ts'),
    ],
    ['迴歸：真實 agents 定義檔之間沒有意外的 glob／具名重複', real.dup.size === 0],
    ['迴歸：真實 agents 定義檔的每個 **except** 例外都有主', realUnclaimed.length === 0],
    [
      '5-2：說明段裡順口提到別人的 glob 做澄清，不算認領（複驗原句）',
      globNoteGlobs.get('src/features/audio/**') === 'audio' &&
        globNoteGlobs.get('src/features/extensions/**') === 'extensions',
    ],
    ['5-2：真的重複宣告同一個 glob 還是抓得到（不是把說明段一起放過）', dup5_2.size === 0],
    [
      '5-1：§2 表格「What to do」欄順口提到的檔名不算無主（複驗原句 a）',
      parsedTableClarify.X.has('real/unowned.ts') &&
        !parsedTableClarify.X.has('server/lib/audio.ts'),
    ],
    [
      '5-1：§2 表格外的散文段落提到的檔名不算無主（複驗原句 b）',
      parsedProseClarify.X.has('real/unowned2.ts') &&
        !parsedProseClarify.X.has('server/lib/audio2.ts'),
    ],
    [
      '迴歸：真實 AGENTS.md §2 的 X 集合抓不到 X4 欄位裡的範例檔名',
      !realX.X.has('chatFile.test.ts') && !realX.X.has('wiInject.test.ts'),
    ],
    ['5-3：countTestFiles() 遞迴找任何深度的 __tests__/，不是寫死兩個路徑', countTestFilesOk],
    [
      '5-3：真實 excludedTests 等於「三個已知 __tests__ 目錄」各自獨立重新 walk() 算出來的和' +
        '（兩條不同演算法的路徑，不是同一份計算比對自己——見上面的 🔴 GAP 註解）',
      built.excludedTests === expectedExcludedTests,
    ],
    ['A2：門檻對「頂層合規加 12 個新檔」免疫，不該紅', floorLegitGrowth.ok],
    [
      'A2：「只鑽一層」的改法絕對檔數仍健康，但 maxDepth 這段自己要抓到、不能靠絕對數字',
      !floorOneLevel.ok &&
        !floorOneLevel.app.ok &&
        floorOneLevel.app.deep >= MIN_DEEP_COUNT.app &&
        floorOneLevel.app.maxDepth < MIN_RECURSION_DEPTH,
    ],
    [
      'A2：反過來——maxDepth 健康但總數塌下去，絕對數字下限這段自己要抓到、不能靠 maxDepth',
      !floorCountOnlyBroken.ok &&
        !floorCountOnlyBroken.server.ok &&
        floorCountOnlyBroken.server.maxDepth >= MIN_RECURSION_DEPTH &&
        floorCountOnlyBroken.server.deep < MIN_DEEP_COUNT.server,
    ],
    // 第七輪：單一owner目錄放寬（INBOX/20260828-ownership-extract-deadlock.md）。
    [
      '第七輪案例1：單一owner目錄（真實 src/app/routes/chat/，只有 chat-core）' +
        '新增未登記的檔 → 完整 decide() pipeline 判無孤兒',
      singleOwnerRun.code === 0 && singleOwnerRun.orphans.length === 0,
    ],
    [
      '第七輪嚴重1鐵律：把 dirOwners 換成空 Map 重跑同一筆 decide() → 翻盤回孤兒，' +
        '證明上面那條「綠」不是巧合、是這個放寬真的在起作用',
      singleOwnerRunWithoutRelax.code === 1 &&
        singleOwnerRunWithoutRelax.orphans.includes(newFileInSingleOwnerDir),
    ],
    [
      '第七輪案例2（🔴 最重要的安全欄杆）：4 個真實共用目錄（server/services/ ' +
        'server/routes/ server/lib/ src/app/screens/，其中 server/services/ 與 ' +
        'src/app/screens/ 正是票裡兩張真的卡關過的目錄）新增未登記的檔，即使套用了 ' +
        'realDirOwners，仍然全部判孤兒——不是先到先贏、不是被掩護過去',
      sharedDirRun.code === 1 && sharedDirOrphans.every((p) => sharedDirRun.orphans.includes(p)),
    ],
    [
      '第七輪案例3：singleOwnerDirs() 從一開始就不把這 4 個共用目錄算進放行清單' +
        '（不是靠 decide() 的某個旁路意外擋住）',
      !realDirOwners.has('server/services/') &&
        !realDirOwners.has('server/routes/') &&
        !realDirOwners.has('server/lib/') &&
        !realDirOwners.has('src/app/screens/'),
    ],
    [
      '第七輪案例4（迴歸）：真實 170 個標的全量跑，套用放寬前後判定完全一樣' +
        '（0 孤兒、0 重複）——放寬對既有具名認領的檔案零影響',
      fullRunWithRelax.code === 0 &&
        fullRunWithRelax.orphans.length === 0 &&
        fullRunWithoutRelax.code === 0 &&
        fullRunWithoutRelax.orphans.length === 0,
    ],
  ];
  const bad = cases.filter(([, ok]) => !ok);
  for (const [name] of bad) console.error(`  selftest FAIL：${name}`);
  console.log(
    bad.length
      ? `selftest FAIL（${bad.length} 條，共 ${cases.length} 條）`
      : `selftest PASS（${cases.length} 條：十二個坑、walk() 遞迴、buildTargets() 六個掃描根、` +
          `三條解析路徑共用的說明段跳過（5-1／5-2）、__tests__ 計數（5-3）、` +
          `涵蓋率下限（A2，含頂層成長免疫）、子目錄消失的第二把尺（C2 一級＋A3 逐層遞迴、` +
          `含 fs 讀取失敗誠實回報）、🔴 行中觸發與純檔名續行的說明段結束條件（B3／B1）、` +
          `**except** 一組括號多檔背書（第五輪坑 D）都擋得住——` +
          `${cases.length} 條全綠只證明這些已知形狀被擋住，不證明沒有第 N+1 種）`,
  );
  process.exit(bad.length ? 1 : 0);
}
