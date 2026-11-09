import { downloadAccess, isPromoActive, isProTier, priceLabel, type DownloadAccess, type Viewer } from "@/lib/edit-bundle/access";
import type { AccessPolicy } from "./skills";

/* Regla de descarga segun la categoria (2026-11-05). Logica pura, sin base ni red.
 *
 *  edit-bundle-1  delega TAL CUAL en src/lib/edit-bundle/access.ts (decision de Victor del
 *                 27 oct 2026). Este archivo no la cambia ni la duplica.
 *  pro            solo Pro y Enterprise, sin promocion. Es la regla que recibe una categoria
 *                 nueva: abrir descargas gratis es decision de Victor, no del script.
 *  cuenta         cualquier cuenta con sesion, siempre (ARTO Anima, 6 nov 2026). Sin sesion
 *                 pide entrar; nunca entrega a un visitante sin cuenta. */

export function accessFor(policy: AccessPolicy, viewer: Viewer, now: Date = new Date()): DownloadAccess {
  if (policy === "edit-bundle-1") return downloadAccess(viewer, now);
  if (!viewer.signedIn) return "signin";
  if (policy === "cuenta") return "download";
  return isProTier(viewer.tier) ? "download" : "upgrade";
}

/** Etiqueta de la tarjeta: "free" para el bundle en promocion, "account" para la regla cuenta; lo demas es "pro". */
export function priceLabelFor(policy: AccessPolicy, now: Date = new Date()): "free" | "pro" | "account" {
  if (policy === "cuenta") return "account";
  return policy === "edit-bundle-1" ? priceLabel(now) : "pro";
}

/** true si la descarga gratis de esta regla sigue vigente (solo el bundle tiene promocion). */
export function promoFor(policy: AccessPolicy, now: Date = new Date()): boolean {
  return policy === "edit-bundle-1" && isPromoActive(now);
}
