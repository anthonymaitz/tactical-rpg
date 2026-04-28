-- Columns added after initial migration (managed in Supabase dashboard previously)
alter table heroes add column if not exists profession text not null default '';
alter table heroes add column if not exists current_hp integer;
alter table heroes add column if not exists star_rating integer not null default 0;

-- Inventory tables
create table if not exists player_inventory (
  user_id uuid primary key,
  gold integer not null default 0,
  health_potions integer not null default 0,
  star_fragments integer not null default 0,
  decor_shards integer not null default 0,
  builder_props jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists hero_inventory (
  hero_id uuid primary key,
  health_potions integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Drop tables for loot rolling
create table if not exists drop_tables (
  slug text primary key,
  entries jsonb not null default '[]'::jsonb
);

-- Scenes for the builder
create table if not exists scenes (
  slug text primary key,
  scene_data jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_at timestamptz not null default now()
);

-- Indexes for frequent lookups
create index if not exists sq_abilities_source_idx on sq_abilities (source);
create index if not exists sq_abilities_context_idx on sq_abilities (context);
