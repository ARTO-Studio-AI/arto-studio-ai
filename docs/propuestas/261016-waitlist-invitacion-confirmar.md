# Propuesta: invitar una sola vez a confirmar a quien ya está en la lista de espera

> 2026-10-16 · PR `fix/waitlist-pack-consentimiento` · **Propuesta, no se ejecuta sin el go de Victor.**
> Nada de esto se ha corrido contra producción: ni el conteo.

## El problema

Las filas de `waitlist` anteriores a este PR se guardaron sin casilla de promociones. Esas
personas pidieron **un aviso**: el día que abra Skills Studio (hoy el Pack ARTO) o Agentes.
No aceptaron promociones, así que no pueden entrar a `newsletter_subscribers` como `active`
ni recibir la campaña.

## Qué se propone

Un solo correo, **cuando el Pack abra**, que sea el aviso de apertura que pidieron y que lleve
además el botón de confirmar la lista. No se manda un correo que solo pida el consentimiento:
en el RGPD (y en la guía de la ICO del Reino Unido) pedir el consentimiento por correo ya
cuenta como correo de promoción. El aviso de apertura sí lo pidieron.

1. **A quién.** Filas de `waitlist` con `created_at` anterior al deploy de este PR,
   `marketing_opt_in = false`, y cuyo correo **no** esté en `newsletter_subscribers` con
   ningún estado (ni `active`, ni `pending`, ni `unsubscribed`, ni `bounced`). Quien se dio
   de baja o rebotó no recibe nada.
2. **Cómo se confirma.** Igual que el roast: para cada correo se crea la fila `pending` con
   `source = 'pack_waitlist_invite'` y se manda el aviso con el enlace
   `/api/newsletter/confirm?token=<unsubscribe_token>`. Una fila `pending` no recibe el digest
   ni promociones (solo se manda a `active`). Si no confirma, se queda `pending` y no se le
   vuelve a escribir.
3. **Una sola vez.** El script marca a quién ya se le mandó (columna nueva o tabla de envíos)
   y se niega a correr dos veces sobre el mismo correo.
4. **Correo.** Plantilla nueva en `src/lib/email-templates/` (pasa por Fable: es correo), en el
   idioma de la página donde se anotó (`source` no lo dice para las filas viejas; por defecto
   español). Asunto tipo «Ya abrió el Pack ARTO», el aviso, y un segundo bloque «¿Quieres
   recibir también prompts nuevos y promociones? Confírmalo aquí». Cabeceras de baja.
5. **Herramienta.** `scripts/waitlist-invitar.ts` con `--dry-run` por defecto que solo imprime
   el conteo y tres correos enmascarados; `--enviar` exige además `--prod`, deja registro y
   manda por Resend con pausa entre envíos.

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

- Si se espera a que abra el Pack (recomendado) o se manda ya con otro pretexto.
- Si las filas de `agents` reciben el mismo correo o se esperan a Agentes.
