/**
 * 桌寵那個 frame 要裁成什麼形狀。
 *
 * 🔴 **`clip-path` 裁掉的區域連命中測試都不存在** ⇒ 底下的卡片按鈕直接收得到點擊。
 * ⚠️ 上一版是問答式的（丟座標進去問有沒有命中），Peter 實機打回
 *    「小卡的所有按鈕都超難按」—— 那是非同步來回，切換永遠慢一步。
 *
 * 🔴 **空字串 ＝ 這個 frame 目前什麼都沒畫** ⇒ `inset(100%)` 全部裁掉。
 * 形狀不對也走同一條：寧可整片不可點，也不要讓一個看不見的 frame 吃掉半個畫面的點擊。
 *
 * （從 `ScriptFrame.tsx` 抽出來的：那支撞到 150 行，而這段跟「畫一個 iframe」無關。）
 */
export function clipFrom(box: string): string {
  const p = box.split(',').map(Number);
  const [l, t, r, b] = p;
  if (p.length !== 4 || l === undefined || t === undefined || r === undefined || b === undefined)
    return 'inset(100%)';
  if (p.some((n) => !Number.isFinite(n))) return 'inset(100%)';
  return `inset(${t}px ${window.innerWidth - r}px ${window.innerHeight - b}px ${l}px)`;
}
