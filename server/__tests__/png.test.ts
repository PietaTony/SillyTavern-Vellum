import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { NotAPng, readChunks, replaceText, textKeywords, textOf, writeChunks, makeText, crc32 } from '../lib/png.ts';

/** 合成一張最小 PNG。🔴 **不用真卡當測試素材**——那是私人資料，而且 repo 是公開的。 */
function fakePng(extra: { keyword: string; text: string }[] = []): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return writeChunks([
    { type: 'IHDR', data: ihdr },
    ...extra.map((e) => makeText(e.keyword, e.text)),
    { type: 'IDAT', data: Buffer.from([1, 2, 3, 4]) },
    { type: 'IEND', data: Buffer.alloc(0) },
  ]);
}

/** `zTXt`：keyword \0 method(1) 壓縮內容 */
const zText = (keyword: string, text: string) => ({
  type: 'zTXt',
  data: Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0, 0]), deflateSync(Buffer.from(text, 'latin1'))]),
});

/** `iTXt`：keyword \0 flag method lang \0 translated \0 內容 */
const iText = (keyword: string, text: string, compressed = false) => ({
  type: 'iTXt',
  data: Buffer.concat([
    Buffer.from(keyword, 'latin1'),
    Buffer.from([0, compressed ? 1 : 0, 0]),
    Buffer.from([0]),
    Buffer.from([0]),
    compressed ? deflateSync(Buffer.from(text, 'latin1')) : Buffer.from(text, 'latin1'),
  ]),
});

describe('png chunk 層', () => {
  it('🔴 zTXt（壓縮的）也要讀得到 —— 只讀 tEXt 會把「我們讀不到」講成「這張圖沒有卡片」', () => {
    const chunks = readChunks(
      writeChunks([...readChunks(fakePng()).slice(0, 1), zText('chara', 'aGk='), ...readChunks(fakePng()).slice(1)]),
    );
    expect(textOf(chunks, 'chara')).toBe('aGk=');
  });

  it('🔴 iTXt 兩種形式（壓縮與未壓縮）都要讀得到', () => {
    const build = (c: { type: string; data: Buffer }) =>
      readChunks(writeChunks([...readChunks(fakePng()).slice(0, 1), c, ...readChunks(fakePng()).slice(1)]));
    expect(textOf(build(iText('ccv3', 'AAA')), 'ccv3')).toBe('AAA');
    expect(textOf(build(iText('ccv3', 'BBB', true)), 'ccv3')).toBe('BBB');
  });

  it('🔴 keyword 比對不分大小寫（野生的卡有寫成 Chara 的）', () => {
    const chunks = readChunks(fakePng([{ keyword: 'Chara', text: 'XYZ' }]));
    expect(textOf(chunks, 'chara')).toBe('XYZ');
  });

  it('列得出圖裡有哪些文字欄位（匯入失敗時要能告訴使用者我看到什麼）', () => {
    const chunks = readChunks(fakePng([{ keyword: 'Software', text: 'Photoshop' }]));
    expect(textKeywords(chunks)).toContain('Software');
  });

  it('壞掉的壓縮內容回 null，不可以讓整張圖讀不進來', () => {
    const bad = { type: 'zTXt', data: Buffer.concat([Buffer.from('chara'), Buffer.from([0, 0]), Buffer.from('不是zlib')]) };
    const chunks = readChunks(writeChunks([...readChunks(fakePng()).slice(0, 1), bad, ...readChunks(fakePng()).slice(1)]));
    expect(textOf(chunks, 'chara')).toBeNull();
  });
  it('讀回來的 chunk 順序與內容與寫進去的一致', () => {
    const chunks = readChunks(fakePng([{ keyword: 'chara', text: 'aGVsbG8=' }]));
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'tEXt', 'IDAT', 'IEND']);
    expect(textOf(chunks, 'chara')).toBe('aGVsbG8=');
  });

  it('不是 PNG 就丟 NotAPng，不是靜靜回空陣列', () => {
    expect(() => readChunks(Buffer.from('這不是圖'))).toThrow(NotAPng);
  });

  it('chunk 長度超出檔案要被抓到（截斷的檔）', () => {
    const png = fakePng();
    expect(() => readChunks(png.subarray(0, png.length - 6))).toThrow(NotAPng);
  });

  it('🔴 換掉 tEXt 之後，其他 chunk 的 byte 完全不變', () => {
    const before = readChunks(fakePng([{ keyword: 'chara', text: 'AAA' }]));
    const after = readChunks(writeChunks(replaceText(before, 'chara', 'BBB')));
    expect(textOf(after, 'chara')).toBe('BBB');
    for (const type of ['IHDR', 'IDAT', 'IEND']) {
      const a = before.find((c) => c.type === type)!.data;
      const b = after.find((c) => c.type === type)!.data;
      expect(b.equals(a)).toBe(true);
    }
  });

  it('🔴 不認得的私有 chunk 要原樣留著，不可以被丟掉', () => {
    const png = writeChunks([
      ...readChunks(fakePng()).slice(0, 1),
      { type: 'prVt', data: Buffer.from('私有資料') },
      ...readChunks(fakePng()).slice(1),
    ]);
    const after = readChunks(writeChunks(replaceText(readChunks(png), 'ccv3', 'X')));
    const priv = after.find((c) => c.type === 'prVt');
    expect(priv?.data.toString()).toBe('私有資料');
  });

  it('原本沒有該 keyword 時新增，且插在 IEND 之前', () => {
    const after = replaceText(readChunks(fakePng()), 'ccv3', 'X');
    expect(after.at(-1)?.type).toBe('IEND');
    expect(textOf(after, 'ccv3')).toBe('X');
  });

  it('CRC 壞掉的檔照樣讀得進來（野生卡經常如此），寫回時被修好', () => {
    const png = fakePng([{ keyword: 'chara', text: 'AAA' }]);
    png.writeUInt32BE(0xdeadbeef, png.length - 4); // 弄壞 IEND 的 CRC
    const chunks = readChunks(png);
    const fixed = writeChunks(chunks);
    const typed = Buffer.concat([Buffer.from('IEND', 'latin1'), Buffer.alloc(0)]);
    expect(fixed.readUInt32BE(fixed.length - 4)).toBe(crc32(typed));
  });
});
