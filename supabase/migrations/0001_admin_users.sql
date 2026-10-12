-- ⚠ HISTORICA, NO APLICAR (D14, 2026-10-12). Esta tabla nunca se creo en produccion y su
-- pantalla (/admin/admins) se retiro. El acceso al panel sale solo de ADMIN_EMAILS.
--
-- 0001_admin_users.sql
--
-- Table: admin_users
--
-- Backs the dynamic admin allowlist surfaced at /admin/admins. The
-- canonical admin gate (isAdminEmail in src/lib/auth.ts) reads both
-- the ADMIN_EMAILS env var (bootstrap, immutable from the UI) and this
-- table (managed from the UI). A user is admin if either source
-- contains their email.
--
-- Created: 2026-05-24

create table if not exists public.admin_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  added_by    text,
  added_at    timestamptz not null default now(),
  notes       text
);

create index if not exists idx_admin_users_email_lower
  on public.admin_users ((lower(email)));

-- Lock the table down — only the service role (server-side) can read or
-- mutate. The /api/admin/admins routes use the admin Supabase client.
alter table public.admin_users enable row level security;

-- No policies = no access for anon/authenticated. Service role bypasses RLS.
