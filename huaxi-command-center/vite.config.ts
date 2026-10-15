import path from 'node:path'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import { codeInspectorPlugin } from 'code-inspector-plugin'
import { defineConfig, loadEnv } from 'vite'
import { injectBackendEnvPlugin } from './src/vite-plugin-inject-backend-env.js'

export default defineConfig(({ mode }) => {
  // 注意：vite.config.ts 里 process.env 不会包含 .env 文件的变量，
  // 必须用 loadEnv 显式读取，否则代理目标会静默回落到远程默认地址。
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    process.env.HX_API_PROXY_TARGET || env.HX_API_PROXY_TARGET || 'http://62.234.128.72:7824'

  return {
    plugins: [
      injectBackendEnvPlugin(),
      vue(),
      react(),
      mode === 'development' &&
        codeInspectorPlugin({
          bundler: 'vite',
          // Windows：按住 Alt + Shift，再点击页面元素，在 Cursor / VS Code 中打开对应源码
          hotKeys: ['altKey', 'shiftKey'],
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/backend-api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/backend-api/, '/api'),
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/backend-api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/backend-api/, '/api'),
        },
      },
    },
    build: {
      sourcemap: mode === 'development',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          app: path.resolve(__dirname, 'app.html'),
          login: path.resolve(__dirname, 'login.html'),
          srcShell: path.resolve(__dirname, 'src-shell.html'),
          devtools: path.resolve(__dirname, 'index.devtools.html'),
          smartCity: path.resolve(__dirname, 'smart-city.html'),
          gisCommand: path.resolve(__dirname, 'gis-command.html'),
          meetingPortal: path.resolve(__dirname, 'meeting-portal.html'),
          dispatch: path.resolve(__dirname, 'dispatch.html'),
          digitalTwinMap: path.resolve(__dirname, 'digital-twin-map.html'),
        },
      },
    },
    css: {
      devSourcemap: true,
    },
  }
})
