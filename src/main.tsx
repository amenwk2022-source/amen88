// Fix for "Cannot set property fetch of #<Window> which has only a getter"
// This must run before any other imports
try {
  const win = window as any;
  const descriptor = Object.getOwnPropertyDescriptor(win, 'fetch');
  if (descriptor && !descriptor.writable && descriptor.configurable) {
    Object.defineProperty(win, 'fetch', {
      value: win.fetch,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } else if (descriptor && !descriptor.writable && !descriptor.configurable) {
    // If we can't redefine it, we just hope no one tries to set it.
    // Some polyfills check if it's already there before setting.
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
