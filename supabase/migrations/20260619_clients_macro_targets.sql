-- Add manual macro targets so freemium users can set carbs/fat themselves
-- (in addition to the existing calorie_target / protein_target).
-- NULL = not set → app falls back to the derived split.
alter table clients add column if not exists carbs_target integer;
alter table clients add column if not exists fat_target integer;
