-- 0015_catalog_changes.sql
-- Historial del Catalogo de /admin (rediseno, fase 2, 2026-10-12). Cada cambio a un
-- prompt (o a un skill, cuando exista su tabla) deja una fila con el valor anterior y el
-- nuevo. Los cambios hechos juntos comparten batch_id, y un lote se puede deshacer
-- entero. Solo lo escribe y lo lee el servidor (service role): RLS activo, sin politicas
-- y sin privilegios para anon ni authenticated.
begin;

create table if not exists public.catalog_changes (
  id          bigint generated always as identity primary key,
  batch_id    uuid        not null,
  entity      text        not null check (entity in ('prompt', 'skill')),
  entity_id   text        not null,
  action      text        not null check (action in ('create', 'update')),
  summary     text        not null,
  before      jsonb,
  after       jsonb       not null,
  changed_by  text        not null,
  created_at  timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by text
);

create index if not exists catalog_changes_batch_idx on public.catalog_changes (batch_id);
create index if not exists catalog_changes_entity_idx on public.catalog_changes (entity, entity_id, created_at desc);
create index if not exists catalog_changes_created_idx on public.catalog_changes (created_at desc);

alter table public.catalog_changes enable row level security;
revoke all on table public.catalog_changes from anon, authenticated;
revoke all on sequence public.catalog_changes_id_seq from anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- Verificacion: select has_table_privilege('authenticated', 'public.catalog_changes', 'SELECT'); -- false
