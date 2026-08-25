/**
 * 這支在守什麼：**所有文字輸入都經過 `<DraftField>`**（規格 24 §4 層四、驗收 A2）。
 *
 * 為什麼：`useDraft` 這個 hook 存在了很久，但 8 個輸入點裡**有 4 個沒接上**——
 * 不是因為誰偷懶，是因為**要記得的東西一定會漏**。而階段八還有 17 個頁面要做
 * （entry 編輯一頁就五個欄位），群組聊天／供應商設定／取樣參數也都還沒做。
 * ⇒ 表單數量即將翻好幾倍。**現在建制度成本最低；等 50 個表單長出來，就是 50 次個別修。**
 *
 * 🔴 這支守的是**寫不出錯誤寫法**，不是「測得到」。
 * IME 組字中的內容自動化測不了，iOS 殺背景分頁的時機也重現不出來——
 * **測不到的東西只能用結構來守。**
 *
 * 🔴 **會先遮掉註解與字串再檢查**（沿用 `gate:no-eval` 的教訓）：
 * 不然「解釋為什麼用 DraftField」的註解會讓閘門紅燈，逼下一個人刪掉說明文字。
 * ⚠️ 用的是本檔的 `maskNoise()` 不是 `strip-noise.ts` —— 理由寫在那支函式的檔頭。
 *
 * ⚠️ 這支掃的是**標籤**。`contentEditable` 的 div、`react-quill`／`Lexical` 這類
 * 富文字元件沒有 `<input>` 或 `<TextField>` 標籤，會被直接放行——
 * 而那正是最複雜、最該保護的輸入場景。目前 `contentEditable` 全 repo 零命中，
 * **一旦引入富文字編輯器，這道閘門就有洞**，判準要從「掃標籤」升級成「掃表單狀態管理」。
 *
 * 自證：pnpm exec tsx scripts/gate-draft.ts --selftest
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = join(ROOT, 'src');

/**
 * 唯一准許直接用 MUI `TextField` 的檔 —— 它就是那個包裝。
 * 🔴 白名單只有這一條，而且**必須是元件本身**。要再加就要在這裡寫理由。
 */
const WRAPPER = 'src/shared/ui/DraftField.tsx';

/** 非文字的 input：檔案、隱藏欄位、勾選鈕。這些沒有草稿可言。 */
const NON_TEXT = /type=\{?["']?(file|hidden|checkbox|radio|range|color|submit|button)["']?\}?/;

export type Hit = { tag: string; line: number };

/**
 * 把註解與字串內容換成空白，**長度與換行完全不變**。
 *
 * 🔴 不能用 `strip-noise.ts`：它把區塊註解壓成一格，**行號會跑掉**，
 * 而且把 `type="file"` 剝成 `type=""` —— 於是「檔案 input 不算」這條判斷就失效了。
 * 這裡要的是「知道哪些位置是 code」，不是「把雜訊丟掉」。
 */
function maskNoise(src: string): string {
  const out = [...src];
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (two === '//') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      blank(i, stop);
      i = stop;
    } else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const quote = src[i];
      let k = i + 1;
      while (k < src.length && src[k] !== quote) k += src[k] === '\\' ? 2 : 1;
      // 只挖內容，留著引號 —— 這樣 `type=""` 仍然看得出是個 `type=` 屬性。
      blank(i + 1, k);
      i = k + 1;
    } else i += 1;
  }
  return out.join('');
}

/** 回傳這份原始碼裡「沒有經過 `DraftField`」的文字輸入。 */
export function findBareInputs(src: string): Hit[] {
  const masked = maskNoise(src);
  const hits: Hit[] = [];
  const re = /<(TextField|textarea|input)\b/g;
  for (let m = re.exec(masked); m !== null; m = re.exec(masked)) {
    const tag = m[1] ?? '';
    if (tag !== 'TextField') {
      // 一個 JSX 開頭標籤可能跨很多行 —— 屬性要在**原始碼**裡看（遮罩過的沒有 type 的值）。
      const close = src.indexOf('>', m.index);
      const block = src.slice(m.index, close === -1 ? src.length : close);
      if (NON_TEXT.test(block)) continue;
    }
    hits.push({ tag, line: masked.slice(0, m.index).split('\n').length });
  }
  return hits;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(p) && !/routeTree\.gen\./.test(p)) out.push(p);
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const cases: [string, string, number][] = [
    // 🔴 **驗收 A2 就是這一條**：新增一個沒用 DraftField 的 TextField，閘門要抓到。
    ['沒包裝的 TextField 要抓到', '<TextField value={v} onChange={f} />', 1],
    ['DraftField 不算', '<DraftField draftKey="k" value={v} onChange={f} />', 0],
    ['noDraft 的 DraftField 也不算', '<DraftField noDraft="理由" value={v} />', 0],
    ['檔案 input 不算', '<input hidden type="file" onChange={f} />', 0],
    ['勾選鈕不算', '<input type="checkbox" checked={c} />', 0],
    ['裸的文字 input 要抓到', '<input type="text" value={v} />', 1],
    ['沒寫 type 的 input 預設是文字，要抓到', '<input value={v} onChange={f} />', 1],
    ['textarea 要抓到', '<textarea value={v} onChange={f} />', 1],
    ['註解裡提到 <TextField 不算', '/** 不要直接用 <TextField，用 DraftField */', 0],
    ['字串裡的 <TextField 不算', "const s = '<TextField />';", 0],
    ['乾淨的檔不誤報', 'export const A = () => <div>hi</div>;', 0],
    [
      '跨行的 file input 不算（type 在第三行）',
      '<input\n  hidden\n  type="file"\n  onChange={f}\n/>',
      0,
    ],
  ];
  let bad = 0;
  for (const [name, src, expected] of cases) {
    const n = findBareInputs(src).length;
    if (n !== expected) {
      console.error(`  selftest FAIL：${name}（預期 ${expected}，實際 ${n}）`);
      bad += 1;
    }
  }
  console.log(
    bad
      ? `selftest FAIL（${bad} 條）`
      : `selftest PASS（${cases.length} 條：沒包裝的抓得到、非文字與註解字串不誤報）`,
  );
  process.exit(bad ? 1 : 0);
}

const files = walk(SCAN).filter((f) => relative(ROOT, f) !== WRAPPER);
// 🔴 掃到 0 個檔不是 PASS —— 比對 0 個項目必然通過，那是假綠燈。
if (files.length === 0) {
  console.error('gate:draft FAIL — 掃到 0 個 .tsx，是尺壞了不是全部乾淨');
  process.exit(1);
}
const bad = files
  .map((f) => ({ file: relative(ROOT, f), hits: findBareInputs(readFileSync(f, 'utf8')) }))
  .filter((x) => x.hits.length > 0);
if (bad.length) {
  console.error(`gate:draft FAIL — ${bad.length} 個檔有沒接草稿的輸入（掃了 ${files.length} 個）`);
  for (const b of bad)
    for (const h of b.hits) console.error(`  ${b.file}:${h.line} <${h.tag}> ⇒ 改用 <DraftField>`);
  console.error('  不需要草稿的話用 <DraftField noDraft="理由" />——白名單一定要寫理由。');
  process.exit(1);
}
console.log(
  `gate:draft PASS — ${files.length} 個 .tsx，文字輸入全部經過 <DraftField>（${WRAPPER} 本身豁免）`,
);
