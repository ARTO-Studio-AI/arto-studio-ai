import type { Locale } from "@/i18n/config";

/* Testimonios: placeholder detras de SHOW_TESTIMONIALS (decision D8, 10 sep
 * 2026: no se inventan testimonios ni nombres). Con SHOW_TESTIMONIALS=false
 * (o ausente) no renderiza nada. Cuando haya testimonios reales, se cargan
 * aqui y se enciende la variable en Vercel. */

const SHOW = process.env.SHOW_TESTIMONIALS === "true";

const TESTIMONIALS: { quote: string; name: string; role: string }[] = [];

export default function Testimonials({ locale }: { locale: Locale }) {
  if (!SHOW) return null;
  const es = locale === "es";
  return (
    <section className="border-t border-zinc-200 py-16">
      <p className="text-eyebrow text-zinc-400">{es ? "Clientes" : "Clients"}</p>
      <h2 className="text-h2 mt-2">{es ? "Lo que dicen de trabajar con ARTO." : "What it is like to work with ARTO."}</h2>
      <span className="accent-rule mt-4" />
      {TESTIMONIALS.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-zinc-300 p-8 text-center">
          <p className="font-mono text-xs text-zinc-500">
            {es
              ? "Placeholder: aquí van testimonios de clientes reales. Ninguno todavía."
              : "Placeholder: real client testimonials go here. None yet."}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-6">
              <blockquote className="text-sm text-zinc-700">{t.quote}</blockquote>
              <figcaption className="mt-4 font-mono text-[11px] text-zinc-500">
                {t.name} · {t.role}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
