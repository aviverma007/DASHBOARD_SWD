import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
    // LAN clients (192.168.x.x) hit the app by server IP or hostname
    allowedHosts: true,
  },
});
