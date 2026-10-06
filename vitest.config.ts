import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for the Vite build; tests need it compiled.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
