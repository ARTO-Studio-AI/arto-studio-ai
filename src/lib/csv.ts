/* CSV del Catalogo (2026-10-12). RFC 4180: comas, comillas dobles escapadas como "", y
 * saltos de linea dentro de un campo entre comillas. Sin dependencias. */

/** Lee un CSV completo. Acepta BOM, CRLF y LF. Devuelve filas de celdas. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw new Error("El CSV tiene unas comillas sin cerrar.");
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Quita el apostrofo que csvCell antepone a las celdas que empiezan con = + - @ o
 * tabulador, para que exportar y volver a importar no cambie el texto. */
export function uncell(s: string): string {
  return s.replace(/^'(?=[=+\-@\t\r])/, "");
}

/** Una celda segura para Excel y Sheets: entre comillas y sin formulas. */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(head: readonly string[], rows: Record<string, unknown>[]): string {
  return [head.join(","), ...rows.map((r) => head.map((k) => csvCell(r[k])).join(","))].join("\n") + "\n";
}
