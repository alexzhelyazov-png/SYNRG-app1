-- ── Хранителен план tab ────────────────────────────────────────────
-- Which of the three approaches the client picked, and the body data the
-- targets are computed from (Mifflin-St Jeor needs age and sex, which
-- synrg_quiz never collected).
--
-- nutrition_mode:    'menu' | 'calories' | 'rules' | null (not chosen yet)
-- nutrition_profile: { sex, age, height, weight, steps, sessions, goal }
--
-- Already applied to the live project on 2026-08-25.

alter table clients add column if not exists nutrition_mode    text;
alter table clients add column if not exists nutrition_profile jsonb;
