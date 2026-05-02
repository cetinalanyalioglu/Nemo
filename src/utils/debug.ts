export const isDebugMode = (): boolean => {
  return true;
};

export const debugLog = (...args: unknown[]): void => {
  if (isDebugMode()) {
    console.debug(...args);
  }
};

export const debugError = (...args: unknown[]): void => {
  if (isDebugMode()) {
    console.error(...args);
  }
};
