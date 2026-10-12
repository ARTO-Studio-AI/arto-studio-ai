import { createAdminClient } from "@/lib/supabase/admin";
import { guardAdmin, PageHead } from "../../_kit";
import PromptEditor from "../PromptEditor";

/* /admin/catalogo/nuevo: alta manual. El ID sale solo por vertical y el prompt nace como
 * no disponible, salvo que se marque lo contrario. */

export const dynamic = "force-dynamic";

export default async function NuevoPrompt() {
  await guardAdmin();
  const { data: subs } = await createAdminClient().from("prompts").select("subcategory").limit(5000);
  const subcategories = [...new Set(((subs ?? []) as { subcategory: string }[]).map((s) => s.subcategory))].sort();
  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Nuevo prompt" />
      <PromptEditor initial={null} subcategories={subcategories} />
    </div>
  );
}
