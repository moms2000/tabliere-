import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
