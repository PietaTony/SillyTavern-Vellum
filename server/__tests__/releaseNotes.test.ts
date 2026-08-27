import { describe, expect, it } from 'vitest';
import { stripDownloadTable } from '../lib/releaseNotes.ts';

/** 真實形狀：`cd.yml` 的 release job 把下載表格 ＋ `---` ＋ next.md 組起來。 */
const REAL = `## 要下載哪一個

| 你是 | 下載 |
|---|---|
| Windows | \`Vellum Setup 0.2.2.exe\` |

Mac 的 \`.dmg\` 是 ad-hoc 簽章。

---

## 這一版之後，Vellum 會自己告訴你有新版

裝了 Windows 安裝版或 Mac 版的話，以後不用再自己回來看。`;

describe('stripDownloadTable', () => {
  it('🔴 剝掉下載表格，只留給已安裝使用者看的正文', () => {
    const out = stripDownloadTable(REAL);
    expect(out).toContain('會自己告訴你有新版');
    expect(out).not.toContain('要下載哪一個');
    expect(out).not.toContain('ad-hoc');
  });

  it('沒有分隔線就原文照還——不要因為形狀不合就吞掉內容', () => {
    expect(stripDownloadTable('只有一段話，沒有表格')).toBe('只有一段話，沒有表格');
  });

  it('🔴 分隔線之後是空的 ⇒ 還原文，不要回傳空字串', () => {
    expect(stripDownloadTable('前面有東西\n---\n   ')).toContain('前面有東西');
  });

  it('正文自己也有 --- 時取最後一段（下載表格永遠在最前面）', () => {
    const out = stripDownloadTable('表格\n---\n正文上半\n---\n正文下半');
    expect(out).toBe('正文下半');
  });

  it('空的／null 回 null', () => {
    expect(stripDownloadTable('')).toBeNull();
    expect(stripDownloadTable(null)).toBeNull();
    expect(stripDownloadTable(undefined)).toBeNull();
  });
});
