import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts: the unit tests cover pure game logic and
// services only, so they need no Vite plugins (react/pwa/mkcert). Separating
// also avoids a dual-`vite` type clash between the plugins and vitest's config.
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
