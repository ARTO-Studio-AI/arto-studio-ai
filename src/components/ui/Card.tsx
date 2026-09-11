import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Tarjeta del sistema: superficie blanca, linea zinc-200, radio 16.
 * `interactive` agrega el hover de elevacion; con `href` se vuelve Link. */

interface Props {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  highlight?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  href?: string;
  as?: "div" | "article" | "section" | "li";
}

const PAD = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };

export function cardClass({ interactive = false, highlight = false, padding = "md", className = "" }: Omit<Props, "children" | "href" | "as">): string {
  return [
    "rounded-[var(--radius-lg)] bg-white",
    highlight ? "border-2 border-zinc-900" : "border border-zinc-200",
    interactive ? "transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[var(--shadow-md)]" : "",
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
