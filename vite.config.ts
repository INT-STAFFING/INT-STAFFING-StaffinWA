
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
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
      }
    };
});
