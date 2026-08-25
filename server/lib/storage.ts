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

export const dataRoot = (): string => ROOT;

/**
 * 啟動時報告資料在哪、有多少 —— **讓「資料不見了」立刻被看見，而不是幾天後才發現**。
 *
 * 🔴 這是 Docker 最容易踩的坑：忘記掛 volume 的話，每次重建容器都是全新的空目錄，
 * 而 app 會一如往常地啟動、顯示「還沒有好友」，看起來像正常的空狀態而不是災難。
 * 有這一行，重啟後看到「角色 0」就知道 volume 沒掛上。
 */
export async function describeData(): Promise<string> {
  const count = async (dir: string): Promise<number> => {
    try {
      return (await readdir(pathFor(dir))).filter((f) => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  };
  const [chars, chats] = [await count('characters'), await count('chats')];
  const key = existsSync(pathFor('secrets.json')) ? '已設定' : '未設定';
  return `資料目錄 ${ROOT} —— 角色 ${chars}、對話 ${chats}、金鑰 ${key}`;
}

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
