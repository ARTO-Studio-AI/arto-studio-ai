import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Pruebas con vitest (agregado el 2026-09-11, Fase 1B del Sprint 1).
// src/**/*.test.ts son unitarias sin base (lo que toca Postgres se mockea, ver
// src/lib/clients/*.test.ts). tests/**/*.test.ts son las del contador free
// (Fase 2-4): corren contra DATABASE_URL si existe y se saltan si no.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
