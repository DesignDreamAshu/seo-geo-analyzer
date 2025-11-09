import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const apiProxyTarget = process.env.VITE_API_PROXY || "http://localhost:4000";

  return {
  server: {
    host: process.env.VITE_DEV_HOST ?? "127.0.0.1", // force IPv4 so localhost resolves consistently (IPv6 returned 404)
    port: 8080,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  };
});
