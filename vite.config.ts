import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_LOCAL_API_PROXY_TARGET || 'http://127.0.0.1:8787'

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
  }
})
