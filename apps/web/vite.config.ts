import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    rollupOptions: {
      output: {
        // فصل المكتبات الثقيلة عن كود التطبيق لتحسين التخزين المؤقت وحجم التحميل الأول
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
          motion: ['motion'],
          dnd: ['react-dnd', 'react-dnd-html5-backend'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },

  server: {
    proxy: {
      // نفس الأصل في التطوير — الكوكيات وCORS بلا تعقيد
      '/api': 'http://localhost:3001',
    },
  },
})
