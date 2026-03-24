import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");
  const rawPort = env.WEB_PORT ?? "5173";
  const rawApiPort = env.PORT ?? "3000";
  const port = Number(rawPort);
  const apiPort = Number(rawApiPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid WEB_PORT value: "${rawPort}"`);
  }

  if (Number.isNaN(apiPort) || apiPort <= 0) {
    throw new Error(`Invalid PORT value: "${rawApiPort}"`);
  }

  const basePath = env.BASE_PATH || "/";
  const apiTarget = env.API_URL || `http://127.0.0.1:${apiPort}`;
  const isReplit = mode !== "production" && env.REPL_ID !== undefined;

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      ...(isReplit
        ? [
            (await import("@replit/vite-plugin-runtime-error-modal")).default(),
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
