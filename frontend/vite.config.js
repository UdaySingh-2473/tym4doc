import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import path from "path";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    strictPort: true
  },

  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ["tym4doc.onrender.com"]
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
