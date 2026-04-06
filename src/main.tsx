// Fix for "Cannot set property fetch of #<Window> which has only a getter"
// This runs as a fallback to the inline script in index.html
try {
  const win = window as any;
  let descriptor = Object.getOwnPropertyDescriptor(win, 'fetch');
  if (!descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(win), 'fetch');
  }
  if (descriptor && (descriptor.get || !descriptor.writable) && descriptor.configurable) {
    const originalFetch = win.fetch;
    let currentFetch = originalFetch;
    try {
      Object.defineProperty(win, 'fetch', {
        get: () => currentFetch,
        set: (v) => { currentFetch = v; },
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      // If defineProperty fails, try deleting and setting
      try {
        delete win.fetch;
        win.fetch = currentFetch;
      } catch (e2) {}
    }
  }
} catch (e) {
  // Ignore errors in environment setup
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
