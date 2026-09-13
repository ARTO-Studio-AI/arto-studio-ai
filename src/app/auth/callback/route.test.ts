import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* H-46: el callback con un code valido redirige a `next` solo si es una ruta del
 * mismo origin. Supabase y la captacion se mockean: aqui solo importa el Location. */

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => ({
        error: code === "valido" ? null : { message: "invalid flow state" },
      }),
      getUser: async () => ({ data: { user: null } }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/prompt-limit", () => ({ adoptOpens: vi.fn() }));
vi.mock("@/lib/analytics-server", () => ({ captureServer: vi.fn() }));
vi.mock("@/lib/resend-audience", () => ({ splitName: vi.fn(), upsertAudienceContact: vi.fn() }));

const SITE = "https://creative.artostudio.ai";

async function locationFor(query: string): Promise<string> {
  const { GET } = await import("./route");
  const res = await GET(new NextRequest(`http://127.0.0.1:3000/auth/callback?${query}`));
  return res.headers.get("location") ?? "";
}

describe("GET /auth/callback", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = SITE;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  });

  it("con code valido respeta una ruta interna", async () => {
    expect(await locationFor("code=valido&next=%2Fes%2Faccount%3Fx%3D1")).toBe(`${SITE}/es/account?x=1`);
  });

  it.each([".evil.com", "@evil.com", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)"])(
    "con code valido y next=%j se queda en el origin",
    async (next) => {
      const location = await locationFor(`code=valido&next=${encodeURIComponent(next)}`);
      expect(location).toBe(`${SITE}/`);
      expect(new URL(location).origin).toBe(SITE);
    },
  );

  it("con code invalido manda a login sin tocar next", async () => {
    const location = await locationFor("code=invalido&next=%40evil.com");
    expect(new URL(location).origin).toBe(SITE);
    expect(new URL(location).pathname).toBe("/login");
  });
});
