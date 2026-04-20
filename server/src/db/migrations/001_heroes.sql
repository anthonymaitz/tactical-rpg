-- server/src/db/migrations/001_heroes.sql
create table if not exists heroes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  character_class text not null,
  personality text not null,
  die text not null default 'd6',
  level integer not null default 1,
  xp integer not null default 0,
  max_hp integer not null default 12,
  max_energy integer not null default 5,
  speed integer not null default 3,
  abilities jsonb not null default '[]'::jsonb,
  gear jsonb not null default '{"weapon":null,"offhand":null,"armor":null,"trinket":null}'::jsonb,
  recovery_ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table heroes enable row level security;

create policy "users manage own heroes"
  on heroes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index heroes_user_id_idx on heroes (user_id);
