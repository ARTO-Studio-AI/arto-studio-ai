import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Tarjeta del sistema (marca ASAI v2.0): superficie blanca, linea --line, radio 16, letra negra.
 * `interactive` agrega el hover: sube 2px y sombra. `highlight` pone borde negro de 2px.
 * `tone` blue o dark cambia el fondo (letra blanca siempre). Con `href` se vuelve Link. */

interface Props {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  highlight?: boolean;
  /** Fondo: blanco (por omision), azul ultramar con letra blanca o negro con letra blanca. */
  tone?: "white" | "blue" | "dark";
  padding?: "none" | "sm" | "md" | "lg";
  href?: string;
  as?: "div" | "article" | "section" | "li";
}

const PAD = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };

const TONE = {
  white: "bg-white text-black",
  blue: "asai-blue bg-[var(--accent)] text-white",
  dark: "asai-dark bg-black text-white",
};

export function cardClass({ interactive = false, highlight = false, tone = "white", padding = "md", className = "" }: Omit<Props, "children" | "href" | "as">): string {
  return [
    "rounded-[var(--radius-lg)]",
    TONE[tone],
    tone !== "white" ? "border border-transparent" : highlight ? "border-2 border-black" : "border border-[var(--line)]",
    interactive ? "transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]" : "",
    PAD[padding],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function Card({ children, href, as = "div", ...rest }: Props) {
  const cls = cardClass({ ...rest, interactive: rest.interactive ?? !!href });
  if (href) {
    return (
      <Link href={href} className={`block ${cls}`}>
        {children}
      </Link>
    );
  }
  const Tag = as;
  return <Tag className={cls}>{children}</Tag>;
}

export type CardProps = ComponentProps<typeof Card>;
