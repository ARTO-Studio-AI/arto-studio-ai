"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track, type AnalyticsEvent, type AnalyticsEvents } from "@/lib/analytics";

/* <Link> que manda un evento tipado al hacer clic. Para CTAs de componentes de
 * servidor (PromptLimitReached) que no pueden tener onClick. */

export default function TrackedLink<E extends AnalyticsEvent>({
  event,
  props,
  href,
  className,
  children,
}: {
  event: E;
  props: AnalyticsEvents[E];
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => track(event, props)}>
      {children}
    </Link>
  );
}
