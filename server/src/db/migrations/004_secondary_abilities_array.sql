-- 004_secondary_abilities_array.sql
-- Replace single secondary_ability with an array supporting both inCombat and outOfCombat slots
alter table heroes add column if not exists secondary_abilities jsonb not null default '[]'::jsonb;

-- Migrate existing single ability into the new array
update heroes
  set secondary_abilities = jsonb_build_array(secondary_ability)
  where secondary_ability is not null;
