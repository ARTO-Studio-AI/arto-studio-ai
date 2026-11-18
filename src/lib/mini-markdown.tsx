import type { ReactNode } from "react";

/* Markdown minimo y seguro para las paginas de detalle de /mods (18 nov 2026). El texto viene
 * del repo (src/content/mods/*.md), copiado de la pagina publica aprobada en Notion.
 *
 * Soporta: encabezados #, ##, ###; parrafos; listas con - y 1.; tablas con |; bloques ```;
 * linea ---; y en linea **negrita**, `codigo`, <b>, <code>, enlaces [texto](https://...).
 * Todo se arma como elementos de React, asi que cualquier otro HTML sale escapado como texto.
 * Solo se enlazan URLs http(s) o rutas internas que empiezan con "/". */

export type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "code"; lang: string; text: string }
  | { type: "hr" };

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    const fence = t.match(/^```(\w*)$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "```") body.push(lines[i++]);
      i++;
      blocks.push({ type: "code", lang: fence[1], text: body.join("\n") });
      continue;
    }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      i++;
      continue;
    }
    if (/^-{3,}$/.test(t)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (t.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      blocks.push({ type: "table", rows });
      continue;
    }
    const ul = /^[-*]\s+/;
    const ol = /^\d+\.\s+/;
    if (ul.test(t) || ol.test(t)) {
      const kind = ul.test(t) ? "ul" : "ol";
      const re = kind === "ul" ? ul : ol;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i].trim())) items.push(lines[i++].trim().replace(re, ""));
      blocks.push({ type: kind, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\||[-*]\s|\d+\.\s|-{3,}$)/.test(lines[i].trim())) para.push(lines[i++].trim());
    if (para.length === 0) {
      para.push(t);
      i++;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

function safeHref(url: string): string | null {
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^\/[^/\s][^\s]*$/.test(url) || url === "/") return url;
  return null;
}

/* Tokens en linea. Se recorren en orden; lo que no es token queda como texto (escapado por React). */
const INLINE = /<b>([\s\S]*?)<\/b>|<code>([\s\S]*?)<\/code>|\*\*([\s\S]+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function inline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const clean = text.replace(/\\([~*_`[\]()#|-])/g, "$1");
  let last = 0;
  let n = 0;
  for (const m of clean.matchAll(INLINE)) {
    if (m.index! > last) out.push(clean.slice(last, m.index));
    const k = `${keyPrefix}-${n++}`;
    if (m[1] !== undefined || m[3] !== undefined) out.push(<strong key={k}>{inline(m[1] ?? m[3], k)}</strong>);
    else if (m[2] !== undefined || m[4] !== undefined)
      out.push(
        <code key={k} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-zinc-800">
          {m[2] ?? m[4]}
        </code>,
      );
    else {
      const href = safeHref(m[6]);
      if (href) {
        const external = href.startsWith("http");
        out.push(
          <a key={k} href={href} className="underline underline-offset-2 hover:text-[var(--accent)]" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {inline(m[5], k)}
          </a>,
        );
      } else out.push(m[5]);
    }
    last = m.index! + m[0].length;
  }
  if (last < clean.length) out.push(clean.slice(last));
  return out;
}

/** Texto plano de un fragmento con marcas (para comparar encabezados o sacar el titulo). */
export function plain(text: string): string {
  return text.replace(/<\/?(b|code)>/g, "").replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

interface RenderOptions {
  /** Algo que se pinta justo despues de un encabezado (por ejemplo, el boton de descarga). */
  afterHeading?: (text: string) => ReactNode;
}

export function MiniMarkdown({ blocks, options = {} }: { blocks: Block[]; options?: RenderOptions }) {
  return (
    <div className="grid gap-4 text-zinc-700">
      {blocks.map((b, idx) => {
        const k = `b${idx}`;
        switch (b.type) {
          case "h": {
            const extra = options.afterHeading?.(plain(b.text));
            const cls = b.level === 1 ? "text-h1" : b.level === 2 ? "mt-8 text-xl font-bold text-black" : "mt-4 text-lg font-bold text-black";
            const H = b.level === 1 ? "h1" : b.level === 2 ? "h2" : "h3";
            return (
              <div key={k}>
                <H className={cls}>{inline(b.text, k)}</H>
                {extra}
              </div>
            );
          }
          case "p":
            return <p key={k}>{inline(b.text, k)}</p>;
          case "ul":
            return (
              <ul key={k} className="grid list-disc gap-2 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${k}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} className="grid list-decimal gap-2 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it, `${k}-${j}`)}</li>
                ))}
              </ol>
            );
          case "table": {
            const [head, ...rows] = b.rows;
            return (
              <div key={k} className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  {head && head.some((c) => c) && (
                    <thead>
                      <tr>
                        {head.map((c, j) => (
                          <th key={j} className="border-b border-zinc-300 py-2 pr-4 text-left font-bold text-black">
                            {inline(c, `${k}-h${j}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((c, j) => (
                          <td key={j} className="border-b border-zinc-200 py-2 pr-4 align-top">
                            {inline(c, `${k}-${ri}-${j}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "code":
            return (
              <pre key={k} className="overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
                <code>{b.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={k} className="border-zinc-200" />;
        }
      })}
    </div>
  );
}
