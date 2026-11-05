"use client";

import { formatCountdown } from "@/lib/promo";
import { useRemaining } from "./promo-store";

/* Reloj HH:MM:SS de la promo. role="timer" no anuncia cada segundo al lector de
 * pantalla (aria-live implicito "off"); el texto se lee al llegar a el. */
export default function PromoClock({ endsAt, className = "" }: { endsAt: number | null; className?: string }) {
  const remaining = useRemaining(endsAt);
  if (remaining === null) return null;
  return (
    <span role="timer" className={`font-mono tabular-nums ${className}`}>
      {formatCountdown(remaining)}
    </span>
  );
}
