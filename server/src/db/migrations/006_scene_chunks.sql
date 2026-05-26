create table if not exists scene_chunks (
  slug text primary key,
  name text not null,
  biome_tags text[] not null default '{}',
  width int not null default 16,
  height int not null default 16,
  scene_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now()
);
