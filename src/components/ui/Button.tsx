import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Boton del sistema. Tres variantes, un solo acento en el foco.
 * Se usa como <Button href> (Link o <a>) o como <Button type="submit">. */

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-900",
  ghost: "text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type LinkProps = Common & { href: string; external?: boolean } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
type NativeProps = Common & { href?: undefined; external?: undefined } & Omit<ComponentProps<"button">, "className" | "children">;

export default function Button(props: LinkProps | NativeProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const cls = buttonClass(variant, size, className);
  if (props.href !== undefined) {
    const { href, external, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
    void _v; void _s; void _c; void _ch;
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
        </a>
      );
    }
    // Las rutas de API (checkout de Stripe, etc.) no son paginas: un <Link> las
    // prefetcharia como RSC y crearia sesiones de checkout sin clic (H-42, 11 sep 2026).
    if (href.startsWith("/api/")) {
      return (
        <a href={href} className={cls}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, external: _e, ...rest } = props;
  void _v; void _s; void _c; void _ch; void _h; void _e;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
