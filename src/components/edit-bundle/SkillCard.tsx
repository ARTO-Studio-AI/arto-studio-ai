import Link from "next/link";
import { Badge } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { priceLabelFor } from "@/lib/catalogo/access";
import { accessOf, demoOf, type CatalogSkill } from "@/lib/catalogo/skills";
import DemoVideo from "./DemoVideo";

/* Tarjeta de un skill del ARTO Edit Bundle #1: demo en loop, nombre, una linea y la
 * etiqueta de precio segun la fecha (Victor, 27 oct 2026). Toda la tarjeta lleva a la pagina del skill.
 * Desde el 2026-11-05 sirve a cualquier skill del catalogo: la etiqueta sale de la regla de su
 * categoria, y un skill en coming_soon dice «Muy pronto». */

interface Props {
  skill: CatalogSkill;
  locale: Locale;
  t: Dictionary["edit_bundle"];
  now?: Date;
  /** Texto de la etiqueta para coming_soon. */
  soonLabel?: string;
}

export default function SkillCard({ skill, locale, t, now = new Date(), soonLabel = t.cta_soon }: Props) {
  const demo = demoOf(skill.slug);
  const soon = skill.status === "coming_soon";
  const price = priceLabelFor(accessOf(skill.slug) ?? "pro", now) === "free" ? t.label_free : t.label_pro;
  const label = soon ? soonLabel : price;
  return (
    <Link
      href={`/${locale}/skills/${skill.slug}`}
      className="group block rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <DemoVideo video={demo.video} poster={demo.poster} label={skill.name[locale]} missingLabel={t.demo_missing} />
      <div className="mt-3 flex items-start justify-between gap-2 px-1">
        <h3 className="font-bold leading-tight">{skill.name[locale]}</h3>
        <Badge tone={soon ? "soon" : label === t.label_pro ? "inverse" : "live"}>{label}</Badge>
      </div>
      <p className="mt-1 px-1 pb-1 text-sm text-zinc-500">{skill.tagline[locale]}</p>
    </Link>
  );
}
