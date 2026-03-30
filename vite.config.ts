import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/render.tsx',
      formats: ['cjs'],
      fileName: () => 'render.cjs',
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['preact', 'preact-render-to-string', 'preact/hooks'],
    },
    minify: false,
    sourcemap: true,
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  },
});
