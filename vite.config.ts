import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './', // важно для Capacitor: относительные пути к ассетам
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Phaser — отдельный крупный чанк: кэшируется браузером независимо
          // от кода игры и не попадает в предупреждение о размере.
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

