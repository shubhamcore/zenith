import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 4177,
    allowedHosts: true,
    headers: {
      'Cache-Control': 'no-store',
    },
    proxy: {
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky/, '/api/states/all'),
      },
      '/api/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: (path) => {
          const group = path.replace(/^\/api\/celestrak\/?/, '') || 'stations'
          return `/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4177,
    allowedHosts: true,
  },
})
