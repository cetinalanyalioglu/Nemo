export const isDebugMode = () => {
  return true;
};

export const debugLog = (...args) => {
  if (isDebugMode()) {
    console.debug(...args);
  }
};

export const debugError = (...args) => {
  if (isDebugMode()) {
    console.error(...args);
  }
};
