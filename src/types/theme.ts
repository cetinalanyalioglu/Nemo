export type ThemeId = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'fnetlib-theme';

export const THEME_OPTIONS: { value: ThemeId; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export const isThemeId = (value: string | null): value is ThemeId =>
  value === 'light' || value === 'dark';

export const readStoredTheme = (): ThemeId => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'light';
};
