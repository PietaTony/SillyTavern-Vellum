/**
 * GAP-124 catalog 純邏輯 —— gate 與 vitest 共用，無 import.meta / 讀檔副作用。
 * 正本：design/GAP-124-spec.md
 */

/** GAP-124 screen id 字串格式（spec §2）。 */
export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export type Screen = { id: string; route: string };
export type Manifest = { active: string; milestones?: Record<string, { screens?: Screen[] }> };
export type Binding = { id: string; route: string; stateRule?: string; implemented?: boolean };
export type BindFile = { active: string; bindings?: Binding[] };
export type ScreenRow = { route: string; hostRoute?: string; kind?: string };

export type ScreenIdCheckResult =
  | { ok: false; fatal: string }
  | { ok: true; catalog: number; bindings: number; bad: string[] };

export function catalogIds(m: Manifest): string[] {
  const ms = m.milestones?.[m.active];
  const screens = ms?.screens ?? [];
  if (!screens.length) throw new Error('EMPTY_CATALOG');
  return screens.map((s) => s.id);
}

/** catalog ↔ bindings 完整性（v0）。 */
export function checkScreenIdCatalog(manifest: Manifest, bind: BindFile): ScreenIdCheckResult {
  if (bind.active !== manifest.active)
    return {
      ok: false,
      fatal: `bindings active="${bind.active}" ≠ screens.json active="${manifest.active}"`,
    };

  let catalog: string[];
  try {
    catalog = catalogIds(manifest);
  } catch {
    return { ok: false, fatal: 'active 里程碑畫面清單是空的 —— 比對 0 個必然 PASS，假綠燈' };
  }

  const rows = bind.bindings ?? [];
  if (!rows.length)
    return { ok: false, fatal: 'screen-id-bindings.json 的 bindings 是空的 —— 假綠燈' };

  const bad: string[] = [];
  const bound = new Set<string>();

  for (const b of rows) {
    if (!ID_RE.test(b.id)) bad.push(`${b.id}: 不符合 ID_REGEX`);
    if (!b.stateRule?.trim()) bad.push(`${b.id}: 缺少 stateRule`);
    if (bound.has(b.id)) bad.push(`${b.id}: bindings 內重複`);
    bound.add(b.id);
  }

  for (const id of catalog) {
    if (!ID_RE.test(id)) bad.push(`catalog ${id}: 不符合 ID_REGEX`);
    if (!bound.has(id)) bad.push(`catalog ${id}: bindings 缺列`);
  }

  for (const id of bound) {
    if (!catalog.includes(id)) bad.push(`binding ${id}: 不在 active 里程碑 catalog`);
  }

  return { ok: true, catalog: catalog.length, bindings: rows.length, bad };
}

/** route 頁用 route；layer／dialog／menu 用 hostRoute（GAP-124）。 */
export function routesFromScreens(screens: ScreenRow[]): string[] {
  return [
    ...new Set(
      screens.map((s) => (!s.kind || s.kind === 'route' ? s.route : (s.hostRoute ?? s.route))),
    ),
  ];
}
