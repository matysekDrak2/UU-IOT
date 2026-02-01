import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [react(), svgr()],
  host: "0.0.0.0",
  port: 5173,
  hmr: {
    protocol: "wss",
    host: "uuiot.cytadel.xyz",
    clientPort: 443,
  },
});
