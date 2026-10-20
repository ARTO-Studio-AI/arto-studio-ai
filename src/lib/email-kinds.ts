/* Correos que se pueden previsualizar y probar desde /admin/emails (2026-10-20). Victor
 * pidio poder revisar cada correo con su diseno real antes de que salga, sin depender de
 * que Code se los mande: cada uno se previsualiza y se manda de prueba por el mismo
 * camino que usa el sitio (Resend, remitente EMAIL_FROM). */

export const EMAIL_KINDS = [
  { id: "welcome", label: "Bienvenida a la lista", note: "Sale a quien marca la casilla de promociones (registro o Brand Roast). Su contenido se edita aquí." },
  { id: "roast", label: "Reporte del roast", note: "Sale a quien deja su correo para ver el análisis completo. La vista previa usa un roast de ejemplo." },
  { id: "digest", label: "Resumen semanal", note: "Sale los martes a las 16:00 de Madrid a toda la lista. La vista previa usa cinco prompts de ejemplo; el envío real sortea cinco que nunca se han mandado." },
  { id: "confirm", label: "Confirmación de la lista", note: "Doble opt-in: sale al marcar la casilla en el roast o en una lista de espera. En la prueba el botón lleva al sitio y no confirma nada." },
  { id: "auth_magic", label: "Enlace de acceso", note: "Lo manda Supabase al pedir entrar. La prueba sale con el diseño del repositorio, que es el que se sube a Supabase; el botón lleva al sitio." },
  { id: "auth_signup", label: "Confirmación de registro", note: "Lo manda Supabase al crear una cuenta. Igual que el enlace de acceso: la prueba muestra el diseño que se sube." },
] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number]["id"];

export function isEmailKind(v: unknown): v is EmailKind {
  return typeof v === "string" && EMAIL_KINDS.some((k) => k.id === v);
}
