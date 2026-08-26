import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAddFriendFinish } from '@/app/screens/useAddFriendFinish';
import {
  ADD_FRIEND_DRAFT,
  AddFriendForm,
  AddFriendSubmit,
  type Draft,
  draftOfCard,
  emptyDraft,
  GreetingsSection,
  ImportCardBox,
  type ImportedCharacter,
  loadAddFriendDraft,
} from '@/features/characters';
import { clearDraftPrefix, writeDraft } from '@/shared/lib/draftStore';
import { Screen } from '@/shared/ui/Screen';

/**
 * 加入好友的版面。🔴 **同一張畫面掛在兩個 route 上**：
 *   `/first-run/add-friend` —— 首次啟動流程裡的第三步
 *   `/add-friend`           —— 設定完成之後從列表進來
 * 內容完全相同，**差別只有從哪裡來**。
 *
 * 🔴 草稿住在這一層：送出鈕在固定 footer、表單在捲動區，兩邊要看同一份值。
 * 草稿存進 localStorage —— iOS 把背景分頁重載之後，打過的字要還在。
 */
export function AddFriendScreen({ onBack }: { onBack: () => void }) {
  const qc = useQueryClient();
  // 🔴 還原（含舊 key 的一次性搬遷）在 initializer **同步**做完，不在 effect 裡：
  // 三個 `DraftField` 若各自在 mount effect 裡還原，看到的是同一份 `draft`，
  // **第二個會蓋掉第一個**。同步初始化沒有這個競態。
  const [draft, setDraftState] = useState<Draft>(loadAddFriendDraft);

  /**
   * 三個文字欄由 `DraftField` 自己存；**頭像不是文字輸入**，閘門管不到它，
   * 所以在這裡明寫一次。存的是縮圖過的 data URL。
   */
  const setDraft = (d: Draft) => {
    setDraftState(d);
    if (d.avatar) writeDraft(`${ADD_FRIEND_DRAFT}avatar`, d.avatar);
    /*
     * 🔴 **額外問候語整個陣列存成一筆。**
     * 逐則存（`…greetings.0`、`.1`…）在**排序或刪除之後會還原成錯的那一則** ——
     * 那個 key 指向的內容已經換人了。閘門 `gate:draft` 管不到陣列，這裡明寫。
     */
    writeDraft(`${ADD_FRIEND_DRAFT}greetings`, d.greetings);
  };
  const clearAllDrafts = () => clearDraftPrefix(ADD_FRIEND_DRAFT);
  /** 剛匯入的那一位。有值時這一頁的意義從「建立」變成「確認並開始」。 */
  const [imported, setImported] = useState<ImportedCharacter | null>(null);

  const fillFromCard = (c: ImportedCharacter) => setDraft(draftOfCard(c));

  const { create, finishImported, saveGreetings } = useAddFriendFinish(() => {
    clearAllDrafts();
    setDraftState(emptyDraft);
  });
  const busy = create.isPending || finishImported.isPending;
  const failed = create.error ?? finishImported.error;

  return (
    <Screen
      title="加入好友"
      onBack={onBack}
      footer={
        <AddFriendSubmit
          draft={draft}
          busy={busy}
          imported={imported !== null}
          onCreate={() =>
            imported ? finishImported.mutate({ imported, draft }) : create.mutate(draft)
          }
        />
      }
    >
      {failed ? (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              onClick={() => {
                create.reset();
                finishImported.reset();
              }}
            >
              再試一次
            </Button>
          }
        >
          {/* 🔴 匯入那條路失敗＝**問候語沒存進去**，不是「建立失敗」。文案要分得出來。 */}
          {imported ? '存不回去' : '建立失敗'}：
          {failed instanceof Error ? failed.message : '未知錯誤'}
        </Alert>
      ) : null}
      {/* 🔴 匯入框放最上方（Peter 指定）：大多數人是「已經有卡」而不是「從零捏一個」。 */}
      {/*
       * 🔴 **匯入成功不跳走。** 跳走的話那句「已加入誰」永遠看不到，
       * 而且要連續匯入好幾張時每次都得再走回來。留在原頁，讓好友列表失效就好。
       */}
      <ImportCardBox
        onUseAsAvatar={(avatar) => setDraft({ ...draft, avatar })}
        /**
         * 🔴 **匯入成功不跳走，把資料填進下面既有的欄位**（Peter 2026-08-25）。
         * 那四個框本來就在，再做一張預覽卡等於同一份資料有兩個長相。
         */
        imported={imported}
        /*
         * 🔴 **重設要還原兩個地方，不是一個**（Peter 2026-08-26）。
         * 表單是一份、**已經 PATCH 回去的額外問候語是另一份** ——
         * 只還原表單的話，使用者看到「已經復原了」，但角色身上還是改過的版本。
         */
        onReset={() => {
          if (!imported) return;
          fillFromCard(imported);
          saveGreetings.mutate({ id: imported.id, draft: draftOfCard(imported) });
        }}
        onImported={(c) => {
          void qc.invalidateQueries({ queryKey: ['characters'] });
          setImported(c);
          fillFromCard(c);
        }}
      />
      <AddFriendForm draft={draft} setDraft={setDraft} imported={imported !== null} />
      <GreetingsSection
        greetings={draft.greetings}
        onChange={(g) => setDraft({ ...draft, greetings: g })}
        /*
         * 🔴 **匯入的角色已經在資料庫裡** ⇒ 關掉那一層就存，不必等最下面那顆鈕
         * （Peter 2026-08-26）。從零建立的還沒有 id，只能留在草稿裡等送出。
         */
        {...(imported
          ? {
              onCommit: (g: string[]) =>
                saveGreetings.mutate({ id: imported.id, draft: { ...draft, greetings: g } }),
            }
          : {})}
      />
    </Screen>
  );
}
