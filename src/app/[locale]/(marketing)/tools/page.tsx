import type { Metadata } from "next";
import Link from "next/link";
import { AI_GROUPS, AI_TOOLS, type AiGroup } from "@/types/prompt";
import { localeOf, pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("tools", localeOf(locale));
}

const ORDER: AiGroup[] = ["text", "image", "video", "music", "voice", "any"];

export default function ToolsPage() {
  const byGroup = ORDER.map((g) => ({
    group: g,
    meta: AI_GROUPS[g],
    tools: AI_TOOLS.filter((t) => t.group === g),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Reference
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">AI Tools</h1>
        <p className="mt-3 text-neutral-600">
          The generative AI tools we recommend, grouped by what they output. Use this as a
          quick lookup when you need to pick the right tool for a prompt — or to discover
          alternatives for any tool you already use.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          {AI_TOOLS.length} tools · {ORDER.length} groups · landscape evolves fast, ping us if a tool is missing
        </p>
      </header>

      {byGroup.map(({ group, meta, tools }) => (
        <section key={group} className="mt-12">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{meta.label}</h2>
            <span className={`rounded-full ${meta.chip} px-2 py-0.5 text-[11px] font-medium`}>
              {tools.length}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <article
                key={t.key}
                className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{t.label}</h3>
                  {t.status === "deprecating" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Deprecating
                    </span>
                  )}
                  {t.status === "preview" && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      Preview
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-neutral-600">{t.description}</p>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-block text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
                  >
                    {new URL(t.url).hostname.replace(/^www\./, "")} →
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="mt-16 rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
          About this list
        </h3>
        <p className="mt-3 text-sm text-neutral-700">
          This catalog is a reference, not a filter — when you browse the prompt catalog, each
          prompt shows the broad <em>group</em> (Text, Image, Video, Music, Voice, Any) it works
          best with, plus the specific tool we tested it on. Most prompts are model-agnostic; the
          tool field is a recommendation, not a requirement.
        </p>
        <p className="mt-3 text-sm text-neutral-700">
          The landscape changes fast. We update this list whenever a model ships a new generation,
          and we mark tools that are sunsetting (like Sora) so you can plan around them.
        </p>
        <Link
          href="/prompts"
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Browse the catalog →
        </Link>
      </section>
    </div>
  );
}
