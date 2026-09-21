import { VitePWA } from 'vite-plugin-pwa';

/**
 * Application installable et auto-mise a jour.
 *
 * Regle d'or : le service worker ne met JAMAIS en cache /api. Stock, commandes et
 * sessions viennent toujours du serveur ; seuls l'interface compilee, le logo,
 * les polices et les photos de plats sont gardes localement.
 *
 * Le moment ou la nouvelle version s'applique est gere par src/components/UpdateNotice.jsx.
 */
export const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo-hasdrubal.png', 'logo-hasdrubal-light.png'],
  manifest: {
    name: 'Hasdrubal de Carthage',
    short_name: 'Hasdrubal',
    description: 'Gestion du restaurant Hasdrubal de Carthage',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fffcf6',
    theme_color: '#a8683a',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        // Chaque photo televersee a un nom unique : elle ne change jamais, on peut la garder.
        urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'photos-plats',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'polices' },
      },
    ],
  },
  // Pas de service worker en developpement : il masquerait le rechargement a chaud.
  devOptions: { enabled: false },
});
