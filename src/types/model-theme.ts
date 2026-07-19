/**
 * Per-model theming.
 *
 * A model YAML may name a theme (`theme: nefes`). The name resolves to a
 * stylesheet that ships with the app under `src/styles/model-themes/`; the
 * YAML never carries colour values, only the name. Themes are applied by
 * setting `data-model-theme` on <html>, which composes with the existing
 * `data-theme` light/dark attribute:
 *
 *   [data-model-theme='nefes']                     -> light overrides
 *   [data-model-theme='nefes'][data-theme='dark']  -> dark overrides
 *
 * Because the two attributes are independent, a model theme only has to state
 * how it differs from the default pair; light/dark switching keeps working
 * untouched.
 *
 * Themes deliberately override only the accent, surface, border and text
 * families. Status colours (success/error/invalid) stay global: they carry
 * meaning a user must read correctly regardless of which model is loaded.
 */

/** Themes bundled with the app. A model may name any one of these. */
export const MODEL_THEME_IDS = ['nefes'] as const;

export type ModelThemeId = (typeof MODEL_THEME_IDS)[number];

export const MODEL_THEME_STORAGE_KEY = 'nemo-model-theme';

export const isModelThemeId = (value: unknown): value is ModelThemeId =>
  typeof value === 'string' && (MODEL_THEME_IDS as readonly string[]).includes(value);

/**
 * Reads the last applied model theme. Models load asynchronously, well after
 * first paint, so the stored value lets us dress the first frame in the theme
 * the user will almost certainly end up with instead of flashing the default
 * palette first. A wrong guess is corrected once the model resolves.
 */
export const readStoredModelTheme = (): ModelThemeId | null => {
  try {
    const stored = localStorage.getItem(MODEL_THEME_STORAGE_KEY);
    return isModelThemeId(stored) ? stored : null;
  } catch {
    return null;
  }
};

/** Applies (or clears) the model theme attribute and persists the choice. */
export const applyModelTheme = (theme: ModelThemeId | null): void => {
  const root = document.documentElement;
  if (theme) {
    root.setAttribute('data-model-theme', theme);
  } else {
    root.removeAttribute('data-model-theme');
  }
  try {
    if (theme) {
      localStorage.setItem(MODEL_THEME_STORAGE_KEY, theme);
    } else {
      localStorage.removeItem(MODEL_THEME_STORAGE_KEY);
    }
  } catch {
    /* localStorage unavailable */
  }
};
