import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    react(),
    // Compatibilité navigateurs anciens (ex. le WebView des bornes Sunmi V2 Pro
    // sous Android 7). Génère un bundle transpilé + polyfillé (core-js) servi aux
    // vieux navigateurs, et polyfille aussi le bundle moderne si une API récente
    // (flatMap, Object.fromEntries…) manque. Évite la page blanche sur ces appareils.
    legacy({
      targets: ["defaults", "chrome >= 55", "android >= 5", "safari >= 10"],
      modernPolyfills: true,
    }),
  ],
  server: { port: 3000 },
  build: {
    // Séparer les vendors en chunks distincts → mieux mis en cache par le navigateur
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-icons":  ["lucide-react"],
          "vendor-qr":     ["react-qr-code"],
          "vendor-axios":  ["axios"],
        },
      },
    },
    // Alerte si un chunk dépasse 500 KB
    chunkSizeWarningLimit: 500,
  },
});
