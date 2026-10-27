import { buttonClass } from "@/components/ui";
import Button from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { downloadAccess, isProTier, type Viewer } from "@/lib/edit-bundle/access";
import { EDIT_BUNDLE_SLUG, getDownloadItem, packageAvailable, type DownloadSlug } from "@/lib/edit-bundle/catalog";

/* Boton de descarga del ARTO Edit Bundle #1 con la regla de Victor del 27 oct 2026:
 *   sin sesion             -> crear cuenta o entrar, y regresa a esta misma pagina
 *   gratis en promocion    -> descarga
 *   gratis despues del 3 nov -> a Pro (pricing)
 *   Pro                    -> descarga siempre
 * La pagina solo decide que boton pintar; quien da o niega el archivo es la ruta
 * /api/skill-downloads/[slug], que vuelve a revisar todo en el servidor. */

interface Props {
  locale: Locale;
  slug: DownloadSlug;
  viewer: Viewer;
  t: Dictionary["edit_bundle"];
  size?: "md" | "lg";
  now?: Date;
}

export default function DownloadCta({ locale, slug, viewer, t, size = "lg", now = new Date() }: Props) {
  const item = getDownloadItem(slug);
  if (!item) return null;
  const isBundle = slug === EDIT_BUNDLE_SLUG;
  const access = downloadAccess(viewer, now);
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
        <p className="mt-2 text-xs text-zinc-500">{t.note_upgrade}</p>
      </div>
    );
  }

  const note = viewer.signedIn && isProTier(viewer.tier) ? t.note_pro : t.note_free_promo;
  if (!packageAvailable(slug)) {
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
      {/* <a> plano: las rutas /api/ no se prefetchean (H-42). */}
      <a href={`/api/skill-downloads/${slug}?locale=${locale}`} className={buttonClass("primary", size)} download>
        {isBundle ? t.cta_download_bundle : t.cta_download_skill}
      </a>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  );
}
