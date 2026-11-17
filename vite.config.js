import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STATIC_ASSET_EXTENSIONS =
  /\.(?:js|mjs|cjs|css|json|wasm|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|map)$/i;

function offlinePrecache() {
  return {
    name: "offline-precache",
    closeBundle() {
      const dist = "dist";
      const files = [];

      const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, entry.name);

          if (entry.isDirectory()) {
            walk(p);
            continue;
          }

          if (!p.endsWith("sw.js") && STATIC_ASSET_EXTENSIONS.test(p)) {
            files.push(
              "/" + p.split("\\").join("/").replace(/^dist\//, "")
            );
          }
        }
      };

      walk(dist);

      const swPath = join(dist, "sw.js");
      const sw = readFileSync(swPath, "utf8");

      writeFileSync(
        swPath,
        sw.replace("/*__OFFLINE_ASSETS__*/ []", JSON.stringify(files))
      );
    },
  };
}

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium/"),
  },

  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,

    hmr: {
      protocol: "ws",
      host: "localhost",
      clientPort: 5173,
    },
  },

  plugins: [
    react(),

    viteStaticCopy({
      targets: [
        {
          src: "node_modules/cesium/Build/Cesium/**/*",
          dest: "cesium",
        },
      ],
    }),

    offlinePrecache(),
  ],
});
