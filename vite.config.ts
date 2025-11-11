import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // This tells Vite not to bundle this package,
      // because it's provided by the importmap in index.html at runtime.
      external: ['@svar-widgets/react-gantt']
    }
  }
});
