import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import mkcert from 'vite-plugin-mkcert';

// HTTPS is required so iOS Safari grants camera + DeviceOrientation.
//  - `npm run dev`        → mkcert HTTPS on the LAN (install the CA on the phone).
//  - `npm run dev:tunnel` → plain HTTP; a `cloudflared` tunnel supplies trusted
//                            HTTPS with nothing to install on the phone.
const isTunnel = process.env.npm_lifecycle_event === 'dev:tunnel';

export default defineConfig({
  plugins: [
    react(),
    ...(isTunnel ? [] : [mkcert()]),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: '주변에 귀신이 있습니다',
        short_name: '주귀다',
        description: '카메라로 주변을 비추면 세계의 귀신들이 확! 나타난다. 조준해서 잡아라.',
        lang: 'ko',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        // Sprites can be large; allow a generous precache budget.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true, // expose on LAN so the iPhone can reach the dev server
    // Allow cloudflared quick-tunnel hostnames (random *.trycloudflare.com each run).
    allowedHosts: ['.trycloudflare.com'],
  },
});
