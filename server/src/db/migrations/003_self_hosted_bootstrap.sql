-- server/src/db/migrations/003_self_hosted_bootstrap.sql
--
-- Full schema for the self-hosted Postgres instance, replacing Supabase.
-- 001_heroes.sql and 002_heroes_additions.sql were only ever applied to the
-- (now retired) Supabase project — they rely on Supabase's `auth.uid()`,
-- which doesn't exist on plain Postgres, so they are not replayed here.
-- This file recreates every table those two produced, plus sq_classes /
-- sq_abilities / sq_metadata (previously created by hand in the Supabase
-- dashboard, never captured in a migration) and a `users` table for
-- self-hosted auth. No RLS — ownership is enforced in the server's
-- route/service layer (see routes/heroes.ts, db/hero-service.ts).
-- Run once against a fresh database: psql "$DATABASE_URL" -f 003_self_hosted_bootstrap.sql

-- Self-hosted auth: replaces Supabase's auth.users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists heroes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  character_class text not null,
  personality text not null,
  profession text not null default '',
  die text not null default 'd6',
  level integer not null default 1,
  xp integer not null default 0,
  max_hp integer not null default 12,
  current_hp integer,
  max_energy integer not null default 5,
  speed integer not null default 3,
  abilities jsonb not null default '[]'::jsonb,
  gear jsonb not null default '{"weapon":null,"offhand":null,"armor":null,"trinket":null}'::jsonb,
  star_rating integer not null default 0,
  recovery_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists heroes_user_id_idx on heroes (user_id);

create table if not exists player_inventory (
  user_id uuid primary key references users (id) on delete cascade,
  gold integer not null default 0,
  health_potions integer not null default 0,
  star_fragments integer not null default 0,
  decor_shards integer not null default 0,
  builder_props jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists hero_inventory (
  hero_id uuid primary key references heroes (id) on delete cascade,
  health_potions integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists drop_tables (
  slug text primary key,
  entries jsonb not null default '[]'::jsonb
);

create table if not exists scenes (
  slug text primary key,
  scene_data jsonb not null default '{}'::jsonb,
  created_by uuid references users (id),
  updated_at timestamptz not null default now()
);

-- SimpleQuest content — previously created by hand in the Supabase dashboard,
-- seeded via server/scripts/seed-sq-content.ts (now targets this schema).
create table if not exists sq_classes (
  id text primary key,
  die text not null,
  max_hp integer not null,
  max_energy integer not null,
  speed integer not null
);

create table if not exists sq_abilities (
  id text primary key,
  title text not null,
  body text not null,
  context text not null,
  source text not null,
  energy_cost integer,
  target_type text,
  effect text,
  dice_notation jsonb,
  status_effects text[]
);

create table if not exists sq_metadata (
  key text primary key,
  value jsonb not null
);

create index if not exists sq_abilities_source_idx on sq_abilities (source);
create index if not exists sq_abilities_context_idx on sq_abilities (context);
