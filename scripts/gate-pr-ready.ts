/**
 * 這支在守什麼：PR 交件前的機械檢查清單（對照 FEATURE-DONE.md Tier 1–2）。
 *
 * 為什麼：`pnpm verify` 守的是 repo 恆真；PR 還需要「這次 diff 該有的文件與測試」。
 * 人工對帳會漂——尤其是持久化檔六題、安全 README、新 route 沒進 screens.json。
 *
 * 用法：
 *   pnpm gate:pr-ready              — 結構檢查（CI / verify 用）
 *   pnpm gate:pr-ready --diff BASE  — 再加 diff 檢查（開 PR 前；BASE 例：origin/staging）
 *
 * 自證：pnpm exec tsx scripts/gate-pr-ready.ts --selftest
 *
 * 🔴 2026-08-31 追溯票修正（INBOX/20260831-pr-ready-gate.md）兩個根因：
 * ① 舊版 `PERSISTED` 只手抄 2 類（settings.json／auth.json），但 `writeJson(` 呼叫端
 *    實際落地 7 類——名單本身就是「以後會漏」的設計。現在改成：`PERSISTED` 仍是
 *    「哪一類該去哪個正本模組核對」的登記表（人工可讀、可審），但額外跑一次
 *    `discoverPersistedCategories()` 反掃全部 `writeJson(` 呼叫端，兩邊對不上
 *    （多一類沒登記、或登記的類別沒人再寫了）就紅——名單再也不能悄悄漏勾。
 * ② 六題慣例本身只在「對既有形狀加新欄位」時才會被寫（settingsModel.ts／character.ts／
 *    chatModel.ts 都是這樣，authStore.ts 是唯一「整份新檔」的個案）。personas/*.json、
 *    worlds/*.json、secrets.json 目前**還沒有任何一次加欄位動過六題這條路**——
 *    這不是漏補文件，是還沒輪到。硬幫它們編一段「為何非加不可」是造假註解
 *    （比沒有更糟，CLAUDE.md 已經點名這個坑）。所以這三類只要求「正本模組還在、
 *    沒被清空、真的在講這個持久化面」，不假裝已有六題；`requireSixQuestions: true`
 *    的四類（有六題慣例在跑）才用原本「必須含『六題』字樣」的嚴格判準。
 *    ⚠️ 2026-08-31 複驗線抓到的數字錯誤（已更正）：全 repo `git grep 六題` 命中的是
 *    **12 個檔**，不是「4 個檔」—— 拆開來看：**4 個**是真正定義六題區塊的正本模組
 *    （settingsModel.ts／authStore.ts／character.ts／chatModel.ts）；**3 個**只是指回
 *    那批正本的一行引用（chatVariables.ts／globalWorlds.ts／src/features/chat/model.ts，
 *    各一句「見 xxx 的六題」）；其餘 **5 個**是治理文件在講「六題」這個詞本身
 *    （platform.md／PR 模板／FEATURE-DONE.md／gap-index.md／這支檔案自己）。
 *    上面「四類」指的是那 4 個正本模組，不是「六題只出現在 4 個檔」——
 *    `persona.ts`／`charWorld.ts`／`secrets.ts` 沒有被任何一個六題區塊指到，
 *    這件事本身沒有變，只是範圍講法要對齊 12 個檔的事實，不要讓下一個人自己
 *    grep 出 12 個之後懷疑這段判準是不是過期了。
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const isMain = import.meta.url === `file://${process.argv[1]}`;

type PersistedEntry = {
  /** discoverPersistedCategories() 抓出來的 token，見該函式註解 */
  category: string;
  /** 給人看的檔名／pattern，只用在錯誤訊息 */
  dataFile: string;
  module: string;
  /** 用來確認「這個模組真的在講這個持久化面」，而不是隨便一個非空檔案就過 */
  keyword: string;
  requireSixQuestions: boolean;
};

const PERSISTED: PersistedEntry[] = [
  {
    category: 'settings.json',
    dataFile: 'settings.json',
    module: 'server/lib/settingsModel.ts',
    keyword: 'settings.json',
    requireSixQuestions: true,
  },
  {
    category: 'auth.json',
    dataFile: 'auth.json',
    module: 'server/lib/authStore.ts',
    keyword: 'auth.json',
    requireSixQuestions: true,
  },
  {
    category: 'characters/',
    dataFile: 'characters/*.json',
    module: 'server/lib/character.ts',
    keyword: 'characters/',
    requireSixQuestions: true,
  },
  {
    category: 'chats/',
    dataFile: 'chats/*.json',
    module: 'server/services/chatModel.ts',
    keyword: 'chats/',
    requireSixQuestions: true,
  },
  {
    category: 'worlds/',
    dataFile: 'worlds/*.json',
    module: 'server/lib/charWorld.ts',
    keyword: 'CharWorld',
    requireSixQuestions: false,
  },
  {
    category: 'personas/',
    dataFile: 'personas/*.json',
    module: 'server/lib/persona.ts',
    keyword: 'Persona',
    requireSixQuestions: false,
  },
  {
    category: 'secrets.json',
    dataFile: 'secrets.json',
    module: 'server/services/secrets.ts',
    keyword: 'secrets.json',
    requireSixQuestions: false,
  },
];

const PR_SECTIONS = [/##\s*(起因|摘要)/, /##\s*(做了什麼|變更)/, /##\s*驗收/];

export function checkFeatureDone(root: string): string[] {
  const p = join(root, 'FEATURE-DONE.md');
  if (!existsSync(p)) return ['FEATURE-DONE.md: missing'];
  const body = readFileSync(p, 'utf8');
  const need = ['Tier 0', 'Tier 1', 'Tier 2'];
  return need.filter((t) => !body.includes(t)).map((t) => `FEATURE-DONE.md: 缺 ${t}`);
}

export function checkPrTemplate(root: string): string[] {
  const p = join(root, '.github/PULL_REQUEST_TEMPLATE.md');
  if (!existsSync(p)) return ['.github/PULL_REQUEST_TEMPLATE.md: missing'];
  const body = readFileSync(p, 'utf8');
  return PR_SECTIONS.filter((re) => !re.test(body)).map(
    (re) => `.github/PULL_REQUEST_TEMPLATE.md: 缺段落（需匹配 ${re}）`,
  );
}

/**
 * 反掃 `server/` 底下所有 `writeJson(` 呼叫端，推回「這支 gate 應該知道的持久化類別」。
 * 抓得到字面字串（`writeJson('secrets.json', …)`）與模板字面量前綴
 * （`writeJson(\`chats/${id}.json\`, …)` → `chats/`），抓不到字面就近呼叫端所在檔
 * 找 `const FILE = '...'` 這種一層變數別名（`secrets.ts` 用的就是這招）。
 * 這個函式本身不判斷「該不該有六題」——它只負責「有沒有漏登記」。
 */
export function discoverPersistedCategories(root: string): Set<string> {
  const found = new Set<string>();
  const serverDir = join(root, 'server');
  if (!existsSync(serverDir)) return found;

  const resolveLiteral = (arg: string, src: string): string | null => {
    const a = arg.trim();
    if (a.startsWith('`')) {
      const m = a.match(/^`([^`$]*)/);
      return m?.[1] ?? null;
    }
    if (a.startsWith("'") || a.startsWith('"')) {
      const q = a[0];
      const m = a.match(new RegExp(`^\\${q}([^\\${q}]*)\\${q}`));
      return m?.[1] ?? null;
    }
    const ident = a.match(/^[A-Za-z_$][\w$]*/)?.[0];
    if (!ident) return null;
    const m = src.match(new RegExp(`const\\s+${ident}\\s*(?::[^=]+)?=\\s*['"\`]([^'"\`]*)['"\`]`));
    return m?.[1] ?? null;
  };

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const src = readFileSync(full, 'utf8');
      const re = /writeJson\(\s*([^,]+),/g;
      let m: RegExpExecArray | null = re.exec(src);
      while (m) {
        const literal = resolveLiteral(m[1] ?? '', src);
        if (literal) found.add(literal.includes('/') ? `${literal.split('/')[0]}/` : literal);
        m = re.exec(src);
      }
    }
  };
  walk(serverDir);
  return found;
}

export function checkPersistedSix(root: string): string[] {
  const bad: string[] = [];
  const discovered = discoverPersistedCategories(root);
  if (discovered.size === 0) {
    return ['gate:pr-ready: writeJson( 呼叫端掃到 0 個 —— 量測管道本身壞了，不是乾淨'];
  }

  const registered = new Set(PERSISTED.map((p) => p.category));
  for (const cat of discovered) {
    if (!registered.has(cat)) {
      bad.push(`新持久化類別未登記於 PERSISTED：${cat}（補進 scripts/gate-pr-ready.ts）`);
    }
  }

  for (const entry of PERSISTED) {
    const modPath = join(root, entry.module);
    if (!existsSync(modPath)) {
      bad.push(`${entry.module}: 不存在（登記為 ${entry.dataFile} 的正本，但檔案不見了）`);
      continue;
    }
    const src = readFileSync(modPath, 'utf8');
    if (entry.requireSixQuestions) {
      if (!src.includes('六題'))
        bad.push(`${entry.module}: 缺「六題」檔頭（持久化 ${entry.dataFile}）`);
      else if (!src.includes(entry.keyword)) bad.push(`${entry.module}: 未提及 ${entry.keyword}`);
    } else if (src.trim().length < 200 || !src.includes(entry.keyword)) {
      bad.push(`${entry.module}: 內容不像 ${entry.dataFile} 的正本模組（清空了或關鍵字不見了）`);
    }
  }
  return bad;
}

export function checkSecurityReadme(root: string): string[] {
  const authPaths = [
    'server/lib/authStore.ts',
    'server/routes/auth.ts',
    'server/http/authGuard.ts',
  ];
  if (!authPaths.some((rel) => existsSync(join(root, rel)))) return [];
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const need = ['存取密碼', 'auth.json'];
  return need.filter((w) => !readme.includes(w)).map((w) => `README.md: 有 auth 模組但缺「${w}」`);
}

export function gitChanged(root: string, base: string): string[] {
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return out ? out.split('\n') : [];
  } catch {
    return [];
  }
}

export function checkDiffTests(changed: string[]): string[] {
  const bad: string[] = [];
  const re = /^server\/(?:lib|routes)\/([^/]+)\.ts$/;
  for (const f of changed) {
    const m = f.match(re);
    if (!m || f.endsWith('.d.ts')) continue;
    const test = `server/__tests__/${m[1]}.test.ts`;
    if (!existsSync(join(ROOT, test))) bad.push(`${f}: 缺 ${test}`);
  }
  return bad;
}

export function checkDiffRoutes(changed: string[], root: string): string[] {
  const routeRe = /^src\/app\/routes\/(.+\.tsx)$/;
  const newRoutes = changed
    .map((f) => {
      const m = f.match(routeRe);
      if (!m?.[1]) return null;
      const name = m[1]
        .replace(/\.tsx$/, '')
        .replace(/\//g, '.')
        .replace(/\.index$/, '');
      return name === 'index' || name === '__root' ? null : name.replace(/\.index$/, '');
    })
    .filter(Boolean) as string[];
  if (!newRoutes.length) return [];
  const manifest = JSON.parse(readFileSync(join(root, 'design', 'screens.json'), 'utf8')) as {
    active: string;
    milestones?: Record<string, { screens?: { route: string }[] }>;
  };
  const active = manifest.milestones?.[manifest.active]?.screens ?? [];
  const known = new Set(active.map((s) => s.route));
  return newRoutes
    .filter((r) => !known.has(r) && !known.has(r.replace(/\./g, '/')))
    .map((r) => `新 route ${r}: 不在 design/screens.json active 里程碑`);
}

function run(root: string, diffBase?: string): string[] {
  const bad = [
    ...checkFeatureDone(root),
    ...checkPrTemplate(root),
    ...checkPersistedSix(root),
    ...checkSecurityReadme(root),
  ];
  if (diffBase) {
    const changed = gitChanged(root, diffBase);
    if (changed.length === 0) bad.push(`git diff ${diffBase}...HEAD: 0 個檔案 —— 無 diff 可檢`);
    else {
      bad.push(...checkDiffTests(changed));
      bad.push(...checkDiffRoutes(changed, root));
    }
  }
  return bad;
}

if (process.argv.includes('--selftest')) {
  runSelftest();
}

if (isMain && !process.argv.includes('--selftest')) {
  const discovered = discoverPersistedCategories(ROOT);
  if (discovered.size === 0) {
    console.error('gate:pr-ready FAIL — writeJson( 呼叫端掃到 0 個（尺壞了，不是乾淨）');
    process.exit(2);
  }
  const diffIdx = process.argv.indexOf('--diff');
  const diffBase = diffIdx >= 0 ? process.argv[diffIdx + 1] : undefined;
  const bad = run(ROOT, diffBase);
  if (bad.length) {
    console.error(`gate:pr-ready FAIL:\n${bad.map((b) => `  • ${b}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    diffBase
      ? `gate:pr-ready OK（結構 + diff vs ${diffBase}）`
      : 'gate:pr-ready OK（結構檢查；開 PR 前請加 --diff origin/staging）',
  );
}

/**
 * 🔴 每一條的自證都要餵「已知會出錯的輸入」，不是只跑一次乾淨的 repo 現況
 * ——後者「函式正常」與「函式被挖空」回的都是 `[]`，兩者分不出來（2026-08-31 追溯票）。
 * 用 `mkdtempSync` 蓋一次性 fixture 目錄，好壞兩份都真的落地到檔案系統再掃。
 */
function runSelftest(): void {
  let bad = 0;
  const fail = (name: string) => {
    console.error(`  selftest FAIL：${name}`);
    bad += 1;
  };

  // --- checkFeatureDone：不存在的 root ---
  const tmpMissing = checkFeatureDone('/nonexistent-gate-pr-ready');
  if (tmpMissing.length !== 1 || !tmpMissing[0]?.includes('missing')) fail('缺 FEATURE-DONE');

  // --- checkPrTemplate：已知缺段落的模板 ---
  {
    const dir = mkdtempSync(`${tmpdir()}${sep}gate-pr-ready-tpl-`);
    mkdirSync(join(dir, '.github'), { recursive: true });
    writeFileSync(join(dir, '.github/PULL_REQUEST_TEMPLATE.md'), '## 其他\n沒有正確段落\n');
    const bad1 = checkPrTemplate(dir);
    if (bad1.length !== 3) fail('PR 模板：缺三段落應該全部被抓到');
    writeFileSync(
      join(dir, '.github/PULL_REQUEST_TEMPLATE.md'),
      '## 起因\nx\n## 做了什麼\nx\n## 驗收\nx\n',
    );
    if (checkPrTemplate(dir).length !== 0) fail('PR 模板：三段落齊全應該乾淨');
    rmSync(dir, { recursive: true, force: true });
  }

  // --- checkPersistedSix：好 fixture 全綠、壞 fixture（缺六題／清空／漏登記）全紅 ---
  {
    const dir = mkdtempSync(`${tmpdir()}${sep}gate-pr-ready-six-`);
    const lib = join(dir, 'server/lib');
    const services = join(dir, 'server/services');
    mkdirSync(lib, { recursive: true });
    mkdirSync(services, { recursive: true });
    writeFileSync(join(lib, 'settingsModel.ts'), '// 六題 settings.json\nexport type X = 1;\n');
    writeFileSync(join(lib, 'authStore.ts'), '// 六題 auth.json\nexport type X = 1;\n');
    writeFileSync(join(lib, 'character.ts'), '// 六題 characters/\nexport type X = 1;\n');
    writeFileSync(join(services, 'chatModel.ts'), '// 六題 chats/\nexport type X = 1;\n');
    writeFileSync(
      join(lib, 'charWorld.ts'),
      `// CharWorld 世界書副本，這裡故意墊長一點避免被誤判成清空的空殼檔案\nexport type CharWorld = { uid: string };\n${'// pad line to push fixture past the trivial-file threshold\n'.repeat(15)}`,
    );
    writeFileSync(
      join(lib, 'persona.ts'),
      `// Persona 型別，這裡故意墊長一點避免被誤判成清空的空殼檔案\nexport type Persona = { id: string };\n${'// pad line to push fixture past the trivial-file threshold\n'.repeat(15)}`,
    );
    writeFileSync(
      join(services, 'secrets.ts'),
      `const FILE = 'secrets.json';\n${'// pad line to push fixture past the trivial-file threshold\n'.repeat(15)}`,
    );
    mkdirSync(join(dir, 'server/routes'), { recursive: true });
    writeFileSync(
      join(dir, 'server/routes/writers.ts'),
      [
        "writeJson('settings.json', s);",
        "writeJson('auth.json', a);",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: 這是要寫進 fixture 檔的字面 TS 原始碼，不是插值
        'writeJson(`characters/${id}.json`, c);',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: 同上
        'writeJson(`chats/${id}.json`, c);',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: 同上
        'writeJson(`worlds/${id}.json`, w);',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: 同上
        'writeJson(`personas/${id}.json`, p);',
        "writeJson(FILE, s); const FILE = 'secrets.json';",
      ].join('\n'),
    );
    const goodResult = checkPersistedSix(dir);
    if (goodResult.length !== 0)
      fail(`persisted 六題：好 fixture 應該乾淨，實際 ${JSON.stringify(goodResult)}`);

    // 壞：settingsModel.ts 挖掉六題字樣
    writeFileSync(join(lib, 'settingsModel.ts'), 'export type X = 1;\n');
    if (!checkPersistedSix(dir).some((x) => x.includes('settingsModel.ts') && x.includes('六題')))
      fail('persisted 六題：settingsModel 缺六題應該被抓到');
    writeFileSync(join(lib, 'settingsModel.ts'), '// 六題 settings.json\nexport type X = 1;\n');

    // 壞：persona.ts 被清空（非六題那三類的「清空」防呆）
    writeFileSync(join(lib, 'persona.ts'), '');
    if (!checkPersistedSix(dir).some((x) => x.includes('persona.ts')))
      fail('persisted 六題：persona.ts 清空應該被抓到');
    writeFileSync(
      join(lib, 'persona.ts'),
      `// Persona 型別，這裡故意墊長一點避免被誤判成清空的空殼檔案\nexport type Persona = { id: string };\n${'// pad line to push fixture past the trivial-file threshold\n'.repeat(15)}`,
    );

    // 壞：多一個沒登記的持久化類別
    writeFileSync(join(dir, 'server/routes/orphan.ts'), "writeJson('orphan-file.json', {});");
    if (!checkPersistedSix(dir).some((x) => x.includes('未登記')))
      fail('persisted 六題：新類別沒登記應該被抓到');
    rmSync(join(dir, 'server/routes/orphan.ts'));

    if (checkPersistedSix(dir).length !== 0) fail('persisted 六題：還原後應該恢復乾淨');

    // 壞：writeJson 呼叫端掃到 0 個 —— 量測管道本身要出聲
    const emptyDir = mkdtempSync(`${tmpdir()}${sep}gate-pr-ready-empty-`);
    mkdirSync(join(emptyDir, 'server'), { recursive: true });
    if (!checkPersistedSix(emptyDir).some((x) => x.includes('量測管道本身壞了')))
      fail('persisted 六題：0 個 writeJson 呼叫端應該出聲，不是靜靜通過');
    rmSync(emptyDir, { recursive: true, force: true });

    rmSync(dir, { recursive: true, force: true });
  }

  // --- checkSecurityReadme：有 auth 模組但 README 沒提，應該被抓到 ---
  {
    const dir = mkdtempSync(`${tmpdir()}${sep}gate-pr-ready-readme-`);
    mkdirSync(join(dir, 'server/lib'), { recursive: true });
    writeFileSync(join(dir, 'server/lib/authStore.ts'), '// dummy');
    writeFileSync(join(dir, 'README.md'), '這裡什麼都沒提到。\n');
    const badReadme = checkSecurityReadme(dir);
    if (badReadme.length !== 2) fail('security README：兩個關鍵字都缺應該兩條都被抓到');
    writeFileSync(join(dir, 'README.md'), '有存取密碼機制，存在 auth.json。\n');
    if (checkSecurityReadme(dir).length !== 0) fail('security README：兩個關鍵字都在應該乾淨');
    rmSync(dir, { recursive: true, force: true });
  }

  const sixOk = checkPersistedSix(ROOT);
  if (sixOk.length !== 0) fail(`repo 現況的 persisted 六題應該乾淨，實際 ${JSON.stringify(sixOk)}`);

  const tests = checkDiffTests(['server/lib/authStore.ts']);
  if (!tests[0]?.includes('authStore.test.ts')) fail('diff 測試配對');

  // 🔴 2026-08-31 rebase 後才炸出來的坑：這裡原本寫死 `login.tsx`，
  // 假設它「一定不在 screens.json」——PR #37（存取密碼）把 login route 排進
  // active 里程碑之後這條假設就不成立，選一個永遠不會被登記的假路由名避免重蹈覆轍。
  const routes = checkDiffRoutes(['src/app/routes/zzz-definitely-unregistered.tsx'], ROOT);
  if (routes.length !== 1 || !routes[0]?.includes('zzz-definitely-unregistered'))
    fail('diff route 對 screens');

  console.log(
    bad
      ? `selftest FAIL（${bad} 條）`
      : `selftest PASS（FEATURE-DONE、PR 模板、持久化六題×7 類、security README、diff 配對；repo run=${run(ROOT).length === 0}）`,
  );
  process.exit(bad ? 1 : 0);
}
