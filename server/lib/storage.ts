/**
 * 檔案系統儲存層。M2 只需要三種東西：金鑰、角色、對話。
 *
 * 為什麼是檔案不是 DB：ST 用檔案系統，而「匯入匯出保真」是我們的契約之一。
 * 走同一種形狀，之後對接 ST 的 data 目錄時不必再轉一層。
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.env['VELLUM_DATA'] ?? join(process.cwd(), 'data');

export const pathFor = (...parts: string[]): string => join(ROOT, ...parts);

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

export async function readJson<T>(rel: string, fallback: T): Promise<T> {
  const file = pathFor(rel);
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

export async function writeJson(rel: string, value: unknown): Promise<void> {
  const file = pathFor(rel);
  await ensureDir(file);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function listJson<T>(relDir: string): Promise<T[]> {
  const dir = pathFor(relDir);
  if (!existsSync(dir)) return [];
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json'));
  const out: T[] = [];
  for (const n of names) out.push(JSON.parse(await readFile(join(dir, n), 'utf8')) as T);
  return out;
}
