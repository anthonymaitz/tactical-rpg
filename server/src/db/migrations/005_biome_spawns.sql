create table if not exists biome_spawns (
  id text primary key,
  biome_id text not null,
  col int not null,
  row int not null,
  name text not null,
  level int not null,
  spawn_radius int not null,
  drop_table_slug text not null,
  group_id text
);
