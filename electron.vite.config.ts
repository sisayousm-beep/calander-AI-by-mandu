import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const alias = {
  "@main": resolve("src/main"),
  "@renderer": resolve("src/renderer"),
  "@shared": resolve("src/shared"),
};

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};
const external = ["electron", ...Object.keys(packageJson.dependencies ?? {})];

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      outDir: "out/main",
      sourcemap: false,
      rollupOptions: {
        input: resolve("src/main/main.ts"),
        external,
      },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      outDir: "out/preload",
      sourcemap: false,
      rollupOptions: {
        input: resolve("src/preload/index.ts"),
        external,
      },
    },
  },
  renderer: {
    resolve: { alias },
    plugins: [react()],
    build: {
      outDir: "out/renderer",
    },
  },
});
