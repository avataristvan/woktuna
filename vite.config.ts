import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      // Service worker must only run in production — a stale dev-mode SW
      // causes confusing "my change isn't showing up" bugs. Keep
      // devOptions.enabled at its default (false).
      registerType: 'autoUpdate',
      manifest: {
        name: 'WokTuna',
        short_name: 'WokTuna',
        description:
          'Handpan tuning guidance — shows where and along which axis to hammer each tone field.',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a1a',
        theme_color: '#1a1a1a',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
