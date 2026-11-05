"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { priceView, type PromoOffer } from "@/lib/promos/tipos";
import PromoClock from "./PromoClock";

/* Piezas que se ven de una promo (5 nov 2026): la barra de abajo, la tarjeta de la ventana
 * y el precio de /pricing. Solo pintan; la logica (cuando salen, eventos, foco) vive en
 * SignupBarClient, PromoModal y PromoPrice. /admin/promociones usa estas mismas piezas para
 * la vista previa, asi lo que se revisa es exactamente lo que sale. */

type PromoDict = Dictionary["promo"];

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** La barra oscura (sin la posicion fija), con promo o con la invitacion de siempre. */
export function BarCard({
  title,
  sub,
  href,
  cta,
  ctaShort,
  closeLabel,
  onCta,
  onClose,
}: {
  title: ReactNode;
  sub: ReactNode;
  href: string;
  cta: string;
  ctaShort: string;
  closeLabel: string;
  onCta?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="animate-fade-in pointer-events-auto mx-auto flex max-w-3xl items-center gap-2.5 rounded-[var(--radius-md)] bg-zinc-900 py-2.5 pl-4 pr-2 text-white shadow-[0_10px_30px_rgba(24,24,27,0.28)] sm:gap-4 sm:py-3 sm:pl-5">
      <span aria-hidden="true" className="hidden h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] sm:inline-block" />
      <div className="min-w-0 flex-1">
        {title}
        {sub}
      </div>
      <Link
        href={href}
        onClick={onCta}
        className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110 focus-visible:outline-white sm:px-4"
      >
        <span className="sm:hidden">{ctaShort}</span>
        <span className="hidden sm:inline">{cta}</span>
      </Link>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-white"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** Contenido de la barra en modo promo: titulo de la promo y su reloj. */
export function PromoBarText({ offer, dict, endsAt }: { offer: PromoOffer; dict: PromoDict; endsAt: number | null }) {
  return (
    <>
      <p className="text-sm font-semibold leading-snug">{offer.copy.title}</p>
      <p className="text-xs text-zinc-300">
        {dict.ends_in} <PromoClock endsAt={endsAt} className="font-semibold text-[var(--accent)]" />
      </p>
    </>
  );
}

/** Tarjeta blanca de la ventana grande. */
export function PromoModalCard({
  offer,
  dict,
  features,
  endsAt,
  href,
  onCta,
  onClose,
  dialogRef,
  asDialog = false,
}: {
  offer: PromoOffer;
  dict: PromoDict;
  features: readonly string[];
  endsAt: number | null;
  href: string;
  onCta?: () => void;
  onClose?: () => void;
  dialogRef?: Ref<HTMLDivElement>;
  /** true en el sitio (role=dialog); false en la vista previa de /admin. */
  asDialog?: boolean;
}) {
  const price = priceView(offer, dict);
  const ids = asDialog ? { title: "promo-modal-title", sub: "promo-modal-sub" } : { title: undefined, sub: undefined };
  return (
    <div
      ref={dialogRef}
      {...(asDialog ? { role: "dialog", "aria-modal": true, "aria-labelledby": ids.title, "aria-describedby": ids.sub } : {})}
      className="animate-fade-in relative max-h-[70vh] w-full overflow-y-auto rounded-t-[var(--radius-md)] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-10px_30px_rgba(24,24,27,0.2)] sm:max-w-md sm:rounded-[var(--radius-md)] sm:p-7 sm:shadow-[0_20px_50px_rgba(24,24,27,0.3)]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={dict.close_modal}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        <CloseIcon />
      </button>

      <p className="text-eyebrow text-zinc-500">{price.eyebrow}</p>
      <h2 id={ids.title} className="mt-1 pr-8 text-xl font-bold tracking-tight sm:text-2xl">
        {offer.copy.title}
      </h2>
      <p id={ids.sub} className="mt-2 text-sm text-zinc-600">
        {offer.copy.subtitle}
      </p>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {price.strike && <s className="font-mono text-lg text-zinc-400">{price.strike}</s>}
        <span className="font-mono text-3xl font-bold tracking-tight">{price.now}</span>
        <span className="font-mono text-xs text-zinc-500">
          {price.strike ? "USD " : ""}
          {price.unit}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-700">
        {dict.time_left} <PromoClock endsAt={endsAt} className="font-semibold text-zinc-900" />
      </p>

      <ul className="mt-4 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <span className="text-zinc-600">{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <Link
          href={href}
          data-autofocus
          onClick={onCta}
          className="flex-1 rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          {offer.copy.cta}
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-[var(--radius-sm)] border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 transition hover:border-zinc-500"
        >
          {dict.keep_browsing}
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-zinc-500">{price.then}</p>
    </div>
  );
}

/** Precio de Pro en /pricing con la promo: insignia, precio tachado, reloj y letra pequena. */
export function PromoPriceView({ offer, dict, endsAt }: { offer: PromoOffer; dict: PromoDict; endsAt: number | null }) {
  const price = priceView(offer, dict);
  return (
    <div>
      <p className="mb-1 inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-950">
        {offer.copy.badge}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        {price.strike && <s className="font-mono text-lg text-zinc-400">{price.strike}</s>}
        <span className="font-mono text-3xl font-bold tracking-tight">{price.now}</span>
        <span className="font-mono text-xs text-zinc-500">
          {price.strike ? "USD " : ""}
          {price.unit}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-700">
        {dict.ends_in} <PromoClock endsAt={endsAt} className="font-semibold text-zinc-900" />
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">{price.then}</p>
    </div>
  );
}
