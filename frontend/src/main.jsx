// Polyfill for crypto.randomUUID in non-secure contexts (e.g. HTTP over LAN / Wi-Fi)
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    window.crypto = {};
  }
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
}

// Dev only: localhost:5173 is shared by every Vite project on this machine, so a service worker
// left behind by another app can answer this app's API and font requests (e.g. 503 + a foreign
// Access-Control-Allow-Origin). This app registers none, so remove any that exist and reload once.
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;
    await Promise.all(registrations.map((r) => r.unregister()));
    if (window.caches) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    if (!sessionStorage.getItem('swCleared')) {
      sessionStorage.setItem('swCleared', '1');
      window.location.reload();
    }
  }).catch(() => { /* service workers unavailable */ });
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
