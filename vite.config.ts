import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createApp } from "./src/app";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    cors: true,
    hmr: {
      port: 5000,
      host: "localhost"
    },
    fs: {
      allow: ["./client", "./shared", "./admin"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@admin": path.resolve(__dirname, "./admin"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    configureServer(server) {
      try {
        const app = createApp();
        server.middlewares.use(app);
      } catch (error) {
        console.error('Failed to create Express app:', error);
      }
    },
  };
}