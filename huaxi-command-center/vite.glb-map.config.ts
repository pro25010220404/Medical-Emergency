import path from 'node:path'
import { defineConfig } from 'vite'

/** 产出 app.html 可用的 ES 模块：public/assets/enhance/map-hospital-glb-enhance.js */
export default defineConfig({
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, '.map-bundle'),
    lib: {
      entry: path.resolve(__dirname, 'src/legacy/appHomeMapUpgrade.ts'),
      formats: ['es'],
      fileName: () => 'map-hospital-glb-enhance.js',
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
