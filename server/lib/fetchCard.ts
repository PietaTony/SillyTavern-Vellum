/**
 * 從網址抓一張角色卡。
 *
 * 🔴 **這是 SSRF 的入口**：使用者貼什麼網址，後端就去打什麼。沒有護欄的話，
 * 貼 `http://127.0.0.1:8521/api/secrets` 就是叫我們自己把金鑰抓回來給自己看
 * ——更糟的是貼內網位址，讓這台機器變成掃描別人內網的跳板。
 * ⇒ **解析出 IP 之後再判斷**，不是只看網址字串（字串可以用 DNS 指到內網）。
 *
 * 這條路徑的四道限制：只允許 http/https｜IP 不可以是私有／回送／link-local｜
 * 最多跟 3 次轉址（每一跳都重驗）｜大小上限。
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class BadCardUrl extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'BadCardUrl';
  }
}

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_HOPS = 3;

/** 私有／回送／link-local／保留位址。**這些一律不准連。** */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true;
    // IPv4-mapped（::ffff:127.0.0.1）要拆出來再判，不然會整個繞過檢查。
    const m = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    return m ? isPrivateAddress(m[1] ?? '') : false;
  }
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a = 0, b = 0] = p;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // cloud metadata 也在這一段
  if (a >= 224) return true;
  return false;
}

async function assertPublic(host: string): Promise<void> {
  const ip = isIP(host) ? host : (await lookup(host)).address;
  if (isPrivateAddress(ip)) throw new BadCardUrl(`不允許連到內網位址（${host}）`);
}

/** 抓回來的原始 bytes。**不解析、不判斷是不是卡片**——那是 `readCard` 的事。 */
export async function fetchCardBytes(rawUrl: string): Promise<{ bytes: Buffer; finalUrl: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadCardUrl('這不是一個網址');
  }

  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BadCardUrl('只支援 http／https');
    await assertPublic(url.hostname);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) throw new BadCardUrl(`對方回 ${res.status} 但沒給轉址目的地`);
      // 🔴 **每一跳都要重驗** —— 只驗第一個網址的話，對方一個轉址就把我們帶進內網。
      url = new URL(next, url);
      continue;
    }
    if (!res.ok) throw new BadCardUrl(`抓不到（HTTP ${res.status}）`);
    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) throw new BadCardUrl(`檔案太大（${len} bytes）`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new BadCardUrl(`檔案太大（${bytes.length} bytes）`);
    return { bytes, finalUrl: url.toString() };
  }
  throw new BadCardUrl('轉址太多次');
}
