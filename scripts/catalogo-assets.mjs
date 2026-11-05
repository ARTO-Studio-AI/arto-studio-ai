#!/usr/bin/env node
/* Regenera src/lib/catalogo/assets.json con lo que hay en disco (2026-11-05; antes
 * scripts/edit-bundle-manifest.mjs, Victor, 27 oct 2026).
 *
 *   public/skills/demos/<slug>.mp4 y .jpg       -> demos (publicas)
 *   private/skills/<slug>.skill y <bundle>.zip  -> paquetes (privados)
 *
 * Recorre todos los skills y bundles de src/lib/catalogo/skills.json. Revisa los limites del
 * contrato (demo 1.5 MB, poster 150 KB, paquete 4.4 MB); si algo se pasa, sale con codigo 1
 * y no escribe nada. add-skill.mjs ya lo corre solo; esto es para cuando se copia a mano.
 *
 * Uso, desde la raiz del repo:  node scripts/catalogo-assets.mjs */

import { writeAssets } from "./lib/catalogo.mjs";

try {
  const a = writeAssets(process.cwd());
  console.log(`catalogo-assets: ${Object.keys(a.demos).length} demos, ${Object.keys(a.packages).length} paquetes`);
} catch (err) {
  console.error(`catalogo-assets: ${err.message}`);
  process.exit(1);
}
