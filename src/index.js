import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { isDebugMode } from './utils/debug';

if (isDebugMode()) {
  console.log('Debug mode is enabled.');
}

// Suppress ResizeObserver loop warnings - these are harmless and occur during node resizing
// React Flow uses ResizeObserver internally and these errors don't indicate actual problems
const originalError = console.error;
console.error = (...args) => {
  if (
    args[0]?.toString().includes('ResizeObserver loop') ||
    args[0]?.toString().includes('ResizeObserver loop completed')
  ) {
    return; // Suppress this specific error
  }
  originalError.apply(console, args);
};

// Also suppress ResizeObserver errors in window error handler
const originalHandler = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (
    typeof message === 'string' &&
    (message.includes('ResizeObserver loop') || message.includes('ResizeObserver loop completed'))
  ) {
    return true; // Suppress error
  }
  if (originalHandler) {
    return originalHandler(message, source, lineno, colno, error);
  }
  return false;
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
