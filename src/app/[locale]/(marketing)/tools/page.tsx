import Link from "next/link";
import { notFound } from "next/navigation";
import { AI_GROUPS, AI_TOOLS, AI_TOOLS_UPDATED, type AiGroup } from "@/types/prompt";
import { isLocale, type Locale } from "@/i18n/config";
import { Badge, Button, Card } from "@/components/ui";

export const metadata = {
  title: "AI Tools Reference — ARTO Studio AI",
  description: "Reference catalog of generative AI tools, grouped by output modality.",
};

const ORDER: AiGroup[] = ["text", "image", "video", "music", "voice", "any"];

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ToolsPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const byGroup = ORDER.map((g) => ({
    group: g,
    meta: AI_GROUPS[g],
    tools: AI_TOOLS.filter((t) => t.group === g),
  }));
  const updated = new Date(`${AI_TOOLS_UPDATED}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="max-w-3xl">
        <p className="text-eyebrow text-zinc-500">Reference</p>
        <h1 className="text-h1 mt-3">AI Tools</h1>
        <span className="accent-rule mt-4" />
        <p className="mt-4 text-zinc-600">
          The generative AI tools we recommend, grouped by what they output. Use this as a
          quick lookup when you need to pick the right tool for a prompt, or to discover
          alternatives for any tool you already use.
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          {AI_TOOLS.length} tools · {ORDER.length} groups · {locale === "es" ? "Última actualización" : "Last updated"}: {updated}
        </p>
      </header>

      {byGroup.map(({ group, meta, tools }) => (
        <section key={group} className="mt-12">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{meta.label}</h2>
            <Badge tone="neutral">{tools.length}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <Card key={t.key} as="article" padding="sm" interactive={false} className="transition hover:border-zinc-400">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{t.label}</h3>
                  {t.status === "deprecating" && <Badge tone="soon">Deprecating</Badge>}
                  {t.status === "preview" && <Badge tone="live">Preview</Badge>}
                </div>
                <p className="mt-2 text-sm text-zinc-600">{t.description}</p>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-block font-mono text-xs text-zinc-500 hover:text-zinc-900 hover:underline"
                  >
                    {new URL(t.url).hostname.replace(/^www\./, "")} →
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}

      <Card as="section" className="mt-16">
        <h3 className="text-eyebrow text-zinc-500">About this list</h3>
        <p className="mt-3 text-sm text-zinc-700">
          This catalog is a reference, not a filter. When you browse the prompt catalog, each
          prompt shows the broad <em>group</em> (Text, Image, Video, Music, Voice, Any) it works
          best with, plus the specific tool we tested it on. Most prompts are model-agnostic; the
          tool field is a recommendation, not a requirement.
        </p>
        <p className="mt-3 text-sm text-zinc-700">
          The landscape changes fast. We update this list whenever a model ships a new generation,
          and we mark tools that are sunsetting (like Sora) so you can plan around them.
        </p>
        <Button href={`/${locale}/prompts`} className="mt-4">Browse the catalog →</Button>
        <Link href={`/${locale}/learn`} className="ml-4 text-sm text-zinc-500 hover:text-zinc-900">Guides →</Link>
      </Card>
    </div>
  );
}
