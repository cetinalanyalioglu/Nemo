// Set below variable true in the environment to enable debug mode
const DEBUG_ENV_VAR = 'REACT_APP_FNETLIB_UI_DEBUG';

export const isDebugMode = () => {
  return process.env[DEBUG_ENV_VAR] === 'true';
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
