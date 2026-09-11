import LocaleNotFound from "./[locale]/not-found";

/* 404 global. Las URLs que no casan con ninguna ruta (por ejemplo /en/lo-que-sea)
 * caen aqui, no en [locale]/not-found.tsx, que solo atiende los notFound() lanzados
 * dentro del segmento (prompt inexistente, locale invalido). Misma pantalla. */
export default LocaleNotFound;
