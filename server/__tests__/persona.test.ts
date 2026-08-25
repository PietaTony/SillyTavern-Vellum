import { describe, expect, it } from 'vitest';
import { displayOf, type Persona } from '../lib/persona.ts';
import { insertAtDepth, personaPieces } from '../lib/personaPrompt.ts';
import { resolvePersona } from '../lib/resolvePersona.ts';

const p = (id: string, o: Partial<Persona> = {}): Persona => ({
  id, name: id, avatar: '', description: '', position: 'in_prompt', depth: 4, role: 0,
  title: '', archived: false, createdAt: 'now', ...o,
});
const all = [p('chatP'), p('friendP'), p('globalP')];

describe('三層優先序', () => {
  it('🔴 對話層最優先，命中就不再往下找', () => {
    const r = resolvePersona({ chatPersonaId: 'chatP', friendPersonaId: 'friendP', defaultPersonaId: 'globalP' }, all);
    expect([r.persona?.id, r.layer]).toEqual(['chatP', 'chat']);
  });

  it('清掉對話層 → 好友層', () => {
    const r = resolvePersona({ friendPersonaId: 'friendP', defaultPersonaId: 'globalP' }, all);
    expect([r.persona?.id, r.layer]).toEqual(['friendP', 'friend']);
  });

  it('再清 → 全域層', () => {
    expect(resolvePersona({ defaultPersonaId: 'globalP' }, all).layer).toBe('global');
  });

  it('全清 → 沒有 persona，名字回退成「你」（與現況一致，不弄壞既有對話）', () => {
    const r = resolvePersona({}, all);
    expect(r.layer).toBe('none');
    expect(displayOf(r.persona)).toBe('你');
  });

  it('群組層排在好友層之後、全域層之前（群組聊天未做，位置先留）', () => {
    expect(resolvePersona({ groupPersonaId: 'friendP', defaultPersonaId: 'globalP' }, all).layer).toBe('group');
  });

  it('🔴 指到不存在的 persona 不往下找 —— 靜靜回退會把壞掉的資料藏起來', () => {
    const r = resolvePersona({ chatPersonaId: '不存在', defaultPersonaId: 'globalP' }, all);
    expect(r.persona).toBeNull();
    expect(r.layer).toBe('chat');
  });
});

describe('description 進 prompt 的位置', () => {
  it('in_prompt → system', () => {
    expect(personaPieces(p('a', { description: '我是醫生' })).system).toEqual(['我是醫生']);
  });

  it('🔴 none → 完全不進 prompt（明示的選擇）', () => {
    const r = personaPieces(p('a', { description: '我是醫生', position: 'none' }));
    expect(r.system).toEqual([]);
    expect(r.atDepth).toEqual([]);
  });

  it('at_depth → 帶著自己的 depth/role', () => {
    const r = personaPieces(p('a', { description: 'x', position: 'at_depth', depth: 2, role: 1 }));
    expect(r.atDepth).toEqual([{ depth: 2, role: 1, text: 'x' }]);
  });

  it('🔴 沒實作的位置退成 system，不是丟掉（丟掉會讓人以為自己填的沒作用）', () => {
    expect(personaPieces(p('a', { description: 'x', position: 'top_an' })).system).toEqual(['x']);
  });

  it('空白 description 不產生任何東西', () => {
    expect(personaPieces(p('a', { description: '   ' })).system).toEqual([]);
    expect(personaPieces(null).system).toEqual([]);
  });
});

describe('插入深度', () => {
  const msgs = ['m1', 'm2', 'm3'];
  it('depth 從最新一則往回數', () => {
    expect(insertAtDepth(msgs, [{ depth: 1, text: 'X' }], (t) => t)).toEqual(['m1', 'm2', 'X', 'm3']);
    expect(insertAtDepth(msgs, [{ depth: 0, text: 'X' }], (t) => t)).toEqual(['m1', 'm2', 'm3', 'X']);
  });

  it('depth 超過長度就放最前面，不會炸', () => {
    expect(insertAtDepth(msgs, [{ depth: 99, text: 'X' }], (t) => t)).toEqual(['X', 'm1', 'm2', 'm3']);
  });

  it('🔴 同一個 depth：世界書(0) 排在 persona(1) 前面', () => {
    const out = insertAtDepth(
      msgs,
      [
        { depth: 1, text: 'persona', priority: 1 },
        { depth: 1, text: 'world', priority: 0 },
      ],
      (t) => t,
    );
    expect(out).toEqual(['m1', 'm2', 'world', 'persona', 'm3']);
  });

  it('不同 depth 各自就位', () => {
    const out = insertAtDepth(msgs, [{ depth: 0, text: 'A' }, { depth: 2, text: 'B' }], (t) => t);
    expect(out).toEqual(['m1', 'B', 'm2', 'm3', 'A']);
  });
});
