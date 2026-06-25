import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', 
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 5173, 
    },
    // 🛠️ تفعيل البروكسي العكسي لتحويل طلبات الـ API والـ Sockets لـ 4000 تلقائياً وحظر الـ CORS تماماً
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
      '/workspace': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        ws: true, // دعم دفق الـ WebSockets حياً
      }
    }
  },
});
