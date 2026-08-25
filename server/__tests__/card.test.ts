import { describe, expect, it } from 'vitest';
import { NotACard, encodePayload, readCard, embedCard, viewOf } from '../lib/card.ts';
import { makeText, writeChunks, readChunks, textOf } from '../lib/png.ts';

/** 合成卡片。🔴 真卡是私人資料且 repo 公開，測試素材一律自己造。 */
/** 直接組 `tEXt` chunk —— 野生卡會塞 UTF-8 原文，那是 `makeText`（latin1）表達不出來的。 */
function rawText(keyword: string, utf8: string) {
  return {
    type: 'tEXt',
    data: Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(utf8, 'utf8')]),
  };
}

function cardPng(payloads: Record<string, unknown>, raw?: Record<string, string>): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return writeChunks([
    { type: 'IHDR', data: ihdr },
    ...Object.entries(payloads).map(([k, v]) => makeText(k, encodePayload(v))),
    ...Object.entries(raw ?? {}).map(([k, v]) => rawText(k, v)),
    { type: 'IDAT', data: Buffer.from([9, 9, 9]) },
    { type: 'IEND', data: Buffer.alloc(0) },
  ]);
}

const v3 = {
  spec: 'chara_card_v3',
  spec_version: '3.0',
  name: '何某',
  data: {
    name: '何某',
    description: '描述',
    first_mes: '你好',
    alternate_greetings: ['A', 'B'],
    extensions: { 我們不認得的欄位: { 巢狀: [1, 2, 3] }, world: '某世界書' },
  },
};

describe('角色卡解析', () => {
  it('讀 v3：ccv3 優先於 chara', () => {
    const card = readCard(cardPng({ chara: { name: '舊' }, ccv3: v3 }));
    expect(card.primary).toBe('ccv3');
    expect(Object.keys(card.payloads).sort()).toEqual(['ccv3', 'chara']);
  });

  it('只有 chara 時回退到 chara', () => {
    expect(readCard(cardPng({ chara: v3 })).primary).toBe('chara');
  });

  it('沒有卡片資料的 PNG 要丟 NotACard，不是回空卡', () => {
    expect(() => readCard(cardPng({}))).toThrow(NotACard);
  });

  it('payload 不是 base64 JSON 也不是 JSON 時要丟例外，不可靜默當成空卡', () => {
    expect(() => readCard(cardPng({}, { ccv3: '這不是 JSON' }))).toThrow(NotACard);
  });

  it('沒包 base64、直接塞 JSON 的野生卡也讀得進來', () => {
    const png = cardPng({}, { ccv3: JSON.stringify(v3) });
    expect(viewOf(readCard(png)).name).toBe('何某');
  });

  it('🔴 A1：匯入→匯出，不認得的欄位一字不差地留著', () => {
    const card = readCard(cardPng({ chara: v3, ccv3: v3 }));
    const out = readCard(embedCard(cardPng({ chara: v3, ccv3: v3 }), card));
    expect(out.payloads['ccv3']).toEqual(v3);
    expect(out.payloads['chara']).toEqual(v3);
  });

  it('🔴 A1：兩份 payload 不同時，各自寫回各自的，不可以互相覆蓋', () => {
    const chara = { name: 'v2 的名字', description: '只有 v2 有' };
    const card = readCard(cardPng({ chara, ccv3: v3 }));
    const out = readCard(embedCard(cardPng({ chara, ccv3: v3 }), card));
    expect(out.payloads['chara']).toEqual(chara);
    expect(out.payloads['ccv3']).toEqual(v3);
  });

  it('🔴 A1：匯出不會動到圖片與其他 chunk', () => {
    const png = cardPng({ ccv3: v3 });
    const out = embedCard(png, readCard(png));
    const idatBefore = readChunks(png).find((c) => c.type === 'IDAT')!.data;
    const idatAfter = readChunks(out).find((c) => c.type === 'IDAT')!.data;
    expect(idatAfter.equals(idatBefore)).toBe(true);
    expect(textOf(readChunks(out), 'ccv3')).not.toBeNull();
  });

  it('viewOf 讀 v3 的 data 底下', () => {
    const v = viewOf(readCard(cardPng({ ccv3: v3 })));
    expect(v).toEqual({ name: '何某', description: '描述', firstMessage: '你好', alternateGreetings: ['A', 'B'] });
  });

  it('viewOf 讀 v2 的 top-level（沒有 data 的舊卡）', () => {
    const v2 = { name: '舊卡', description: '舊描述', first_mes: '嗨' };
    expect(viewOf(readCard(cardPng({ chara: v2 })))).toEqual({
      name: '舊卡',
      description: '舊描述',
      firstMessage: '嗨',
      alternateGreetings: [],
    });
  });
});
