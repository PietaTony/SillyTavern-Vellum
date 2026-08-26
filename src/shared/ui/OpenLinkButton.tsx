import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Button from '@mui/material/Button';

/**
 * 「開啟」外連鈕。**全站只有這一顆長相**。
 *
 * 🔴 抽出來的理由是實際發生過的分岔：這顆鈕原本是 `KeySteps` 裡的私有函式，
 * 而錯誤訊息的引導另外做了一顆寫著「去儲值」的按鈕 ——
 * 同一個動作（開一個外部網址）在兩個地方長得不一樣、講法也不一樣。
 * Peter 2026-08-26：「不要有去儲值的字樣，改成開啟的連結，
 * 像是設定頁『開啟 console.anthropic.com/settings/keys』旁邊 btn 一樣」。
 */
export function OpenLinkButton({
  url,
  /** 在深色底（例如 filled 的 tips）上要用 `inherit`，否則看不見。 */
  color,
}: {
  url: string;
  color?: 'inherit';
}) {
  return (
    <Button
      size="small"
      variant="outlined"
      endIcon={<OpenInNewIcon />}
      href={url}
      target="_blank"
      rel="noreferrer"
      sx={{ flex: 'none' }}
      {...(color ? { color } : {})}
    >
      開啟
    </Button>
  );
}
