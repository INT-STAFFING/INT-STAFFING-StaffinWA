import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // This tells Vite not to bundle these packages,
      // because they're provided by the importmap in index.html at runtime.
      external: [
        '@svar-widgets/react-gantt',
        'd3-scale',
        'd3-time-format'
      ]
    }
  }
});
