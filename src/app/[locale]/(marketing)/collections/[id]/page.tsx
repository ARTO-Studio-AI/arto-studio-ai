import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Lang } from "@/lib/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { AI_GROUPS, CATEGORY_STYLES, DIFFICULTY_STYLES, TIER_STYLES, VERTICALS, aiGroupOf, type Prompt } from "@/types/prompt";
import RemovePromptButton from "./RemovePromptButton";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export const dynamic = "force-dynamic";

export default async function CollectionDetail({ params }: Props) {
  const { locale: localeParam, id } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const lang: Lang = locale;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/collections/${id}`);

  const { data: collection } = await sb
    .from("collections")
    .select("id, name, description, prompt_ids, is_public, user_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!collection) notFound();

  const isOwner = collection.user_id === user.id;
  if (!isOwner && !collection.is_public) notFound();

  const promptIds: string[] = (collection.prompt_ids as string[]) ?? [];
  let prompts: Prompt[] = [];
  if (promptIds.length > 0) {
    const { data } = await sb
      .from("prompts")
      .select("id, title_en, title_es, category, subcategory, ai_model, difficulty, tier, tags, is_featured")
      .in("id", promptIds);
    const order = new Map(promptIds.map((pid, i) => [pid, i]));
    prompts = ((data ?? []) as Prompt[]).sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  const labels = lang === "es"
    ? {
        back: "← Volver a colecciones",
        empty: "Esta colección está vacía. Agrega prompts desde el catálogo o desde la página de detalle de cada prompt.",
        prompts: prompts.length === 1 ? "1 prompt" : `${prompts.length} prompts`,
      }
    : {
        back: "← Back to collections",
        empty: "This collection is empty. Add prompts from the catalog or from individual prompt pages.",
        prompts: prompts.length === 1 ? "1 prompt" : `${prompts.length} prompts`,
      };

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <Link href={`/${locale}/collections`} className="text-sm text-zinc-500 hover:text-zinc-900">
        {labels.back}
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">{labels.prompts}</span>
          <span className={`rounded-full px-2 py-0.5 ${collection.is_public ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>
            {collection.is_public ? (lang === "es" ? "Pública" : "Public") : (lang === "es" ? "Privada" : "Private")}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{collection.name}</h1>
        {collection.description && (
          <p className="mt-2 text-zinc-600">{collection.description}</p>
        )}
      </header>

      {prompts.length === 0 ? (
        <p className="mt-12 text-zinc-500">{labels.empty}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((p) => {
            const title = lang === "es" ? p.title_es : p.title_en;
            const cat = CATEGORY_STYLES[p.category];
            const diff = DIFFICULTY_STYLES[p.difficulty];
            const tier = TIER_STYLES[p.tier];
            const aiInfo = AI_GROUPS[aiGroupOf(p.ai_model)];
            return (
              <li key={p.id} className="relative">
                <Link
                  href={`/${locale}/prompts/${p.id}`}
                  className="block h-full rounded-lg border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-400">{p.id}</span>
                    <span className={`rounded-full ${tier.chip} px-2 py-0.5 text-[11px] font-medium`}>
                      {tier.label}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-medium">{title}</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`rounded-full ${cat.chip} px-2 py-0.5 font-medium`}>{VERTICALS[p.category].label_en}</span>
                    <span className={`rounded-full ${diff.chip} px-2 py-0.5`}>{diff.label}</span>
                    <span className={`rounded-full ${aiInfo.chip} px-2 py-0.5`}>{aiInfo.label}</span>
                  </div>
                </Link>
                {isOwner && (
                  <div className="absolute right-2 top-2">
                    <RemovePromptButton collectionId={collection.id as string} promptId={p.id} lang={lang} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
