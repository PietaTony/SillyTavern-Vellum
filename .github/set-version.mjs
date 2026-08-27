// 把 package.json 的 version 就地改成 CI 算出來的值。**不 commit** ——
// 版號寫回 repo 會生出 CI commit，並與人的 commit 賽跑。
//
// 🔴 存在的理由是「只留一把尺」：`server/adapters/version.ts` 讀 package.json，
// 所以 Release 的 tag 與 app 內顯示的版本必須是同一個字串。
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error(`版號形狀不對：${version}`);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`package.json version → ${version}`);
