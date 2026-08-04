import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built index.html works when served from a
  // GitHub Pages project path (https://<user>.github.io/linkedin/).
  base: './',
});
