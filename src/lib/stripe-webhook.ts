import type Stripe from "stripe";

/**
 * Lógica del webhook de Stripe, separada de la ruta HTTP para poder probarla
 * con eventos falsos y dependencias en memoria (ver src/lib/__tests__).
 *
 * Dos modelos de datos conviven en el mismo webhook:
 *   - `profiles` (usuarios de Supabase Auth): plan Pro. El checkout manda
 *     metadata.user_id y metadata.tier='pro'.
 *   - `clients` (API keys, flujo Starter legacy): el checkout manda
 *     metadata.client_id.
 *
 * Idempotencia: cada evento se registra en `stripe_events` antes de
 * procesarlo. Si ya estaba, se responde "already_processed" sin tocar nada.
 * Si el handler falla, se borra el registro para que el reintento de Stripe
 * vuelva a procesarlo.
 */

export type ProfileSubscriptionStatus = "active" | "inactive" | "canceled" | "past_due";
export type ProfileTier = "free" | "pro";

export interface ProfileRef {
  id: string;
  tier: string;
  stripe_subscription_id: string | null;
}

export interface ProfilePatch {
  tier?: ProfileTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: ProfileSubscriptionStatus;
  subscription_ends_at?: string | null;
}

export interface ClientRef {
  id: string;
  name: string;
  email: string;
  tier: string;
  notes: string | null;
}

export interface ClientPatch {
  tier?: "trial" | "starter";
  trial_calls_limit?: number | null;
  rate_limit_per_hour?: number;
  notes?: string;
}

export interface WebhookDeps {
  /** Registra el evento. Devuelve false si ya estaba registrado. */
  recordEvent(id: string, type: string): Promise<boolean>;
  /** Borra el registro para permitir el reintento tras un fallo. */
  forgetEvent(id: string): Promise<void>;
  findProfileById(id: string): Promise<ProfileRef | null>;
  findProfileBySubscription(subscriptionId: string): Promise<ProfileRef | null>;
  findProfileByCustomer(customerId: string): Promise<ProfileRef | null>;
  updateProfile(id: string, patch: ProfilePatch): Promise<boolean>;
  getClientById(id: string): Promise<ClientRef | null>;
  updateClient(id: string, patch: ClientPatch): Promise<boolean>;
  sendUpgradeConfirmationEmail(params: { to: string; name: string }): Promise<boolean>;
  now?: () => Date;
}

export interface WebhookOutcome {
  status: "processed" | "already_processed" | "ignored" | "unhandled";
  detail?: string;
}

/** Valores con los que nace un client en /api/signup (TRIAL_CALLS=5, rate 100). */
export const CLIENT_TRIAL_DEFAULTS = { trial_calls_limit: 5, rate_limit_per_hour: 100 } as const;

export async function processStripeEvent(
  event: Stripe.Event,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const isNew = await deps.recordEvent(event.id, event.type);
  if (!isNew) {
    log("stripe_webhook_duplicate", { type: event.type, id: event.id });
    return { status: "already_processed" };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleCheckoutCompleted(event.data.object, deps);
      case "customer.subscription.created":
      case "customer.subscription.updated":
        return await handleSubscriptionUpdated(event.data.object, deps);
      case "customer.subscription.deleted":
        return await handleSubscriptionDeleted(event.data.object, deps);
      case "invoice.payment_failed":
        return await handleInvoicePaymentFailed(event.data.object, deps);
      default:
        log("stripe_webhook_unhandled", { type: event.type, id: event.id });
        return { status: "unhandled" };
    }
  } catch (err) {
    // Que el reintento de Stripe pueda volver a entrar.
    await deps.forgetEvent(event.id).catch(() => undefined);
    throw err;
  }
}

/* ── checkout.session.completed ─────────────────────────────────────── */

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const userId = session.metadata?.user_id?.trim();
  if (userId) return activateProfileFromCheckout(session, userId, deps);
  return upgradeClientFromCheckout(session, deps);
}

async function activateProfileFromCheckout(
  session: Stripe.Checkout.Session,
  userId: string,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const tier = session.metadata?.tier;
  if (tier !== "pro") {
    log("stripe_webhook_ignored", {
      reason: "unknown_profile_tier",
      tier,
      session_id: session.id,
    });
    return { status: "ignored", detail: `tier ${tier ?? "missing"} not handled` };
  }

  const profile = await deps.findProfileById(userId);
  if (!profile) {
    console.warn("[stripe/webhook] profile not found for checkout", {
      session_id: session.id,
      user_id: userId,
    });
    return { status: "ignored", detail: "profile not found" };
  }

  const patch: ProfilePatch = { tier: "pro", subscription_status: "active" };
  const customerId = refId(session.customer);
  const subscriptionId = refId(session.subscription);
  if (customerId) patch.stripe_customer_id = customerId;
  if (subscriptionId) patch.stripe_subscription_id = subscriptionId;

  const ok = await deps.updateProfile(userId, patch);
  if (!ok) throw new Error(`profiles update failed for ${userId}`);

  log("profile_upgraded_to_pro", {
    user_id: userId,
    session_id: session.id,
    subscription_id: subscriptionId,
  });
  return { status: "processed" };
}

async function upgradeClientFromCheckout(
  session: Stripe.Checkout.Session,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const clientId =
    session.metadata?.client_id ||
    (session.client_reference_id ? String(session.client_reference_id) : "");

  if (!clientId) {
    console.warn("[stripe/webhook] checkout.session.completed without client_id", {
      session_id: session.id,
    });
    return { status: "ignored", detail: "no client_id" };
  }

  const client = await deps.getClientById(clientId);
  if (!client) {
    console.warn("[stripe/webhook] client not found for session", {
      session_id: session.id,
      client_id: clientId,
    });
    return { status: "ignored", detail: "client not found" };
  }

  const ok = await deps.updateClient(clientId, {
    tier: "starter",
    trial_calls_limit: null, // sin límite
    rate_limit_per_hour: 1000,
    notes: appendNote(
      client.notes,
      `Upgraded via Stripe checkout session ${session.id} at ${nowIso(deps)}`
    ),
  });

  log("client_upgraded_to_starter", {
    client_id: clientId,
    session_id: session.id,
    ok,
  });

  // Sin await: el webhook responde rápido y el correo va aparte.
  void deps.sendUpgradeConfirmationEmail({ to: client.email, name: client.name });
  return { status: "processed" };
}

/* ── customer.subscription.updated / created ────────────────────────── */

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const profile = await findProfileForSubscription(sub, deps);
  if (!profile) {
    const clientId = sub.metadata?.client_id;
    log("stripe_webhook_ignored", {
      reason: clientId ? "client_subscription_update" : "profile_not_found",
      subscription_id: sub.id,
      client_id: clientId,
      stripe_status: sub.status,
    });
    return { status: "ignored", detail: "no profile for subscription" };
  }
  if (isStaleSubscription(profile, sub)) return ignoreStale(profile, sub);

  const status = mapSubscriptionStatus(sub.status);
  const patch: ProfilePatch = {
    subscription_status: status,
    stripe_subscription_id: sub.id,
    subscription_ends_at: periodEndIso(sub),
  };
  const customerId = refId(sub.customer);
  if (customerId) patch.stripe_customer_id = customerId;

  // Si el checkout.session.completed llegó tarde o se perdió, la suscripción
  // activa con metadata.tier='pro' basta para activar el plan.
  if (profile.tier === "free" && status === "active" && sub.metadata?.tier === "pro") {
    patch.tier = "pro";
  }

  // cancel_at_period_end=true NO baja el tier: el usuario pagó hasta el fin
  // del periodo. La bajada llega con customer.subscription.deleted.
  const ok = await deps.updateProfile(profile.id, patch);
  if (!ok) throw new Error(`profiles update failed for ${profile.id}`);

  log("profile_subscription_synced", {
    user_id: profile.id,
    subscription_id: sub.id,
    stripe_status: sub.status,
    subscription_status: status,
    cancel_at_period_end: sub.cancel_at_period_end,
    subscription_ends_at: patch.subscription_ends_at,
    tier: patch.tier ?? profile.tier,
  });
  return { status: "processed" };
}

/* ── customer.subscription.deleted ──────────────────────────────────── */

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const profile = await findProfileForSubscription(sub, deps);
  if (profile) {
    if (isStaleSubscription(profile, sub)) return ignoreStale(profile, sub);
    const ok = await deps.updateProfile(profile.id, {
      tier: "free",
      subscription_status: "canceled",
      subscription_ends_at: endedAtIso(sub) ?? periodEndIso(sub),
    });
    if (!ok) throw new Error(`profiles update failed for ${profile.id}`);
    log("profile_downgraded_to_free", {
      user_id: profile.id,
      subscription_id: sub.id,
    });
    return { status: "processed" };
  }

  const clientId = sub.metadata?.client_id?.trim();
  if (clientId) {
    const client = await deps.getClientById(clientId);
    if (!client) {
      console.warn("[stripe/webhook] client not found for deleted subscription", {
        subscription_id: sub.id,
        client_id: clientId,
      });
      return { status: "ignored", detail: "client not found" };
    }
    // Vuelve a como nace un client en /api/signup. trial_calls_used se
    // conserva: si ya gastó su trial antes de pagar, sigue gastado.
    const ok = await deps.updateClient(clientId, {
      tier: "trial",
      ...CLIENT_TRIAL_DEFAULTS,
      notes: appendNote(
        client.notes,
        `Subscription ${sub.id} canceled at ${nowIso(deps)}; back to trial`
      ),
    });
    log("client_downgraded_to_trial", {
      client_id: clientId,
      subscription_id: sub.id,
      ok,
    });
    return { status: "processed" };
  }

  log("stripe_webhook_ignored", {
    reason: "no_owner_for_deleted_subscription",
    subscription_id: sub.id,
  });
  return { status: "ignored", detail: "no owner for subscription" };
}

/* ── invoice.payment_failed ─────────────────────────────────────────── */

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  deps: WebhookDeps
): Promise<WebhookOutcome> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = refId(invoice.customer);

  let profile: ProfileRef | null = null;
  if (subscriptionId) profile = await deps.findProfileBySubscription(subscriptionId);
  if (!profile && customerId) profile = await deps.findProfileByCustomer(customerId);

  if (!profile) {
    log("stripe_webhook_ignored", {
      reason: "profile_not_found_for_failed_invoice",
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      customer_id: customerId,
    });
    return { status: "ignored", detail: "no profile for invoice" };
  }

  // Acceso intacto: solo marcamos el estado. Stripe reintenta el cobro y,
  // si agota los intentos, manda customer.subscription.deleted.
  const ok = await deps.updateProfile(profile.id, { subscription_status: "past_due" });
  if (!ok) throw new Error(`profiles update failed for ${profile.id}`);

  log("profile_payment_failed", {
    user_id: profile.id,
    invoice_id: invoice.id,
    subscription_id: subscriptionId,
  });
  return { status: "processed" };
}

/* ── helpers ────────────────────────────────────────────────────────── */

async function findProfileForSubscription(
  sub: Stripe.Subscription,
  deps: WebhookDeps
): Promise<ProfileRef | null> {
  const bySub = await deps.findProfileBySubscription(sub.id);
  if (bySub) return bySub;
  const userId = sub.metadata?.user_id?.trim();
  if (userId) {
    const byId = await deps.findProfileById(userId);
    if (byId) return byId;
  }
  const customerId = refId(sub.customer);
  if (customerId) return deps.findProfileByCustomer(customerId);
  return null;
}

/**
 * Auditoría de Fable (11-sep-2026): si el perfil ya está ligado a otra
 * suscripción (p. ej. canceló sub_old y volvió a pagar con sub_new), los
 * eventos rezagados de la vieja no pueden bajarlo a free ni pisar su id.
 * Solo se sincroniza la suscripción que el perfil tiene registrada.
 */
function isStaleSubscription(profile: ProfileRef, sub: Stripe.Subscription): boolean {
  return Boolean(profile.stripe_subscription_id) && profile.stripe_subscription_id !== sub.id;
}

function ignoreStale(profile: ProfileRef, sub: Stripe.Subscription): WebhookOutcome {
  log("stripe_subscription_stale_ignored", {
    user_id: profile.id,
    profile_subscription_id: profile.stripe_subscription_id,
    event_subscription_id: sub.id,
  });
  return { status: "ignored", detail: "stale subscription" };
}

export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status | string
): ProfileSubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // incomplete, paused, o valores nuevos de Stripe.
      return "inactive";
  }
}

/** Fin del periodo vigente. En API 2025-03+ vive en cada item; antes, en la suscripción. */
export function periodEndIso(sub: Stripe.Subscription): string | null {
  const legacy = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const ts = typeof legacy === "number" ? legacy : fromItem;
  return typeof ts === "number" ? new Date(ts * 1000).toISOString() : null;
}

function endedAtIso(sub: Stripe.Subscription): string | null {
  return typeof sub.ended_at === "number" ? new Date(sub.ended_at * 1000).toISOString() : null;
}

/** invoice.subscription (API vieja) o invoice.parent.subscription_details.subscription (nueva). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: unknown }).subscription;
  const fromLegacy = refId(legacy);
  if (fromLegacy) return fromLegacy;
  const parent = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: unknown } | null } | null;
  }).parent;
  return refId(parent?.subscription_details?.subscription);
}

function refId(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function appendNote(existing: string | null, note: string): string {
  return (existing ? existing + "\n" : "") + note;
}

function nowIso(deps: WebhookDeps): string {
  return (deps.now ? deps.now() : new Date()).toISOString();
}

function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...fields }));
}
