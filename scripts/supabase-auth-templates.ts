/* Sube al panel de Supabase las plantillas de acceso de src/lib/email-templates/supabase-auth.ts
 * (enlace magico y confirmacion de registro), por la Management API.
 *
 *   npx tsx scripts/supabase-auth-templates.ts            # solo escribe los HTML en /tmp para revisar
 *   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... npx tsx scripts/supabase-auth-templates.ts --apply
 *
 * Antes de --apply guarda en /tmp lo que habia en el panel, para poder volver atras. */
import { writeFileSync } from "fs";
import { supabaseAuthTemplate } from "../src/lib/email-templates/supabase-auth";

const apply = process.argv.includes("--apply");
const magic = supabaseAuthTemplate("magic_link");
const confirm = supabaseAuthTemplate("confirmation");
writeFileSync("/tmp/supabase-magic-link.html", magic.html);
writeFileSync("/tmp/supabase-confirmation.html", confirm.html);
console.log("Escritos /tmp/supabase-magic-link.html y /tmp/supabase-confirmation.html");

async function main() {
  if (!apply) return;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) throw new Error("Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF");
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const before = await fetch(url, { headers });
  if (!before.ok) throw new Error(`GET ${before.status}`);
  const cfg = (await before.json()) as Record<string, unknown>;
  const backup = `/tmp/supabase-auth-backup-${Date.now()}.json`;
  writeFileSync(
    backup,
    JSON.stringify(
      {
        mailer_subjects_magic_link: cfg.mailer_subjects_magic_link,
        mailer_templates_magic_link_content: cfg.mailer_templates_magic_link_content,
        mailer_subjects_confirmation: cfg.mailer_subjects_confirmation,
        mailer_templates_confirmation_content: cfg.mailer_templates_confirmation_content,
      },
      null,
      2,
    ),
  );
  console.log(`Respaldo: ${backup}`);
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      mailer_subjects_magic_link: magic.subject,
      mailer_templates_magic_link_content: magic.html,
      mailer_subjects_confirmation: confirm.subject,
      mailer_templates_confirmation_content: confirm.html,
    }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);
  console.log("Plantillas actualizadas en Supabase.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
