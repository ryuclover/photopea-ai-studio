import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Garante assets relativos para iframes embutidos no Photopea
  server: {
    port: 5173,
    cors: true,
    // Generated evidence and reports must not reload a panel during inference.
    watch: { ignored: ["**/test-results/**", "**/*.md"] },
    proxy: {
      '/api/nvidia': {
        target: 'https://ai.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
        secure: true
      },
      '/api/sdxl-inpaint': {
        target: 'https://diffusers-stable-diffusion-xl-inpainting.hf.space',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sdxl-inpaint/, ''),
        secure: true
      }
    }
  }
});
