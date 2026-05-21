-- 003_secondary_class.sql
-- secondary_class: text name of the chosen secondary class (null = not yet set)
-- secondary_ability: the single borrowed ability as jsonb
-- class_xp: keyed by ability id, tracks how many times each ability was used in combat
alter table heroes add column if not exists secondary_class text;
alter table heroes add column if not exists secondary_ability jsonb;
alter table heroes add column if not exists class_xp jsonb not null default '{}'::jsonb;
