
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: {
            // Vendor splitting: isola le librerie stabili e pesanti in chunk
            // dedicati per migliorare il caching tra deploy. exceljs (via
            // excelAdapter)/jspdf restano gia in chunk separati perche importati in modo lazy.
            manualChunks: {
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'd3-vendor': ['d3', 'd3-sankey'],
            },
          },
        },
      },
      resolve: {
        alias: {
          // FIX: In ESM environments where the global 'process' might not have 'cwd' typed correctly,
          // path.resolve() can be used to get the current working directory.
          '@': path.resolve('.'),
          // FIX: Using path.resolve('libs/zod') instead of path.resolve(process.cwd(), 'libs/zod')
          // to avoid the same TypeScript error.
          'zod': path.resolve('libs/zod'),
        }
      },
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: [],
        alias: {
          '@': path.resolve('.'),
          'zod': path.resolve('libs/zod'),
        },
      },
    };
});
