import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built index.html works when served from a
  // GitHub Pages project path (https://<user>.github.io/linkedin/).
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // LinkedIn Lessons — the guided post generator, served at /lessons/
        lessons: fileURLToPath(new URL('./lessons/index.html', import.meta.url)),
        // Roast My LinkedIn — the inspection office, served at /roast/
        roast: fileURLToPath(new URL('./roast/index.html', import.meta.url)),
      },
    },
  },
});
