"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent, type AnalyticsEvents } from "@/lib/analytics";

/* Dispara un evento tipado al montar. Lo usan las paginas de servidor que ya
 * saben lo que paso (prompt abierto, tope alcanzado, pricing visto) y no tienen
 * un clic que lo dispare. Las props se serializan para que el efecto corra una
 * vez por combinacion real, no por identidad de objeto. */

export default function TrackOnMount<E extends AnalyticsEvent>({
  event,
  props,
}: {
  event: E;
  props: AnalyticsEvents[E];
}) {
  const serialized = JSON.stringify(props);
  useEffect(() => {
    track(event, JSON.parse(serialized) as AnalyticsEvents[E]);
  }, [event, serialized]);
  return null;
}
