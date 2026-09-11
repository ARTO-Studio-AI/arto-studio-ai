import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Badge, Button } from "@/components/ui";
import { projects } from "./projects";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "en";
  const dict = getDictionary(locale).work;
  return {
    title: dict.meta_title,
    description: dict.meta_description,
  };
}

// Get unique categories and years for filters
const allYears = [...new Set(projects.map((p) => p.year))]
  .filter((y) => y !== "Por definir")
  .sort()
  .reverse();

export default async function WorkPage({ params }: PageProps) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).work;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  return (
    <>
      {/* Header */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="text-eyebrow mb-2 text-zinc-400">{t.eyebrow}</p>
          <h1 className="text-h1">{t.h1}</h1>
          <span className="accent-rule mt-4" />
          <p className="mt-4 max-w-xl text-lg text-zinc-500">{t.sub}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {allYears.map((year) => (
              <Badge key={year} tone="neutral">{year}</Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="font-mono text-3xl font-bold">{projects.length}+</p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_projects}</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold">
                {new Set(projects.map((p) => p.client)).size}+
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_clients}</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold">
                {allYears.length > 1
                  ? `${allYears[allYears.length - 1]}–${allYears[0]}`
                  : allYears[0]}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_years}</p>
            </div>
            <div>
              <p className="font-mono text-3xl font-bold">
                {new Set(projects.map((p) => p.industry)).size}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t.stat_industries}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Project Grid */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-8 md:grid-cols-2">
            {projects.map((project, i) => (
              <article
                key={project.slug}
                className="group overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white transition hover:border-zinc-400 hover:shadow-[var(--shadow-sm)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
                  <Image
                    src={project.image}
                    alt={`${project.name}, ${project.client}`}
                    fill
                    sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw"
                    priority={i < 2}
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-zinc-400">
                    <span>{project.year}</span>
                    <span>{project.location}</span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight transition-colors group-hover:text-zinc-600">
                    {project.name}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-zinc-500">{project.client}</p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-500 line-clamp-3">{project.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {project.categories.slice(0, 3).map((cat) => (
                      <Badge key={cat} tone="neutral" mono={false}>{cat}</Badge>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-200 bg-zinc-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-h2">{t.cta_h2}</h2>
          <span className="accent-rule mx-auto mt-4" />
          <p className="mt-4 text-lg text-zinc-400">{t.cta_body}</p>
          <Button href={lp("/prompts")} size="lg" className="mt-8 bg-white text-zinc-900 hover:bg-zinc-100">
            {t.cta_button}
          </Button>
        </div>
      </section>
    </>
  );
}
