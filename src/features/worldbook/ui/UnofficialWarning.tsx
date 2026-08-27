import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Typography from '@mui/material/Typography';

/**
 * `/worlds` **最上面**那則警告（Peter 2026-08-27 指名要「大字」）。
 *
 * 🔴 **要大字，不是一行小灰字。** 這一頁下面已經有一整塊機制說明（`GlobalWorldIntro`），
 * 警告若用同樣的字級擺在旁邊，就會被當成「又一段說明」讀過去 ——
 * 而它要講的不是「怎麼用」，是**先不要用**。字級不同才分得出這是兩件事。
 *
 * 🔴 **警告在說明的上面。** 「這功能可能不該用」必須早於「這功能怎麼用」，
 * 不然使用者是照著說明設定完之後才讀到警告。
 */
export function UnofficialWarning() {
  return (
    <Alert severity="warning" variant="outlined" icon={<WarningAmberIcon fontSize="large" />}>
      <AlertTitle sx={{ typography: 'h6' }}>這個功能建議暫時不要使用</AlertTitle>
      <Typography variant="body1">
        全域世界書是<b>藏在 SillyTavern 程式碼裡</b>的功能 —— 官方從來沒有正式提及過它，
        也就沒有任何一份說明擔保它該怎麼運作。
      </Typography>
    </Alert>
  );
}
