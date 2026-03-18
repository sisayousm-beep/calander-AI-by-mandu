import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve("src/renderer"),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@main": resolve("src/main"),
      "@renderer": resolve("src/renderer"),
      "@shared": resolve("src/shared"),
    },
  },
  build: {
    outDir: resolve("out/renderer"),
    emptyOutDir: false,
  },
});
