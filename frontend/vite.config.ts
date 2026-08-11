import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Desactivar el SW en desarrollo para evitar interferencia con descargas PDF
      disabled: process.env.NODE_ENV === 'development',
      selfDestroying: true, // Fuerza la auto-destrucción del SW existente
      registerType: 'autoUpdate',
      includeAssets: ['logo-gd.svg'],
      workbox: {
        navigateFallbackDenylist: [/^\/blob:/, /\.pdf$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          }
        ],
      },
      manifest: {
        name: 'Gestión Docente',
        short_name: 'Docente',
        description: 'Plataforma para gestión educativa',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo-gd.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('purify')) {
              return 'vendor-libs';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})