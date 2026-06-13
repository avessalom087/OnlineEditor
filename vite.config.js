import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 3000
  },
  build: {
    // Increase the warning threshold slightly for large editor components
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor libs separately for better long-term caching
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
});
