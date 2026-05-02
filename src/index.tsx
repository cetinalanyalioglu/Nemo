import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { isDebugMode } from './utils/debug';

if (isDebugMode()) {
  console.log('Debug mode is enabled.');
}

const originalError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args[0]?.toString() ?? '';
  if (msg.includes('ResizeObserver loop') || msg.includes('ResizeObserver loop completed')) {
    return;
  }
  originalError.apply(console, args as never);
};

const originalHandler = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (
    typeof message === 'string' &&
    (message.includes('ResizeObserver loop') || message.includes('ResizeObserver loop completed'))
  ) {
    return true;
  }
  if (originalHandler) {
    return originalHandler(message, source, lineno, colno, error);
  }
  return false;
};

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
