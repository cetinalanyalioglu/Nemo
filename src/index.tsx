import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { readStoredTheme } from './types/theme';
import App from './App';
import { isDebugMode } from './utils/debug';

document.documentElement.setAttribute('data-theme', readStoredTheme());

if (isDebugMode()) {
  console.log('Debug mode is enabled.');
}

const isResizeObserverNoise = (message: unknown): boolean => {
  const text = typeof message === 'string' ? message : String(message ?? '');
  return text.includes('ResizeObserver loop');
};

const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (isResizeObserverNoise(args[0])) {
    return;
  }
  originalError.apply(console, args as never);
};

const originalHandler = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (isResizeObserverNoise(message)) {
    return true;
  }
  if (originalHandler) {
    return originalHandler(message, source, lineno, colno, error);
  }
  return false;
};

window.addEventListener(
  'error',
  (event) => {
    if (isResizeObserverNoise(event.message)) {
      event.stopImmediatePropagation();
    }
  },
  true
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
