import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
          } else if (/\.(js|css)$/.test(p) && !p.endsWith("sw.js")) {
            files.push("/" + p.split("\\").join("/").replace(/^dist\//, ""));
          }
        }
      };
      walk(dist);
      const swPath = join(dist, "sw.js");
      const sw = readFileSync(swPath, "utf8");
      writeFileSync(swPath, sw.replace("/*__OFFLINE_ASSETS__*/ []", JSON.stringify(files)));
    },
  };
}

export default defineConfig({
  plugins: [react(), offlinePrecache()],
});