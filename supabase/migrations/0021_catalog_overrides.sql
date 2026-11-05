-- 0021_catalog_overrides.sql
-- Gestion de skills y mods desde /admin/skills, sin tocar codigo (2026-11-05). Pedido de
-- Victor: «skills y mods no veo como subirlos manualmente o como desactivarlos».
--
-- Tres tablas nuevas y un bucket privado. No toca ninguna tabla, funcion ni bucket que ya
-- exista.
--   catalog_overrides    estado elegido en /admin (published, coming_soon, hidden) para un
--                        skill, bundle o mod. Manda sobre el del manifiesto del repo.
--   catalog_items        skills y mods subidos desde /admin: ficha en JSONB (la valida el
--                        servidor con src/lib/catalogo/validacion.mjs, las mismas reglas que
--                        scripts/add-skill.mjs) y, si trae, el paquete en Storage.
--   catalog_status_log   registro de cada cambio: quien, cuando, de que estado a cual.
--   storage catalogo-paquetes  bucket privado con los .skill subidos. Sin politicas: solo
--                        el servidor (service role) lee y escribe; la descarga sale con URL
--                        firmada de corta vida despues de revisar la regla de la categoria.
--
-- Las tres tablas nacen cerradas (D16): RLS activo, sin politicas y sin privilegios para
-- anon ni authenticated (0016 ya los quita por defecto; el revoke es explicito igual). Solo
-- las lee y escribe el servidor con service role.
--
-- ORDEN: se puede aplicar antes o despues de mergear. Sin las tablas, el sitio sirve el
-- manifiesto del repo tal cual (falla cerrado a lo que ya hay) y /admin/skills avisa que no
-- puede leer la base; activar, desactivar y subir responden error sin escribir nada.
begin;

create table if not exists public.catalog_overrides (
  kind        text        not null check (kind in ('skill', 'mod', 'bundle')),
  slug        text        not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  status      text        not null check (status in ('published', 'coming_soon', 'hidden')),
  updated_by  text        not null,
  updated_at  timestamptz not null default now(),
  primary key (kind, slug)
);

comment on table public.catalog_overrides is
  'Estado de skills, bundles y mods elegido en /admin/skills. Manda sobre el del manifiesto del repo (src/lib/catalogo/*.json). Lo lee el sitio con cache de 60 s.';

create table if not exists public.catalog_items (
  kind          text        not null check (kind in ('skill', 'mod')),
  slug          text        not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  ficha         jsonb       not null,
  storage_path  text,
  bytes         integer,
  sha256        text,
  uploaded_by   text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (kind, slug),
  constraint catalog_items_ficha_check check (jsonb_typeof(ficha) = 'object' and ficha ->> 'slug' = slug),
  -- Un skill siempre trae paquete; un mod puede no traer archivo.
  constraint catalog_items_skill_pkg_check check (kind <> 'skill' or storage_path is not null),
  -- Paquete completo o nada: ruta, peso (hasta 4.4 MB, lo que entrega una funcion) y huella.
  constraint catalog_items_pkg_check check (
    (storage_path is null and bytes is null and sha256 is null)
    or (
      storage_path ~ '^(skills|mods)/[a-z0-9-]+/[0-9a-f]{64}\.(skill|zip)$'
      and bytes between 1 and 4613734
      and sha256 ~ '^[0-9a-f]{64}$'
    )
  )
);

comment on table public.catalog_items is
  'Skills y mods subidos desde /admin/skills. Se suman a los del repo; si un slug existe en los dos, gana el del repo. Entran ocultos (sin override = hidden).';

create table if not exists public.catalog_status_log (
  id           bigint      generated always as identity primary key,
  kind         text        not null check (kind in ('skill', 'mod', 'bundle')),
  slug         text        not null,
  action       text        not null check (action in ('status', 'upload')),
  from_status  text        check (from_status in ('published', 'coming_soon', 'hidden')),
  to_status    text        not null check (to_status in ('published', 'coming_soon', 'hidden')),
  detail       jsonb,
  changed_by   text        not null,
  created_at   timestamptz not null default now()
);

create index if not exists catalog_status_log_created_idx on public.catalog_status_log (created_at desc);
create index if not exists catalog_status_log_item_idx on public.catalog_status_log (kind, slug, created_at desc);

comment on table public.catalog_status_log is
  'Cada cambio de estado o subida hecha en /admin/skills: quien, cuando y de que estado a cual.';

alter table public.catalog_overrides enable row level security;
alter table public.catalog_items enable row level security;
alter table public.catalog_status_log enable row level security;
revoke all on table public.catalog_overrides from anon, authenticated;
revoke all on table public.catalog_items from anon, authenticated;
revoke all on table public.catalog_status_log from anon, authenticated;
revoke all on sequence public.catalog_status_log_id_seq from anon, authenticated;
-- Grant explicito a service_role (D16), igual que en la 0020.
grant select, insert, update, delete on table public.catalog_overrides, public.catalog_items, public.catalog_status_log to service_role;
grant usage, select on sequence public.catalog_status_log_id_seq to service_role;

-- Bucket privado para los paquetes. Sin politicas en storage.objects: anon y authenticated
-- no pueden listar, leer ni escribir; service role si. Limite de 4.4 MB y solo zip.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo-paquetes', 'catalogo-paquetes', false, 4613734, array['application/zip'])
on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';

-- Verificacion:
--   select has_table_privilege('anon', 'public.catalog_overrides', 'SELECT'),
--          has_table_privilege('authenticated', 'public.catalog_items', 'SELECT'),
--          has_table_privilege('authenticated', 'public.catalog_status_log', 'INSERT'),
--          has_table_privilege('service_role', 'public.catalog_items', 'INSERT');
--   -- esperado: f, f, f, t
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'catalogo-paquetes';
--   -- esperado: catalogo-paquetes | f | 4613734 | {application/zip}
--
-- Para deshacer (sin datos que conservar):
--   drop table public.catalog_status_log, public.catalog_items, public.catalog_overrides;
--   -- el bucket se borra desde el panel de Storage (primero vaciarlo).
