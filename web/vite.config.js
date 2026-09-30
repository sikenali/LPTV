import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { port: 5173, host: '0.0.0.0', open: false, proxy: {
    '/api': 'http://127.0.0.1:9100',
    '/_page': 'http://127.0.0.1:9100',
    '/capi': 'http://127.0.0.1:9100',
    '/proxy-video': 'http://127.0.0.1:9100',
    '/layer.js': 'http://127.0.0.1:9100',
    '/patch.js': 'http://127.0.0.1:9100',
    '/ui.css': 'http://127.0.0.1:9100',
    '/api.js': 'http://127.0.0.1:9100',
    '/state.js': 'http://127.0.0.1:9100',
  }},
  build: { outDir: 'dist' }
})
