import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/login`);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    return NextResponse.redirect(`${SITE_URL}/pricing`);
  }

  const stripe = getStripe();
  if (!stripe) return NextResponse.redirect(`${SITE_URL}/pricing?error=stripe_not_configured`);
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id as string,
    return_url: `${SITE_URL}/account`,
  });

  return NextResponse.redirect(session.url, { status: 303 });
}
