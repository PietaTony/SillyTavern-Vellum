import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routesFromScreens } from '../../scripts/lib/gap124-catalog.ts';
import {
  catalogIds,
  checkScreenIdCatalog,
  ID_RE,
  type BindFile,
  type Binding,
  type Manifest,
} from '../../scripts/lib/gap124-catalog.ts';

const ROOT = join(import.meta.dirname, '../..');

/**
 * GAP-124 catalog 尺 —— `gate:screen-id` 的 forward 邏輯用 fixture 釘住，
 * 不靠「我跑過 gate 所以一定對」（Peter 2026-08-29：gate 也要 vitest 收據）。
 *
 * 🔴 守的是「比對 0 個必然 PASS」那類假綠燈，跟 gate 檔頭寫的一樣。
 */
const miniManifest = (screens: { id: string }[]): Manifest => ({
  active: 'T',
  milestones: { T: { screens: screens.map((s) => ({ ...s, route: 'chat/$chatId' })) } },
});

const miniBind = (rows: Binding[]): BindFile => ({
  active: 'T',
  bindings: rows,
});

describe('ID_RE（GAP-124 spec §2）', () => {
  it('接受 catalog 常見 id', () => {
    expect(ID_RE.test('First-Run--3b')).toBe(true);
    expect(ID_RE.test('Layer-Greetings--1')).toBe(true);
  });

  it('🔴 拒絕空白、中文、空格 —— 不是 trim 一下就放行', () => {
    expect(ID_RE.test('')).toBe(false);
    expect(ID_RE.test('金鑰頁')).toBe(false);
    expect(ID_RE.test('First Run')).toBe(false);
  });
});

describe('checkScreenIdCatalog —— 合成 fixture', () => {
  it('🔴 空 catalog 不是 PASS', () => {
    const r = checkScreenIdCatalog(
      { active: 'T', milestones: { T: { screens: [] } } },
      { active: 'T', bindings: [{ id: 'A', route: 'x', stateRule: 'x' }] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fatal).toContain('假綠燈');
  });

  it('🔴 空 bindings 不是 PASS', () => {
    const r = checkScreenIdCatalog(miniManifest([{ id: 'A' }]), { active: 'T', bindings: [] });
    expect(r.ok).toBe(false);
  });

  it('🔴 active 里程碑不一致直接 FAIL', () => {
    const r = checkScreenIdCatalog(miniManifest([{ id: 'A' }]), {
      active: 'OTHER',
      bindings: [{ id: 'A', route: 'x', stateRule: 'x' }],
    });
    expect(r.ok).toBe(false);
  });

  it('🔴 catalog 有、bindings 缺列', () => {
    const r = checkScreenIdCatalog(miniManifest([{ id: 'A' }, { id: 'B' }]), miniBind([
      { id: 'A', route: 'x', stateRule: 'only A' },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bad.some((b) => b.includes('B'))).toBe(true);
  });

  it('🔴 bindings 多列、catalog 沒有', () => {
    const r = checkScreenIdCatalog(miniManifest([{ id: 'A' }]), miniBind([
      { id: 'A', route: 'x', stateRule: 'ok' },
      { id: 'GHOST', route: 'x', stateRule: 'orphan' },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bad.some((b) => b.includes('GHOST'))).toBe(true);
  });

  it('🔴 缺 stateRule 判 bad', () => {
    const r = checkScreenIdCatalog(miniManifest([{ id: 'A' }]), miniBind([
      { id: 'A', route: 'x', stateRule: '   ' },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bad.some((b) => b.includes('stateRule'))).toBe(true);
  });

  it('對齊時 bad 為空', () => {
    const r = checkScreenIdCatalog(miniManifest([{ id: 'A' }]), miniBind([
      { id: 'A', route: 'x', stateRule: 'ok' },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bad).toEqual([]);
  });
});

describe('routesFromScreens —— layer hostRoute（gate:screens）', () => {
  it('layer 用 hostRoute 列入 route 清單', () => {
    expect(
      routesFromScreens([
        { route: 'chat/$chatId', kind: 'layer', hostRoute: 'chat/$chatId' },
        { route: 'profile', kind: 'dialog', hostRoute: 'profile' },
      ]),
    ).toEqual(['chat/$chatId', 'profile']);
  });

  it('無 kind 的 route 頁維持原 route', () => {
    expect(routesFromScreens([{ route: 'settings/about' }])).toEqual(['settings/about']);
  });
});

describe('design 正本 —— repo 內 catalog 與 bindings', () => {
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'design/screens.json'), 'utf8'),
  ) as Manifest;
  const bind = JSON.parse(
    readFileSync(join(ROOT, 'design/screen-id-bindings.json'), 'utf8'),
  ) as BindFile;

  it('M2 catalog 與 bindings 1:1 且零 bad', () => {
    const r = checkScreenIdCatalog(manifest, bind);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bad).toEqual([]);
      expect(r.catalog).toBe(r.bindings);
      expect(r.catalog).toBeGreaterThanOrEqual(33);
    }
  });

  it('🔴 catalogIds 讀到 0 個不是綠燈', () => {
    expect(catalogIds(manifest).length).toBeGreaterThan(0);
  });

  it('全螢層 id 已在 catalog（例 Layer-Greetings--1）', () => {
    const ids = catalogIds(manifest);
    expect(ids).toContain('Layer-Greetings--1');
    expect(ids).toContain('Dialog-Consent-Scripts--1');
  });
});
