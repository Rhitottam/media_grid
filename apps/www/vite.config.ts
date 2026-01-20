import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/media_grid/' : '/',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild', // esbuild is faster and built-in (terser requires separate install)
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-konva': ['konva', 'react-konva'],
        },
      },
    },
  },
})
