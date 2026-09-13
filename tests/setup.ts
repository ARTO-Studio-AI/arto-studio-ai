import { config } from "dotenv";
import path from "node:path";

/* Carga .env.local si existe (dev en el Mini con `vercel env pull`).
 *
 * H-45 (2026-09-13): antes, cualquier DATABASE_URL que viniera de .env.local
 * activaba las pruebas de integracion, y un `vercel env pull` de produccion
 * bastaba para escribir filas reales en prompt_opens. Ahora la base solo se
 * toca si ASAI_INTEGRATION_DB_URL llega explicita en la linea de comandos:
 *
 *   ASAI_INTEGRATION_DB_URL=postgres://... npm test
 *
 * Se lee ANTES de cargar .env.local, asi que ponerla en ese archivo no la
 * activa. Sin ella se borra DATABASE_URL del entorno de las pruebas: ninguna
 * prueba puede heredar la conexion de produccion por accidente. Las pruebas
 * unitarias que mockean postgres ponen su propia DATABASE_URL falsa. */
const integrationDbUrl = process.env.ASAI_INTEGRATION_DB_URL?.trim() || "";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

if (integrationDbUrl) {
  process.env.ASAI_INTEGRATION_DB_URL = integrationDbUrl;
  process.env.DATABASE_URL = integrationDbUrl;
} else {
  delete process.env.ASAI_INTEGRATION_DB_URL;
  delete process.env.DATABASE_URL;
}
