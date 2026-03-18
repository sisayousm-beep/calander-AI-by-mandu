import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};

const external = [
  "electron",
  ...builtinModules,
  ...builtinModules.map((item) => `node:${item}`),
  ...Object.keys(packageJson.dependencies ?? {}),
];

export default defineConfig({
  resolve: {
    alias: {
      "@main": resolve("src/main"),
      "@renderer": resolve("src/renderer"),
      "@shared": resolve("src/shared"),
    },
  },
  build: {
    outDir: "out/preload",
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve("src/preload/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external,
    },
  },
});
