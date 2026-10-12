import { distinctValues } from "@/lib/catalog-server";
import { guardAdmin, PageHead } from "../../_kit";
import PromptEditor from "../PromptEditor";

/* /admin/catalogo/nuevo: alta manual. El ID sale solo por vertical y el prompt nace como
 * no disponible, salvo que se marque lo contrario. */

export const dynamic = "force-dynamic";

export default async function NuevoPrompt({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardAdmin();
  // Desde /admin/busquedas llega la busqueda que el catalogo no cubre, como idea.
  const sp = await searchParams;
  const idea = typeof sp.idea === "string" ? sp.idea.slice(0, 1500) : "";
  const subcategories = await distinctValues("subcategory");
  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Nuevo prompt" />
      <PromptEditor initial={null} subcategories={subcategories} initialIdea={idea} />
    </div>
  );
}
