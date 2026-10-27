import Link from "next/link";
import { Badge } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { priceLabel } from "@/lib/edit-bundle/access";
import { demoOf, type EditSkill } from "@/lib/edit-bundle/catalog";
import DemoVideo from "./DemoVideo";

/* Tarjeta de un skill del ARTO Edit Bundle #1: demo en loop, nombre, una linea y la
 * etiqueta de precio segun la fecha (Victor, 27 oct 2026). Toda la tarjeta lleva a la pagina del skill. */

interface Props {
  skill: EditSkill;
  locale: Locale;
  t: Dictionary["edit_bundle"];
  now?: Date;
}

export default function SkillCard({ skill, locale, t, now = new Date() }: Props) {
  const demo = demoOf(skill.slug);
  const label = priceLabel(now) === "free" ? t.label_free : t.label_pro;
  return (
    <Link
      href={`/${locale}/skills/${skill.slug}`}
      className="group block rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <DemoVideo video={demo.video} poster={demo.poster} label={skill.name[locale]} missingLabel={t.demo_missing} />
      <div className="mt-3 flex items-start justify-between gap-2 px-1">
        <h3 className="font-bold leading-tight">{skill.name[locale]}</h3>
        <Badge tone={label === t.label_pro ? "inverse" : "live"}>{label}</Badge>
      </div>
      <p className="mt-1 px-1 pb-1 text-sm text-zinc-500">{skill.tagline[locale]}</p>
    </Link>
  );
}
