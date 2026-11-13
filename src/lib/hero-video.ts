/* Video corto del hero de la home (decision de Victor, 11 nov 2026): loop de 6 a 10 s de SonIA o
 * de Victor. Todavia no hay toma aprobada. Mientras esta ruta este vacia, el hero muestra el
 * corredor con la tarjeta azul del prompt del dia (como el mockup de la marca v2.0).
 * Para encenderlo: sube el MP4 (H.264, sin audio, menos de 3 MB) a public/video/ y pon aqui su
 * ruta, por ejemplo "/video/hero-sonia.mp4". */
export const HERO_VIDEO_SRC = "";

/** Poster del video y respaldo con prefers-reduced-motion: el corredor lima sobre negro. */
export const HERO_VIDEO_POSTER = "/brand/asai/simbolo-lima.svg";

/** Indice del prompt del dia: cambia una vez al dia (UTC) y recorre la lista en orden. */
export function promptOfTheDayIndex(total: number, now: Date = new Date()): number {
  if (total <= 0) return -1;
  const day = Math.floor(now.getTime() / 86_400_000);
  return day % total;
}
