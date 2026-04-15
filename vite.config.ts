import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      // 代理常见流媒体地址以解决跨域问题
      '/live3': {
        target: 'http://23.237.228.134',
        changeOrigin: true
      },
      '/gslb': {
        target: 'http://38.75.136.137:98',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gslb/, '')
      },
      // 通用 API 代理端点 - 解决 CORS 问题
      '/api/proxy': {
        target: 'http://localhost',
        changeOrigin: true,
        // 使用 router 函数动态设置代理目标
        router: async (req) => {
          const url = req.url
          if (url) {
            const urlMatch = url.match(/\?url=([^&]+)/)
            if (urlMatch) {
              try {
                const targetUrl = decodeURIComponent(urlMatch[1])
                const parsed = new URL(targetUrl)
                console.log(`[Vite Proxy] 代理请求: ${targetUrl}`)
                return `${parsed.protocol}//${parsed.host}`
              } catch {
                console.error('[Vite Proxy] 代理目标 URL 解析失败:', url)
              }
            }
          }
          return 'http://localhost'
        },
        rewrite: (path) => {
          // 从查询参数中提取目标 URL 的路径部分
          const urlMatch = path.match(/\?url=([^&]+)/)
          if (urlMatch) {
            try {
              const targetUrl = decodeURIComponent(urlMatch[1])
              const url = new URL(targetUrl)
              const fullPath = url.pathname + url.search
              console.log(`[Vite Proxy] 重写路径: ${path} -> ${fullPath}`)
              return fullPath
            } catch {
              return path
            }
          }
          return path
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] 代理错误:', err.message)
          })
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[Vite Proxy] 发起请求: ${proxyReq.path}`)
          })
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`[Vite Proxy] 收到响应: ${proxyRes.statusCode}`)
          })
        }
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'dplayer': ['dplayer', 'hls.js']
        }
      }
    }
  }
})
