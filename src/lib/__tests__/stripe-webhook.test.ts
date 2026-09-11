import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  CLIENT_TRIAL_DEFAULTS,
  mapSubscriptionStatus,
  periodEndIso,
  processStripeEvent,
  type ClientPatch,
  type ClientRef,
  type ProfilePatch,
  type ProfileRef,
  type WebhookDeps,
} from "@/lib/stripe-webhook";

/* Dependencias en memoria: un perfil Pro-candidato, un client trial, y
 * registro de cada llamada para afirmar qué se tocó y qué no. */

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ID = "22222222-2222-4222-8222-222222222222";

interface Harness {
  deps: WebhookDeps;
  profiles: Map<string, ProfileRef & { patches: ProfilePatch[] }>;
  clients: Map<string, ClientRef & { patches: ClientPatch[] }>;
  events: Set<string>;
  emails: { to: string; name: string }[];
}

function harness(overrides: { profileTier?: string; subscriptionId?: string | null } = {}): Harness {
  const profiles = new Map<string, ProfileRef & { patches: ProfilePatch[] }>();
  const clients = new Map<string, ClientRef & { patches: ClientPatch[] }>();
  const events = new Set<string>();
  const emails: { to: string; name: string }[] = [];

  const subIndex = new Map<string, string>();
  const custIndex = new Map<string, string>();

  profiles.set(USER_ID, {
    id: USER_ID,
    email: "pro@example.com",
    tier: overrides.profileTier ?? "free",
    patches: [],
  });
  if (overrides.subscriptionId) subIndex.set(overrides.subscriptionId, USER_ID);
  custIndex.set("cus_test", USER_ID);

  clients.set(CLIENT_ID, {
    id: CLIENT_ID,
    name: "Ana Prueba",
    email: "ana@example.com",
    tier: "trial",
    notes: null,
    patches: [],
  });

  const deps: WebhookDeps = {
    async recordEvent(id) {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    async forgetEvent(id) {
      events.delete(id);
    },
    async findProfileById(id) {
      return profiles.get(id) ?? null;
    },
    async findProfileBySubscription(subscriptionId) {
      const id = subIndex.get(subscriptionId);
      return id ? (profiles.get(id) ?? null) : null;
    },
    async findProfileByCustomer(customerId) {
      const id = custIndex.get(customerId);
      return id ? (profiles.get(id) ?? null) : null;
    },
    async updateProfile(id, patch) {
      const p = profiles.get(id);
      if (!p) return false;
      p.patches.push(patch);
      if (patch.tier) p.tier = patch.tier;
      if (patch.stripe_subscription_id) subIndex.set(patch.stripe_subscription_id, id);
      return true;
    },
    async getClientById(id) {
      return clients.get(id) ?? null;
    },
    async updateClient(id, patch) {
      const c = clients.get(id);
      if (!c) return false;
      c.patches.push(patch);
      if (patch.tier) c.tier = patch.tier;
      return true;
    },
    async sendUpgradeConfirmationEmail(params) {
      emails.push(params);
      return true;
    },
    now: () => new Date("2026-09-11T10:00:00.000Z"),
  };

  return { deps, profiles, clients, events, emails };
}

function event<T extends object>(type: string, object: T, id = `evt_${type}_1`): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

const PERIOD_END = 1_760_000_000; // 2025-10-09T08:53:20Z

function subscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    customer: "cus_test",
    status: "active",
    cancel_at_period_end: false,
    ended_at: null,
    metadata: { user_id: USER_ID, tier: "pro" },
    items: { data: [{ current_period_end: PERIOD_END }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

describe("processStripeEvent", () => {
  it("checkout Pro con metadata.user_id activa el tier en profiles", async () => {
    const h = harness();
    const outcome = await processStripeEvent(
      event("checkout.session.completed", {
        id: "cs_pro",
        customer: "cus_test",
        subscription: "sub_test",
        client_reference_id: USER_ID,
        metadata: { user_id: USER_ID, tier: "pro" },
      }),
      h.deps
    );

    expect(outcome.status).toBe("processed");
    const profile = h.profiles.get(USER_ID)!;
    expect(profile.tier).toBe("pro");
    expect(profile.patches).toEqual([
      {
        tier: "pro",
        subscription_status: "active",
        stripe_customer_id: "cus_test",
        stripe_subscription_id: "sub_test",
      },
    ]);
    // La rama de clients no se toca aunque client_reference_id venga lleno.
    expect(h.clients.get(CLIENT_ID)!.patches).toHaveLength(0);
    expect(h.emails).toHaveLength(0);
  });

  it("checkout con metadata.client_id sigue subiendo el client a starter", async () => {
    const h = harness();
    const outcome = await processStripeEvent(
      event("checkout.session.completed", {
        id: "cs_starter",
        client_reference_id: CLIENT_ID,
        metadata: { client_id: CLIENT_ID, client_email: "ana@example.com" },
      }),
      h.deps
    );

    expect(outcome.status).toBe("processed");
    const client = h.clients.get(CLIENT_ID)!;
    expect(client.tier).toBe("starter");
    expect(client.patches[0]).toMatchObject({
      tier: "starter",
      trial_calls_limit: null,
      rate_limit_per_hour: 1000,
    });
    expect(client.patches[0].notes).toContain("cs_starter");
    expect(h.emails).toEqual([{ to: "ana@example.com", name: "Ana Prueba" }]);
    expect(h.profiles.get(USER_ID)!.patches).toHaveLength(0);
  });

  it("un evento repetido responde already_processed y no toca nada", async () => {
    const h = harness();
    const evt = event("checkout.session.completed", {
      id: "cs_pro",
      customer: "cus_test",
      subscription: "sub_test",
      metadata: { user_id: USER_ID, tier: "pro" },
    });

    const first = await processStripeEvent(evt, h.deps);
    const second = await processStripeEvent(evt, h.deps);

    expect(first.status).toBe("processed");
    expect(second.status).toBe("already_processed");
    expect(h.profiles.get(USER_ID)!.patches).toHaveLength(1);
  });

  it("si el handler falla, el evento se olvida para que Stripe reintente", async () => {
    const h = harness();
    h.deps.updateProfile = async () => false;
    const evt = event("checkout.session.completed", {
      id: "cs_pro",
      metadata: { user_id: USER_ID, tier: "pro" },
    });

    await expect(processStripeEvent(evt, h.deps)).rejects.toThrow();
    expect(h.events.has(evt.id)).toBe(false);
  });

  it("customer.subscription.deleted baja el perfil a free", async () => {
    const h = harness({ profileTier: "pro", subscriptionId: "sub_test" });
    const outcome = await processStripeEvent(
      event(
        "customer.subscription.deleted",
        subscription({ status: "canceled", ended_at: PERIOD_END })
      ),
      h.deps
    );

    expect(outcome.status).toBe("processed");
    const profile = h.profiles.get(USER_ID)!;
    expect(profile.tier).toBe("free");
    expect(profile.patches).toEqual([
      {
        tier: "free",
        subscription_status: "canceled",
        subscription_ends_at: new Date(PERIOD_END * 1000).toISOString(),
      },
    ]);
  });

  it("customer.subscription.updated con cancel_at_period_end no baja el tier", async () => {
    const h = harness({ profileTier: "pro", subscriptionId: "sub_test" });
    const outcome = await processStripeEvent(
      event("customer.subscription.updated", subscription({ cancel_at_period_end: true })),
      h.deps
    );

    expect(outcome.status).toBe("processed");
    const profile = h.profiles.get(USER_ID)!;
    expect(profile.tier).toBe("pro");
    expect(profile.patches).toHaveLength(1);
    expect(profile.patches[0].tier).toBeUndefined();
    expect(profile.patches[0]).toMatchObject({
      subscription_status: "active",
      stripe_subscription_id: "sub_test",
      stripe_customer_id: "cus_test",
      subscription_ends_at: new Date(PERIOD_END * 1000).toISOString(),
    });
  });

  it("customer.subscription.updated activa Pro si el checkout no llegó", async () => {
    const h = harness({ profileTier: "free" });
    await processStripeEvent(
      event("customer.subscription.updated", subscription()),
      h.deps
    );
    expect(h.profiles.get(USER_ID)!.tier).toBe("pro");
  });

  it("invoice.payment_failed marca past_due sin cortar el acceso", async () => {
    const h = harness({ profileTier: "pro", subscriptionId: "sub_test" });
    const outcome = await processStripeEvent(
      event("invoice.payment_failed", {
        id: "in_test",
        customer: "cus_test",
        parent: { subscription_details: { subscription: "sub_test" } },
      }),
      h.deps
    );

    expect(outcome.status).toBe("processed");
    const profile = h.profiles.get(USER_ID)!;
    expect(profile.tier).toBe("pro");
    expect(profile.patches).toEqual([{ subscription_status: "past_due" }]);
  });

  it("customer.subscription.deleted de un client lo regresa a trial", async () => {
    const h = harness();
    h.clients.get(CLIENT_ID)!.tier = "starter";
    const outcome = await processStripeEvent(
      event(
        "customer.subscription.deleted",
        subscription({
          id: "sub_client",
          customer: "cus_client",
          status: "canceled",
          metadata: { client_id: CLIENT_ID, client_email: "ana@example.com" },
        })
      ),
      h.deps
    );

    expect(outcome.status).toBe("processed");
    const client = h.clients.get(CLIENT_ID)!;
    expect(client.tier).toBe("trial");
    expect(client.patches[0]).toMatchObject({ tier: "trial", ...CLIENT_TRIAL_DEFAULTS });
    expect(h.profiles.get(USER_ID)!.patches).toHaveLength(0);
  });

  it("eventos desconocidos se registran y se responden como unhandled", async () => {
    const h = harness();
    const outcome = await processStripeEvent(event("charge.refunded", { id: "ch_1" }), h.deps);
    expect(outcome.status).toBe("unhandled");
    expect(h.events.has("evt_charge.refunded_1")).toBe(true);
  });
});

describe("helpers", () => {
  it("mapSubscriptionStatus respeta el check constraint de profiles", () => {
    expect(mapSubscriptionStatus("active")).toBe("active");
    expect(mapSubscriptionStatus("trialing")).toBe("active");
    expect(mapSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapSubscriptionStatus("unpaid")).toBe("past_due");
    expect(mapSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapSubscriptionStatus("incomplete")).toBe("inactive");
    expect(mapSubscriptionStatus("paused")).toBe("inactive");
  });

  it("periodEndIso lee current_period_end en la suscripción o en el item", () => {
    expect(periodEndIso(subscription())).toBe(new Date(PERIOD_END * 1000).toISOString());
    const legacy = subscription({ items: { data: [] } } as unknown as Partial<Stripe.Subscription>);
    (legacy as unknown as { current_period_end: number }).current_period_end = PERIOD_END + 60;
    expect(periodEndIso(legacy)).toBe(new Date((PERIOD_END + 60) * 1000).toISOString());
    expect(periodEndIso(subscription({ items: { data: [] } } as unknown as Partial<Stripe.Subscription>))).toBeNull();
  });
});
