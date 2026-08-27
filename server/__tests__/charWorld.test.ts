import { describe, expect, it } from 'vitest';
import { readCard } from '../lib/card.ts';
import { cardIdentity, contentHash, driftFromOrigin, setEntryEnabled, worldFromCard } from '../lib/charWorld.ts';
import { isPrivateAddress } from '../adapters/fetchCard.ts';
import { encodePayload } from '../lib/card.ts';
import { makeText, writeChunks } from '../lib/png.ts';

function cardPng(payload: unknown): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return writeChunks([
    { type: 'IHDR', data: ihdr },
    makeText('ccv3', encodePayload(payload)),
    { type: 'IDAT', data: Buffer.from([1]) },
    { type: 'IEND', data: Buffer.alloc(0) },
  ]);
}

const payload = {
  create_date: '2026-01-01',
  data: {
    name: '某',
    character_version: '1.2',
    character_book: {
      entries: [
        { id: 0, comment: '甲條', content: '甲的內容', enabled: true },
        { id: 1, comment: '乙條', content: '乙的內容', enabled: false },
      ],
    },
  },
};
const card = readCard(cardPng(payload));

describe('D-f 每個好友一份世界書副本', () => {
  it('從卡片複製出條目', () => {
    const w = worldFromCard(card, 'char-1', '2026-08-25T00:00:00Z');
    expect(w.entries.map((e) => e.uid)).toEqual(['0', '1']);
    expect(w.characterId).toBe('char-1');
  });

  it('🔴 兩份副本互不影響（D-e 允許同一張卡加入多次）', () => {
    const a = worldFromCard(card, 'A', 'now');
    const b = worldFromCard(card, 'B', 'now');
    const a2 = setEntryEnabled(a, '1', true);
    expect(a2.entries.find((e) => e.uid === '1')?.enabled).toBe(true);
    expect(b.entries.find((e) => e.uid === '1')?.enabled).toBe(false);
  });

  it('🔴 改開關不動原本的物件（原始那份要能原樣匯出）', () => {
    const a = worldFromCard(card, 'A', 'now');
    setEntryEnabled(a, '0', false);
    expect(a.entries.find((e) => e.uid === '0')?.enabled).toBe(true);
  });
});

describe('出廠快照', () => {
  const w = worldFromCard(card, 'A', '2026-08-25T00:00:00Z');

  it('記得每條的出廠開關', () => {
    expect(w.origin.entries['0']).toMatchObject({ enabled: true });
    expect(w.origin.entries['1']).toMatchObject({ enabled: false });
  });

  it('🔴 一定要連 comment 與內容雜湊一起存 —— uid 只是陣列索引，會位移', () => {
    expect(w.origin.entries['0']?.comment).toBe('甲條');
    expect(w.origin.entries['0']?.contentHash).toBe(contentHash('甲的內容'));
  });

  it('內容雜湊會正規化空白（作者重排版面不該看起來像換了內容）', () => {
    expect(contentHash('甲 的\n內容')).toBe(contentHash('甲   的 內容'));
    expect(contentHash('甲')).not.toBe(contentHash('乙'));
  });

  it('🔴 使用者改過之後，快照仍停在出廠值', () => {
    const after = setEntryEnabled(w, '0', false);
    expect(after.origin.entries['0']?.enabled).toBe(true);
    expect(driftFromOrigin(after)).toEqual([{ uid: '0', factory: true, now: false }]);
  });

  it('沒改過就沒有 drift', () => {
    expect(driftFromOrigin(w)).toEqual([]);
  });

  it('卡片版本識別用內容雜湊，不是作者手寫的版本字串', () => {
    const id = cardIdentity(card);
    expect(id.cardVersion).toBe('1.2');
    expect(id.cardId).toHaveLength(16);
    const other = cardIdentity(readCard(cardPng({ ...payload, data: { ...payload.data, name: '改過' } })));
    expect(other.cardId).not.toBe(id.cardId);
  });
});

describe('匯入網址的 SSRF 護欄', () => {
  it('🔴 內網／回送／metadata 位址一律擋掉', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '0.0.0.0', '::1'])
      expect(isPrivateAddress(ip)).toBe(true);
  });

  it('🔴 IPv4-mapped 的 IPv6 要拆出來判，不然整個檢查被繞過', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('公開位址放行', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2606:4700::1111')).toBe(false);
  });

  it('看不懂的字串當成不安全（預設拒絕）', () => {
    expect(isPrivateAddress('不是位址')).toBe(true);
  });
});
