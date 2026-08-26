import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { backgroundUrl } from '../model';

/**
 * 縮圖格。**點一下就換**（ST 的行為：不需要再按「套用」）。
 *
 * 🔴 **縮圖用 `cover` 固定裁切，不跟著 fitting 走。**
 * 一開始想讓縮圖與大圖用同一組規則，但 `center`（原尺寸）在 96px 高的格子裡
 * 會變成一小塊裁切，26 張看起來全都一樣 —— 縮圖的工作是「認得出是哪張」，
 * 不是「預覽最終效果」。
 *
 * 🔴 **刪除鈕永遠顯示，不藏在 hover 底下。** 這個 app 手機用得比桌機多，
 * 手機沒有 hover —— 藏在 hover 裡等於在手機上不存在。
 *
 * 🔴 **每一格都要有邊框**（Peter 2026-08-26 實機指出）。
 * ST 內建的 23 張裡有三張是純色佔位圖 —— `__transparent.png`、`_white.jpg`、`_black.jpg`。
 * 沒有邊框的話，透明與白色那兩格在淺色主題下**看起來就是空的**，
 * 使用者分不出「這是一張白色的圖」還是「這張圖破了」。
 */
export function BackgroundGrid({
  items,
  current,
  onPick,
  onDelete,
}: {
  items: string[];
  /** 現在生效的那張（對話層有值就是對話層的）。 */
  current?: string | undefined;
  onPick: (name: string) => void;
  /** 沒給就不顯示刪除鈕（例：對話分頁只是選，不管理檔案）。 */
  onDelete?: ((name: string) => void) | undefined;
}) {
  if (items.length === 0)
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        還沒有任何背景。用右上角的「上傳」加一張。
      </Typography>
    );

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
      {items.map((name) => (
        <Box key={name} sx={{ position: 'relative' }}>
          <ButtonBase
            onClick={() => onPick(name)}
            aria-label={name}
            aria-pressed={name === current}
            sx={{
              width: '100%',
              aspectRatio: '16 / 10',
              borderRadius: 1,
              overflow: 'hidden',
              display: 'block',
              backgroundImage: `url("${backgroundUrl(name)}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              // 🔴 邊框永遠在，選中時再加一圈 `outline` —— 兩者是不同的圈，不會互相取代。
              border: 1,
              borderColor: 'divider',
              // 選中的那張用外框標示 —— 疊一層半透明遮罩會讓它看起來比較暗，方向相反。
              outline: name === current ? 2 : 0,
              outlineStyle: 'solid',
              outlineColor: 'primary.main',
              outlineOffset: -2,
            }}
          />
          {name === current ? (
            <CheckCircleIcon
              color="primary"
              fontSize="small"
              sx={{ position: 'absolute', top: 4, left: 4, pointerEvents: 'none' }}
            />
          ) : null}
          {onDelete ? (
            <IconButton
              size="small"
              aria-label={`刪除 ${name}`}
              onClick={() => onDelete(name)}
              sx={{ position: 'absolute', top: 0, right: 0 }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
