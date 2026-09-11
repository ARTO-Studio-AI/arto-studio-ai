import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Pruebas unitarias con vitest (agregado el 2026-09-11, Fase 1B del Sprint 1).
// Solo corre archivos *.test.ts dentro de src/. Sin base de datos: lo que toca
// Postgres se mockea (ver src/lib/clients/*.test.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
