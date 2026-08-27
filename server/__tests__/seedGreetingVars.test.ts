import { describe, expect, it } from 'vitest';
import { seedStateFrom } from '../services/seedGreetingVars.ts';

/**
 * 開場白帶的 `<UpdateVariable>` 要變成這段對話的起始 `stat_data`。
 *
 * 🔴 **這支守的是「有沒有接上」，不是「會不會爆」**：在此之前這條路一個呼叫端都沒有，
 * 而症狀是桌寵面板三個數字全 `—`、`時期` 掉回卡片自己的 fallback——**完全沒有錯誤訊息**。
 */
const CARD = {
  data: {
    character_book: {
      entries: [
        {
          comment: '[initvar]變量初始化勿開',
          // 形狀照真卡抄的（成年線的初值）。
          content: '# [initvar]變量初始化勿開\n時期: 成年\n安全感: 15\n面具: 85\n親密度: 20',
        },
      ],
    },
  },
};

/** 真卡 `greetings[7]`（童年線）的更新區塊，一字不改。 */
const 童年開場 = `他把膝蓋收攏，給你騰出了一小塊可以蹲下來的空間。

<思年>
時期：童年
安全感：10
面具：60
親密度：0
階段：警戒
</思年>

<UpdateVariable>
<JSONPatch>
[
  { "op": "replace", "path": "/時期", "value": "童年" },
  { "op": "replace", "path": "/安全感", "value": 10 },
  { "op": "replace", "path": "/面具", "value": 60 },
  { "op": "replace", "path": "/親密度", "value": 0 }
]
</JSONPatch>
</UpdateVariable>`;

describe('開場白的起始變數', () => {
  it('四個值都套得進去', () => {
    const s = seedStateFrom(CARD, 童年開場);
    expect(s?.安全感).toBe(10);
    expect(s?.面具).toBe(60);
    expect(s?.親密度).toBe(0);
  });

  it('🔴 `時期` 在這條路上寫得進去 —— 「開場白設定後凍結」，而這就是設定的那一刻', () => {
    expect(seedStateFrom(CARD, 童年開場)?.時期).toBe('童年');
  });

  it('🔴 ±3 不夾 —— 開場白本來就會一次把數值設到位（親密度 20→0）', () => {
    // 夾到的話會是 17，那正是「選了童年線卻拿成年線數值開局」的指紋。
    expect(seedStateFrom(CARD, 童年開場)?.親密度).toBe(0);
  });

  it('`階段` 要一起存 —— 卡片讀的 `stat_data` 少一個鍵就顯示不出關係', () => {
    expect(seedStateFrom(CARD, 童年開場)?.階段).toBe('警戒');
  });

  it('沒宣告過的變數照樣丟掉 —— 開場白也不能憑空長出狀態', () => {
    const 亂寫 = '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/金錢","value":999}]</JSONPatch></UpdateVariable>';
    expect(seedStateFrom(CARD, 亂寫)).toEqual({ 時期: '成年', 安全感: 15, 面具: 85, 親密度: 20, 階段: '接近' });
  });

  it('開場白沒帶更新區塊就回 null —— 那不是錯誤（九則裡有一則就是這樣）', () => {
    expect(seedStateFrom(CARD, '他站在門口，什麼也沒說。')).toBeNull();
  });

  it('卡片沒有變數也回 null —— 「這張卡沒有這個功能」', () => {
    expect(seedStateFrom({ data: { character_book: { entries: [] } } }, 童年開場)).toBeNull();
  });

  it('🔴 基準是卡片初值 —— 換開場＝換一條時間線，不沿用上一條線的數值', () => {
    const 只改親密度 =
      '<UpdateVariable><JSONPatch>[{"op":"replace","path":"/親密度","value":5}]</JSONPatch></UpdateVariable>';
    const s = seedStateFrom(CARD, 只改親密度);
    expect(s).toEqual({ 時期: '成年', 安全感: 15, 面具: 85, 親密度: 5, 階段: '接近' });
  });
});
