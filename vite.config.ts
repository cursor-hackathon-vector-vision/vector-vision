import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    // SSL für WebXR (AR/VR braucht HTTPS)
    basicSsl()
  ],
  server: {
    https: true,
    host: true, // Für Netzwerk-Zugriff (AR auf Handy)
    port: 5173,
    watch: {
      // Reduce file watchers to prevent EMFILE errors
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.cursor/**'
      ],
      // Use polling with longer interval to reduce system load
      usePolling: false,
    }
  },
  build: {
    target: 'esnext',
    sourcemap: true
  },
  optimizeDeps: {
    // Exclude large deps from optimization watching
    exclude: ['three']
  }
});
