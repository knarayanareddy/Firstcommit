import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB instead of default 2MB
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: 'RocketBoard - Learning Platform',
        short_name: 'RocketBoard',
        description: 'AI-powered learning and onboarding platform',
        theme_color: '#6366f1',
        background_color: '#0a0a0a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    // Raise warning threshold — some viz libs are legitimately large
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy visualization / document libraries — split into async chunks
          // so they don't inflate the initial JS bundle
          mermaid: ["mermaid"],
          xlsx: ["xlsx"],
          cytoscape: ["cytoscape"],
          "pdf-lib": ["pdfjs-dist"],
          katex: ["katex"],
          "html2canvas": ["html2canvas"],
        },
      },
    },
  },
}));

