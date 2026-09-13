import { config } from "dotenv";
import path from "node:path";

/* Carga .env.local si existe (dev en el Mini con `vercel env pull`). En CI no hay
 * secretos y las pruebas de integracion se saltan solas. */
config({ path: path.join(process.cwd(), ".env.local") });
