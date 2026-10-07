# Fuentes del sitio

Variables woff2, subconjunto latin, bajadas de Google Fonts el 2026-10-07. Todas con licencia SIL Open Font License 1.1, que permite alojarlas y distribuirlas con el sitio.

| Archivo | Familia | Pesos | Rol |
|---|---|---|---|
| `Manrope-latin-var.woff2` | Manrope | 600-800 | Titulares y scores |
| `InterTight-latin-var.woff2` | Inter Tight | 400-700 | Texto corrido |
| `Geist-latin-var.woff2` | Geist | 400-600 | Menú, etiquetas, IDs |
| `CormorantGaramond-latin-var.woff2` / `-Italic-` | Cormorant Garamond | 500-600 | Palabra clave, citas, frase del roast |

Se alojan aquí para que el build no dependa de la red (ver `src/app/layout.tsx`). Si se necesita otro peso o subconjunto (por ejemplo `latin-ext`), se baja de la misma API y se agrega en `layout.tsx`.
