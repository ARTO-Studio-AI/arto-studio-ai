import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TutorialCover from "@/components/TutorialCover";
import { Badge, Card } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { localeOf, pageMetadata } from "@/lib/seo";
import {
  TUTORIALS_UI,
  TUTORIAL_TOOLS,
  filterTutorials,
  getAllTutorials,
  isTutorialTool,
  toolsInUse,
  tutorialPromptIds,
} from "@/lib/tutorials";

/* Indice de tutoriales (2026-11-05, D28). El filtro por herramienta son enlaces con ?tool=,
 * asi funciona sin JS. El canonical no lleva el query (seo.ts lo quita). */

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("tutorials", localeOf(locale));
}

export default async function TutorialsIndex({ params, searchParams }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = TUTORIALS_UI[locale];
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  const sp = await searchParams;
  const rawTool = Array.isArray(sp.tool) ? sp.tool[0] : sp.tool;
  const active = isTutorialTool(rawTool) ? rawTool : null;

  const all = getAllTutorials();
  const tools = toolsInUse(all);
  const list = filterTutorials(all, active);

  const chip = (on: boolean) =>
    `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
      on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900"
    }`;

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-eyebrow text-zinc-500">{t.eyebrow}</p>
      <h1 className="text-h1 mt-3">{t.h1}</h1>
      <span className="accent-rule mt-4" />
      <p className="mt-4 max-w-2xl text-zinc-700">{t.sub}</p>

      <nav aria-label={t.filter_label} className="mt-10 flex flex-wrap items-center gap-2">
        <span className="text-eyebrow mr-1 text-zinc-500">{t.filter_label}</span>
        <Link href={lp("/tutoriales")} className={chip(active === null)} aria-current={active === null ? "page" : undefined}>
          {t.filter_all}
        </Link>
        {tools.map((tool) => (
          <Link
            key={tool}
            href={lp(`/tutoriales?tool=${tool}`)}
            className={chip(active === tool)}
            aria-current={active === tool ? "page" : undefined}
          >
            {TUTORIAL_TOOLS[tool].label}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">{t.empty}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tut) => {
            const c = tut.copy[locale];
            const promptCount = tutorialPromptIds(tut).length;
            return (
              <Card key={tut.slug} href={lp(`/tutoriales/${tut.slug}`)} padding="none" className="group overflow-hidden">
                <div className="flex h-full flex-col">
                  <TutorialCover code={tut.code} word={c.coverWord} steps={tut.steps.length} className="border-b border-zinc-200" />
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-eyebrow text-zinc-500">
                      {t.level[tut.level]} · {tut.readingMinutes} {t.minutes}
                    </p>
                    <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-[-0.02em] text-zinc-900">{c.title}</h2>
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{c.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {tut.tools.map((tool) => (
                        <Badge key={tool}>{TUTORIAL_TOOLS[tool].label}</Badge>
                      ))}
                    </div>
                    <p className="mt-auto flex items-center justify-between pt-5 text-xs font-medium text-zinc-500 group-hover:text-zinc-900">
                      <span>{t.prompts_count(promptCount)}</span>
                      <span>{t.read}</span>
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
