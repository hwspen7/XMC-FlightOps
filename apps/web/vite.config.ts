import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The shared package now exports runtime helpers as well as types.
  optimizeDeps: { include: ['@xplane/shared'] },
  server: {
    proxy: {
      '/control': { target: 'ws://127.0.0.1:3000', ws: true },
    },
  },
});
