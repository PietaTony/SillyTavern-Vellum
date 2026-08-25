import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { LAYER_LABEL, type Persona, type PersonaLayer } from '../api';

/**
 * 對話內切換「我是誰」。**ST 沒有這個 UI**（只有面板與 slash command），這是我們新增的。
 *
 * 🔴 **兩件事一定要做到**：
 *   ① 看得出**現在生效的是哪一層**（C4）——不然使用者改了全域卻沒反應，只會覺得壞了
 *   ② 一定要有「**跟隨預設**」（C5）——沒有它，對話一旦設過就永遠與上層脫鉤，再也回不去
 */
export function PersonaSwitcher({
  current,
  layer,
  personas,
  onPick,
}: {
  current: { id?: string | undefined; name?: string | undefined } | null;
  layer: PersonaLayer;
  personas: Persona[];
  /** `null` ＝ 跟隨預設（把這段對話的設定清掉）。 */
  onPick: (personaId: string | null) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const label = current?.name ?? '你';

  return (
    <>
      <Button size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        我是 {label}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {/* 🔴 先講清楚現在這個是哪一層來的 */}
        <MenuItem disabled>
          <ListItemText
            primary={`目前：${label}`}
            secondary={`來自「${LAYER_LABEL[layer]}」${layer === 'chat' ? '（蓋過全域設定）' : ''}`}
          />
        </MenuItem>
        <Divider />
        <MenuItem
          selected={layer !== 'chat'}
          onClick={() => {
            onPick(null);
            close();
          }}
        >
          <ListItemText primary="跟隨預設" secondary="清掉這段對話的設定，改用好友或全域的" />
        </MenuItem>
        {personas.map((p) => (
          <MenuItem
            key={p.id}
            selected={layer === 'chat' && current?.id === p.id}
            onClick={() => {
              onPick(p.id);
              close();
            }}
          >
            <ListItemText primary={p.name} secondary={p.title || undefined} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
