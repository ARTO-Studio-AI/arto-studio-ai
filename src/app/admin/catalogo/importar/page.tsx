import { CSV_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/catalog";
import { guardAdmin, PageHead } from "../../_kit";
import ImportClient from "./ImportClient";

/* /admin/catalogo/importar: cargar prompts por lote desde un CSV. Primero revisa (que pasa
 * con cada fila) y despues aplica todo como un solo lote que se puede deshacer. */

export const dynamic = "force-dynamic";

export default async function Importar() {
  await guardAdmin();
  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Importar CSV" />
      <div className="mb-6 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 text-sm leading-relaxed text-zinc-600">
        <p>
          La forma más fácil: <strong>exporta</strong> desde el Catálogo (con el filtro que quieras), edita el archivo en Excel o
          Sheets y vuelve a subirlo.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><strong>Con id</strong> (por ejemplo BR-0012): edita ese prompt. Solo cambian las celdas con valor; una celda vacía no borra nada.</li>
          <li><strong>Sin id</strong>: es un alta. Entra como <strong>no disponible</strong>, para que lo revises y lo publiques desde el Catálogo. Necesita títulos, prompts en los dos idiomas, vertical, subcategoría, modelo, dificultad y plan.</li>
          <li>Etiquetas separadas por «|». Disponible: sí o no. Plan: free o pro.</li>
          <li>Hasta {IMPORT_MAX_ROWS} filas por archivo. Todo queda en el historial y se puede deshacer.</li>
        </ul>
        <p className="mt-3 font-mono text-xs text-zinc-500">Columnas: {CSV_COLUMNS.join(", ")}</p>
      </div>
      <ImportClient />
    </div>
  );
}
