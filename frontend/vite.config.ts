import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@schema': path.resolve(__dirname, '../schemas/persona-spec.schema.json')
    }
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..']
    }
  }
});

