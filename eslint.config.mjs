import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Deuda registrada el 2026-09-11 al encender el CI (Fase 0 del Sprint 1).
    // main traía 47 errores en estas cinco reglas repartidos en 20 archivos. Arreglarlos
    // toca lógica de hooks y no cabe en un PR de candados, así que se bajan a warning para
    // que el CI bloquee errores nuevos sin exigir esa limpieza hoy. Cuando se corrija la
    // deuda, borrar este bloque para que vuelvan a ser error.
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
