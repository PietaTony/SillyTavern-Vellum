import { createFileRoute } from '@tanstack/react-router';
import { SettingsAboutScreen } from '@/app/screens/SettingsAboutScreen';
import { useBack } from '@/app/screens/useBack';

export const Route = createFileRoute('/settings/about')({ component: SettingsAbout });

/** 設定 tab 的子頁 —— 從 `/settings` 進來，有返回鍵（退回設定清單）。 */
function SettingsAbout() {
  const onBack = useBack();
  return <SettingsAboutScreen onBack={onBack} />;
}
