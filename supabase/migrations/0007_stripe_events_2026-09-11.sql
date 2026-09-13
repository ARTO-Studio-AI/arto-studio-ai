-- 0007_stripe_events_2026-09-11.sql
-- Fase 1A del Sprint 1 (Stripe). Registro de eventos de webhook para idempotencia:
-- el handler hace INSERT ... ON CONFLICT DO NOTHING RETURNING id antes de procesar;
-- si no vuelve fila, responde 200 "already processed" sin tocar profiles ni clients.
-- Solo la escribe el service role (webhook). RLS activo y sin políticas, más revoke
-- explícito a anon/authenticated, siguiendo el patrón de 0005/0006.
-- Aditiva: no toca tablas existentes. profiles ya tenía subscription_ends_at
-- (timestamptz), que es donde el webhook guarda el fin de periodo de Stripe.
begin;
create table if not exists public.stripe_events (
  id          text primary key,
  type        text,
  received_at timestamptz default now()
);
alter table public.stripe_events enable row level security;
revoke all on table public.stripe_events from anon, authenticated;
notify pgrst, 'reload schema';
commit;
