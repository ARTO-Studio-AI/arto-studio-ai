import { NextRequest, NextResponse } from "next/server";
import { purgeOldRateLimits } from "@/lib/rate-limit";

/**
 * GET /api/cron/purge (H-40, 2026-09-13). Cron diario de Vercel (vercel.json,
 * 0 4 * * * UTC) que borra las ventanas de rate_limits mas viejas que 7 dias.
 * Sin esto la tabla crecia sin tope: una fila por key y por hora, para siempre.
 *
 * Auth igual que /api/cron/digest: Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 * Falla cerrado: sin CRON_SECRET configurado responde 401 y no toca la base.
 */

export const dynamic = "force-dynamic";

const PURGE_DAYS = 7;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await purgeOldRateLimits(PURGE_DAYS);
    console.log(JSON.stringify({ event: "rate_limits_purge", days: PURGE_DAYS, deleted }));
    return NextResponse.json({ ok: true, days: PURGE_DAYS, deleted });
  } catch (error) {
    console.error("[/api/cron/purge] purge failed:", error);
    return NextResponse.json({ ok: false, error: "purge failed" }, { status: 500 });
  }
}
