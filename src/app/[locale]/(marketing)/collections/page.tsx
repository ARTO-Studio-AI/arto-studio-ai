import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { t, type Lang } from "@/lib/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import CreateCollectionForm from "./CreateCollectionForm";

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = "force-dynamic";

export default async function CollectionsPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const lang: Lang = locale;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/collections`);

  const { data: collections } = await sb
    .from("collections")
    .select("id, name, description, prompt_ids, is_public, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const labels = lang === "es"
    ? {
        title: "Mis colecciones",
        subtitle: "Agrupa prompts en sets curados — por proyecto, cliente o workflow.",
        empty: "Aún no tienes colecciones. Crea la primera abajo.",
        prompts: (n: number) => `${n} prompt${n === 1 ? "" : "s"}`,
        public: "Pública",
        private: "Privada",
        view: "Abrir →",
      }
    : {
        title: "My collections",
        subtitle: "Group prompts into curated sets — by project, client, or workflow.",
        empty: "No collections yet. Create your first below.",
        prompts: (n: number) => `${n} prompt${n === 1 ? "" : "s"}`,
        public: "Public",
        private: "Private",
        view: "Open →",
      };

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{labels.title}</h1>
        <p className="mt-2 text-zinc-600">{labels.subtitle}</p>
      </header>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-5">
        <CreateCollectionForm lang={lang} />
      </div>

      {(!collections || collections.length === 0) ? (
        <p className="mt-12 text-zinc-500">{labels.empty}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const promptCount = Array.isArray(c.prompt_ids) ? c.prompt_ids.length : 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/${locale}/collections/${c.id}`}
                  className="block h-full rounded-lg border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                      {labels.prompts(promptCount)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${c.is_public ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                      {c.is_public ? labels.public : labels.private}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-semibold">{c.name}</h3>
                  {c.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{c.description}</p>
                  )}
                  <p className="mt-4 text-xs text-zinc-500">{labels.view}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
