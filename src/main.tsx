import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider';
import { QueryProvider } from './data/QueryProvider';
import { ThemeProvider } from './features/shell/ThemeProvider';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);

// Register the PWA service worker for app-shell caching (Task 17.4; R23.2).
// Guarded by `'serviceWorker' in navigator` and only in production builds.
registerServiceWorker();
