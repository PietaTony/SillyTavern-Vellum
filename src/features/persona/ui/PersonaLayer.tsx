import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { FullScreenLayer } from '@/shared/ui/FullScreenLayer';
import { LAYER_LABEL, type PersonaLayer as Layer, type Persona } from '../api';

/**
 * 對話內切換「我是誰」。**ST 沒有這個 UI**（只有面板與 slash command），這是我們新增的。
 *
 * 🔴 **兩件事一定要做到**：
 *   ① 看得出**現在生效的是哪一層**（C4）——不然使用者改了全域卻沒反應，只會覺得壞了
 *   ② 一定要有「**跟隨預設**」（C5）——沒有它，對話一旦設過就永遠與上層脫鉤，再也回不去
 *
 * 🔴 **2026-08-26 Peter 裁定「我是 Peter 收進 ☰」** ⇒ 這一支從
 * `PersonaSwitcher`（Button ＋ Menu）改成全螢層。
 * **不是換個樣子而已**：它現在住在 ☰ 的 `Menu` 裡面，
 * 而 `Menu` 裡再開一個 `Menu` 會疊在同一個座標上、關閉時關錯層。
 * ⇒ 與「背景」「AI 供應商與金鑰」同一種形狀，三項一致。
 */
export function PersonaLayer({
  open,
  onClose,
  current,
  layer,
  personas,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  current: { id?: string | undefined; name?: string | undefined } | null;
  layer: Layer;
  personas: Persona[];
  /** `null` ＝ 跟隨預設（把這段對話的設定清掉）。 */
  onPick: (personaId: string | null) => void;
}) {
  const label = current?.name ?? '你';
  const pick = (id: string | null) => {
    onPick(id);
    onClose();
  };

  return (
    <FullScreenLayer open={open} title="我是誰" onClose={onClose}>
      {/* 🔴 先講清楚現在這個是哪一層來的 */}
      <Alert severity="info" icon={false} sx={{ mb: 2 }}>
        目前是 <b>{label}</b>，來自「{LAYER_LABEL[layer]}」
        {layer === 'chat' ? '（蓋過全域設定）' : ''}
      </Alert>
      <List disablePadding>
        <ListItemButton selected={layer !== 'chat'} onClick={() => pick(null)}>
          <ListItemText primary="跟隨預設" secondary="清掉這段對話的設定，改用好友或全域的" />
        </ListItemButton>
        <Divider component="li" />
        {personas.map((p) => (
          <ListItemButton
            key={p.id}
            selected={layer === 'chat' && current?.id === p.id}
            onClick={() => pick(p.id)}
          >
            <ListItemText primary={p.name} secondary={p.title || undefined} />
          </ListItemButton>
        ))}
      </List>
    </FullScreenLayer>
  );
}
