import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'grid.worker': 'src/workers/grid.worker.ts',
    'image-loader.worker': 'src/workers/image-loader.worker.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  treeshake: true,
  external: ['react', 'react-dom', 'konva', 'react-konva'],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    }
  },
})
