import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { isLocale } from "@/i18n/config";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getDictionary } from "@/i18n/dictionaries";
import { Button } from "@/components/ui";

/* 404 dentro de [locale] con el personaje ARTO. El segmento not-found no recibe
 * params, asi que el idioma se lee de la URL (cabecera de Next) y cae a "en". */
export default async function LocaleNotFound() {
  const h = await headers();
  const path = h.get("x-invoke-path") ?? h.get("next-url") ?? h.get("referer") ?? "";
  const seg = path.replace(/^https?:\/\/[^/]+/, "").split("/").filter(Boolean)[0];
  const locale = isLocale(seg) ? seg : "en";
  const dict = getDictionary(locale);
  const es = locale === "es";
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <Nav user={null} locale={locale} nav={dict.nav} />
      </header>
      <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center px-6 py-24 text-center">
        <Image src="/brand/arto-character-01.png" alt="ARTO" width={160} height={151} className="h-auto w-36" priority />
        <p className="text-eyebrow mt-8 text-zinc-400">404</p>
        <h1 className="text-h1 mt-2">{es ? "Esta página no existe." : "This page does not exist."}</h1>
        <span className="accent-rule mx-auto mt-4" />
        <p className="mt-4 max-w-md text-zinc-600">
          {es
            ? "Puede que el enlace esté viejo o que el prompt haya cambiado de ID. La biblioteca sigue ahí."
            : "The link may be stale or the prompt may have a new ID. The library is still there."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href={`/${locale}/prompts`}>{es ? "Ir a la biblioteca" : "Go to the library"}</Button>
          <Button href={`/${locale}`} variant="secondary">{es ? "Inicio" : "Home"}</Button>
        </div>
        <Link href="/roast" className="mt-6 text-sm text-zinc-500 hover:text-zinc-900">
          {es ? "O prueba el Brand Roast gratis →" : "Or try the free Brand Roast →"}
        </Link>
      </main>
      <Footer locale={locale} footer={dict.footer} />
    </div>
  );
}
