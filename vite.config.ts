import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/TUFLOW_NPad/',
  plugins: [react()],
  esbuild: false,
  test: {
    environment: 'node',
    globals: true
  }
});
