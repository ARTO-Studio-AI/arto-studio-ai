-- 0009_prompt_opens.sql
-- Contador free de 3 prompts abiertos al dia (decision D7 de Victor, 11 sep 2026:
-- "solo tres abiertos por dia, no busquedas"). Una fila por (sujeto, prompt, dia UTC).
-- El sujeto es "user:<uuid>" para sesiones o "vid:<uuid>" para anonimos (cookie asai_vid).
-- Al iniciar sesion, las filas vid: del dia se adoptan al user: para que registrarse no
-- regale 3 aperturas mas. Reabrir el mismo prompt el mismo dia no cuenta (PK compuesta).
-- Se lee y escribe solo por DATABASE_URL (rol postgres, bypassrls); RLS activo sin politicas
-- para que anon y authenticated no lean nada por REST, igual que las otras 17 tablas.
-- Numerada 0009 porque 0007 y 0008 quedan reservadas para los PRs paralelos 1a y 1b.
begin;
create table if not exists public.prompt_opens (
  subject   text        not null,
  prompt_id text        not null,
  day       date        not null default current_date,
  first_at  timestamptz not null default now(),
  primary key (subject, prompt_id, day)
);
create index if not exists prompt_opens_subject_day_idx on public.prompt_opens (subject, day);
alter table public.prompt_opens enable row level security;
revoke all on table public.prompt_opens from anon, authenticated;
notify pgrst, 'reload schema';
commit;
