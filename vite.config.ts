import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Base path for GitHub Pages deployment
  // Change 'cloud_grid' to your repository name
  base: command === 'build' ? '/cloud_grid/' : '/',
  
  root: '.',
  publicDir: 'public',
  plugins: [react()],
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Target modern browsers that support top-level await
    target: 'esnext',
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'konva-vendor': ['konva', 'react-konva'],
          'ui-vendor': ['@radix-ui/react-checkbox', '@radix-ui/react-label', '@radix-ui/react-slot'],
        },
      },
    },
    // Enable source maps for debugging
    sourcemap: true,
  },
  
  esbuild: {
    // Support top-level await for WASM
    target: 'esnext',
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
      '@wasm': path.resolve(__dirname, './src/wasm/build'),
    },
  },
  
  server: {
    port: 3000,
    // Enable CORS for development
    cors: true,
  },
  
  preview: {
    port: 4173,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'konva', 'react-konva'],
  },
  
  // Worker configuration
  worker: {
    format: 'es',
  },
}));
