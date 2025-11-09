import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_API_PROXY ?? "http://localhost:4000";

export default defineConfig({
  server: {
    port: 8080,
    proxy: {
      "/api": apiProxyTarget,
    },
  },
  plugins: [react()],
});
