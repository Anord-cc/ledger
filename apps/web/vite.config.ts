import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.LEDGER_API_URL || "http://localhost:4000";
  const allowedHosts =
    env.LEDGER_ALLOWED_HOSTS === "*"
      ? true
      : (env.LEDGER_ALLOWED_HOSTS || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true
        },
        "/health": {
          target: apiTarget,
          changeOrigin: true
        },
        "/mcp": {
          target: apiTarget,
          changeOrigin: true
        }
      }
    }
  };
});
