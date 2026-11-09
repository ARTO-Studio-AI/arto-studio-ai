import { buttonClass } from "@/components/ui";
import Button from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { accessFor } from "@/lib/catalogo/access";
import { getCatalog } from "@/lib/catalogo/efectivo";
import { isProTier, type Viewer } from "@/lib/edit-bundle/access";
import { EDIT_BUNDLE_SLUG } from "@/lib/edit-bundle/catalog";

/* Boton de descarga del ARTO Edit Bundle #1 con la regla de Victor del 27 oct 2026:
 *   sin sesion             -> crear cuenta o entrar, y regresa a esta misma pagina
 *   gratis en promocion    -> descarga
 *   gratis desde el 1 dic -> a Pro (pricing)
 *   Pro                    -> descarga siempre
 * La pagina solo decide que boton pintar; quien da o niega el archivo es la ruta
 * /api/skill-downloads/[slug], que vuelve a revisar todo en el servidor.
 * Desde el 2026-11-05 la regla sale de la categoria del skill (src/lib/catalogo/access.ts), y
 * lo que no esta publicado (coming_soon) pinta «Disponible muy pronto» sin enlace. El estado es
 * el efectivo (manifiesto + /admin/skills), el mismo que revisa la ruta de descarga. */

interface Props {
  locale: Locale;
  slug: string;
  viewer: Viewer;
  t: Dictionary["edit_bundle"];
  size?: "md" | "lg";
  now?: Date;
}

export default async function DownloadCta({ locale, slug, viewer, t, size = "lg", now = new Date() }: Props) {
  const catalog = await getCatalog();
  const item = catalog.getDownloadItem(slug);
  if (!item) {
    return (
      <div>
        <button type="button" disabled className={buttonClass("primary", size)}>
          {t.cta_soon}
        </button>
      </div>
    );
  }
  const isBundle = slug === EDIT_BUNDLE_SLUG;
  const access = accessFor(item.access, viewer, now);
  const back = `/${locale}${item.pagePath}`;

  if (access === "signin") {
    return (
      <div>
        <Button href={`/${locale}/login?next=${encodeURIComponent(back)}`} size={size}>
          {isBundle ? t.cta_signup_bundle : t.cta_signup}
        </Button>
        <p className="mt-2 text-xs text-zinc-500">{t.note_signin} {t.cta_signin_hint}</p>
      </div>
    );
  }

  if (access === "upgrade") {
    return (
      <div>
        <Button href={`/${locale}/pricing`} size={size}>
          {t.cta_upgrade}
        </Button>
        <p className="mt-2 text-xs text-zinc-500">{item.access === "edit-bundle-1" ? t.note_upgrade : t.note_upgrade_pro}</p>
      </div>
    );
  }

  const note = viewer.signedIn && isProTier(viewer.tier) ? t.note_pro : t.note_free_promo;
  if (!catalog.packageAvailable(slug)) {
    return (
      <div>
        <button type="button" disabled className={buttonClass("primary", size)}>
          {t.cta_soon}
        </button>
        <p className="mt-2 text-xs text-zinc-500">{note}</p>
      </div>
    );
  }

  return (
    <div>
      {/* <a> plano: las rutas /api/ no se prefetchean (H-42). Sin atributo download: si la sesion
       * caduca o pasa el corte, el 302 a login o pricing tiene que navegar, no bajarse como archivo
       * (auditoria de Fable). Content-Disposition: attachment ya fuerza la descarga. */}
      <a href={`/api/skill-downloads/${slug}?locale=${locale}`} className={buttonClass("primary", size)}>
        {isBundle ? t.cta_download_bundle : t.cta_download_skill}
      </a>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  );
}
