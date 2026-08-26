/**
 * 這個 feature 對外的門面。
 * 🔴 **只列真的有外部使用者的名字**（GAP-46 的教訓：barrel 匯出 29 個、14 個沒人用，
 * 「誰在用什麼」就看不出來了）。feature 內部走相對路徑，不從這裡繞。
 */
export { fetchBackgrounds } from './api';
export type { Fitting } from './model';
export { useBackgroundOverride } from './store';
export { BackgroundCanvas } from './ui/BackgroundCanvas';
export { BackgroundsLayer } from './ui/BackgroundsLayer';
