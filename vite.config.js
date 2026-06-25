import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {} // هنا نعرّف الـ process لكي لا ينهار المتصفح
  }
});
