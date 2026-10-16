# Propuesta: invitar una sola vez a quien ya está en la lista de espera

> 2026-10-16 · PR `fix/waitlist-pack-consentimiento` · **Propuesta, no se ejecuta sin el go de Victor.**
> Nada de esto se ha corrido contra producción: ni el conteo.
> v2 tras la auditoría de Fable del mismo día (ver «Por qué no un botón de confirmar en el correo»).

## El problema

Las filas de `waitlist` anteriores a este PR se guardaron sin casilla de promociones y sin
enlace al aviso de privacidad. Esas personas pidieron **un aviso**: el día que abra Skills
Studio (hoy el Pack ARTO) o Agentes. El formulario les prometía «Nada más». No aceptaron
promociones, así que no pueden entrar a `newsletter_subscribers` ni recibir la campaña.

## Qué se propone

Un solo correo, **cuando el Pack abra**, que sea exactamente el aviso que pidieron y que lleve
a la página del Pack. Ahí está la casilla nueva (sin marcar, con doble opt-in): quien quiera
promociones la marca igual que cualquier visitante nuevo, y su prueba de consentimiento es la
misma.

1. **A quién.** Filas de `waitlist` con `created_at` anterior al deploy de este PR,
   `marketing_opt_in = false`, y cuyo correo **no** esté en `newsletter_subscribers` con
   ningún estado. Quien se dio de baja o rebotó no recibe nada; quien ya está activo no
   necesita el aviso como invitación.
2. **Qué dice.** Asunto tipo «Ya abrió el Pack ARTO». Qué es, precio y botón a
   `/es/skills?utm_source=waitlist&utm_medium=email&utm_campaign=apertura-pack` (así se mide
   en /admin/canales). Pie con por qué le llega («te anotaste para que te avisáramos»),
   enlace al aviso de privacidad (LFPDPPP pide informar y estas filas nunca lo vieron) y enlace
   para que lo borremos de la lista de espera.
3. **Qué no hace.** No crea filas `pending` ni tokens en `newsletter_subscribers`, no lleva
   botón de «confirma promociones» y no se repite.
4. **Una sola vez.** El script marca a quién ya se le mandó (columna nueva `notified_at` en
   `waitlist`, migración aditiva aparte) y se niega a mandar dos veces al mismo correo.
5. **Correo.** Plantilla nueva en `src/lib/email-templates/` (pasa por Fable: es correo), en
   español por defecto: las filas viejas no guardaron idioma.
6. **Herramienta.** `scripts/waitlist-aviso-apertura.ts` con `--dry-run` por defecto que solo
   imprime el conteo y tres correos enmascarados; mandar exige `--enviar --prod`, deja registro
   y manda por Resend con pausa entre envíos.

## Por qué no un botón de confirmar en el correo

La primera versión de esta propuesta metía en el aviso un bloque de «¿quieres también
promociones? Confírmalo aquí». Fable lo señaló: en la lectura del RGPD y de la ICO del Reino
Unido, pedir el consentimiento por correo ya es una solicitud de marketing, y meterla en un
correo de servicio a gente a la que se le prometió «Nada más» es justo lo que no conviene.
Llevarlos a la página con la casilla da el mismo resultado sin ese riesgo.

## Consulta para el conteo (solo lectura, correrla cuando Victor dé el go)

```sql
select w.source, count(*) as personas
from waitlist w
left join newsletter_subscribers n on n.email = lower(w.email)
where w.marketing_opt_in = false
  and w.created_at < '<fecha del deploy>'
  and n.email is null
group by w.source;
```

## Lo que falta decidir

- Fecha: al abrir el Pack (recomendado).
- Si las filas de `agents` reciben un aviso aparte cuando abra Agentes.
