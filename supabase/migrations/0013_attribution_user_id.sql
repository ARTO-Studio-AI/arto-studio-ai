-- 0013_attribution_user_id.sql
-- attribution_events.user_id (H-61, 9 oct 2026).
--
-- /auth/callback guardaba el id del usuario en target_id, pero target_id tiene FK a
-- outreach_targets (la tabla se creo para atribuir conversiones a prospectos de
-- outreach, fuera de git). Cada insert de signup fallaba con violacion de FK y el
-- callback solo lo logueaba: la tabla estaba en 0 filas el 9 oct. Efectos: nunca se
-- guardo la prueba fechada del consentimiento de correos (D9 y la fila de registro
-- de DECISIONES.md la declaran fuente de verdad) y todo login dentro de las 24 h de
-- crear la cuenta se trataba otra vez como signup.
--
-- Se agrega una columna propia para el usuario en vez de quitar el FK de target_id:
-- outreach_log y outreach_drafts usan la misma convencion con outreach_targets.
-- Solo agrega columna nullable, FK e indice: no reescribe filas ni bloquea lecturas.
-- RLS ya esta activo en la tabla (0005) y los grants de anon ya se quitaron (0006).
-- Termina con notify pgrst (regla de CLAUDE.md).
begin;

-- El FK valida contra auth.users con un lock breve; si hay una transaccion larga
-- sobre auth.users, mejor fallar a los 5 s que quedar en cola (sugerencia de Fable).
set local lock_timeout = '5s';

alter table public.attribution_events
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_attribution_events_user
  on public.attribution_events using btree (event_type, user_id);

comment on column public.attribution_events.user_id is
  'Usuario de auth.users (signup y demas eventos de producto). target_id es de outreach_targets (H-61).';

commit;

notify pgrst, 'reload schema';
