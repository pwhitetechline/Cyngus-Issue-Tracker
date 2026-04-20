import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite HMR errors that can occur during dev server restarts
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason);
  if (message.includes('[vite] failed to connect to websocket') || 
      message.includes('WebSocket closed without opened')) {
    event.preventDefault();
    console.debug('Suppressed benign HMR error:', message);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
