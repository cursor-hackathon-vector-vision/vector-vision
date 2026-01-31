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
    port: 5173
  },
  build: {
    target: 'esnext',
    sourcemap: true
  }
});
