/**
 * Service-worker registration (Task 17.4; R23.2, R23.4).
 *
 * Registers `/sw.js` for app-shell caching. Guarded by `'serviceWorker' in
 * navigator` and only runs in production builds (`import.meta.env.PROD`) so the
 * Vite dev server / test environment is never affected. Failures are swallowed
 * — the app works fine without the service worker; we make no false claims
 * about offline capability (R23.4).
 */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  if (!import.meta.env.PROD) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration is best-effort; the app remains fully functional online.
    });
  });
}
