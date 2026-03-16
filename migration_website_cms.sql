-- ══════════════════════════════════════════════════════════════
-- SYNRG Website CMS — Tables + Seed Data
-- Run in Supabase SQL Editor after restoring the project
-- ══════════════════════════════════════════════════════════════

-- ── 1. Products (remote.html) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS site_products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bg        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_bg TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  tag_bg         TEXT NOT NULL DEFAULT '',
  tag_en         TEXT NOT NULL DEFAULT '',
  price_cents    INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'BGN',
  stripe_price_id TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Plans (studio.html, services.html) ─────────────────────
CREATE TABLE IF NOT EXISTS site_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name_bg           TEXT NOT NULL,
  name_en           TEXT NOT NULL,
  sessions_count    TEXT NOT NULL DEFAULT '8',
  sessions_label_bg TEXT NOT NULL DEFAULT 'тренировки / месец',
  sessions_label_en TEXT NOT NULL DEFAULT 'sessions / month',
  price_eur         INTEGER NOT NULL DEFAULT 0,
  price_bgn_text_bg TEXT NOT NULL DEFAULT '',
  price_bgn_text_en TEXT NOT NULL DEFAULT '',
  features          JSONB NOT NULL DEFAULT '[]',
  badge_bg          TEXT,
  badge_en          TEXT,
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Team Members (index.html) ──────────────────────────────
CREATE TABLE IF NOT EXISTS site_team_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  role_bg        TEXT NOT NULL DEFAULT '',
  role_en        TEXT NOT NULL DEFAULT '',
  photo_url      TEXT NOT NULL DEFAULT '',
  badge_text     TEXT NOT NULL DEFAULT '',
  badge_style    TEXT NOT NULL DEFAULT 'default',
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_visible     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Services (index.html) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS site_services (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bg        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_bg TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  link_url       TEXT,
  link_text_bg   TEXT,
  link_text_en   TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Content Blocks (all pages — hero, stats, CTA, etc.) ───
CREATE TABLE IF NOT EXISTS site_content_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page        TEXT NOT NULL,
  section     TEXT NOT NULL,
  block_key   TEXT NOT NULL,
  value_bg    TEXT NOT NULL DEFAULT '',
  value_en    TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page, section, block_key)
);

-- ── 6. Inquiries — add status/notes if table exists ───────────
CREATE TABLE IF NOT EXISTS inquiries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  contact     TEXT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (idempotent)
DO $$ BEGIN
  ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS notes TEXT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_site_products_status ON site_products(status);
CREATE INDEX IF NOT EXISTS idx_site_products_order  ON site_products(display_order);
CREATE INDEX IF NOT EXISTS idx_site_plans_order     ON site_plans(display_order);
CREATE INDEX IF NOT EXISTS idx_site_team_order      ON site_team_members(display_order);
CREATE INDEX IF NOT EXISTS idx_site_services_order  ON site_services(display_order);
CREATE INDEX IF NOT EXISTS idx_inquiries_status     ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created    ON inquiries(created_at DESC);

-- ── RLS (same pattern as existing tables) ─────────────────────
ALTER TABLE site_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_services       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries           ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "anon_all" ON site_products       FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_all" ON site_plans          FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_all" ON site_team_members   FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_all" ON site_services       FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_all" ON site_content_blocks FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "anon_all" ON inquiries           FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════
-- SEED DATA — current hardcoded content
-- ══════════════════════════════════════════════════════════════

-- ── Products ──────────────────────────────────────────────────
INSERT INTO site_products (name_bg, name_en, description_bg, description_en, tag_bg, tag_en, price_cents, currency, stripe_price_id, status, is_featured, display_order) VALUES
('SYNRG Програма', 'SYNRG Program',
 'Онлайн програми от екипа на SYNRG — за рехабилитация, физиотерапия и медицински протоколи. Достъпни от всяка точка.',
 'Online programs by the SYNRG team — for rehabilitation, physiotherapy and medical protocols. Available from anywhere.',
 'Онлайн достъп', 'Online access', 9900, 'BGN', 'price_PLACEHOLDER', 'active', true, 0),
('SYNRG Планер', 'SYNRG Planner',
 'Физически планер за структура в храненето и ежедневието. Инструмент за хора, които искат да контролират процеса.',
 'A physical planner for structure in nutrition and daily life. A tool for people who want to control the process.',
 'Физически продукт', 'Physical product', 0, 'BGN', NULL, 'coming_soon', false, 1);

-- ── Plans ─────────────────────────────────────────────────────
INSERT INTO site_plans (slug, name_bg, name_en, sessions_count, sessions_label_bg, sessions_label_en, price_eur, price_bgn_text_bg, price_bgn_text_en, features, badge_bg, badge_en, is_featured, display_order) VALUES
('flex', 'SYNRG FLEX', 'SYNRG FLEX', '8', 'тренировки / месец', 'sessions / month', 154,
 '≈ 300лв / месец', '≈ 300 BGN / month',
 '[{"bg":"Онлайн консултация с лекар","en":"Online doctor consultation"},{"bg":"Изграждане и проследяване","en":"Strategy & tracking"},{"bg":"SYNRG Inner Circle група","en":"SYNRG Inner Circle group"},{"bg":"Достъп до SYNRG App","en":"Access to SYNRG App"},{"bg":"Онлайн програми Physio & Doctor","en":"Physio & Doctor programs"},{"bg":"Онлайн тренировки за вкъщи","en":"Online home workouts"}]',
 NULL, NULL, false, 0),
('progress', 'SYNRG PROGRESS', 'SYNRG PROGRESS', '12', 'тренировки / месец', 'sessions / month', 179,
 '≈ 350лв / месец', '≈ 350 BGN / month',
 '[{"bg":"Онлайн консултация с лекар","en":"Online doctor consultation"},{"bg":"Изграждане и проследяване","en":"Strategy & tracking"},{"bg":"SYNRG Inner Circle група","en":"SYNRG Inner Circle group"},{"bg":"Достъп до SYNRG App","en":"Access to SYNRG App"},{"bg":"Онлайн програми Physio & Doctor","en":"Physio & Doctor programs"},{"bg":"Онлайн тренировки за вкъщи","en":"Online home workouts"}]',
 'Най-популярен', 'Most popular', true, 1),
('plus', 'SYNRG PLUS', 'SYNRG PLUS', '∞', 'без лимит', 'unlimited', 202,
 '≈ 400лв / месец', '≈ 400 BGN / month',
 '[{"bg":"Онлайн консултация с лекар","en":"Online doctor consultation"},{"bg":"Изграждане и проследяване","en":"Strategy & tracking"},{"bg":"SYNRG Inner Circle група","en":"SYNRG Inner Circle group"},{"bg":"Достъп до SYNRG App","en":"Access to SYNRG App"},{"bg":"Онлайн програми Physio & Doctor","en":"Physio & Doctor programs"},{"bg":"Онлайн тренировки за вкъщи","en":"Online home workouts"},{"bg":"Пълен достъп до онлайн академия","en":"Full access to online academy"}]',
 'Най-добра стойност', 'Best value', false, 2);

-- ── Team Members ──────────────────────────────────────────────
INSERT INTO site_team_members (name, role_bg, role_en, photo_url, badge_text, badge_style, display_order) VALUES
('Александър', 'Основател · Head Coach', 'Founder · Head Coach', 'images/itzko.jpg', 'Coach', 'mint', 0),
('Елина',      'Треньор · Онлайн програми', 'Coach · Online programs', 'images/kari.jpg', 'Coach', 'default', 1),
('Виви',       'Физиотерапевт', 'Physiotherapist', 'images/vivy.jpg', 'Physio', 'default', 2),
('Ицко',       'Треньор', 'Coach', 'images/alex.jpg', 'Coach', 'default', 3),
('Никола',     'Треньор', 'Coach', 'images/nikola.jpg', 'Coach', 'default', 4),
('Д-р Желязова', 'Лекар · Рехабилитация', 'Doctor · Rehabilitation', 'images/elina.jpg', 'Doctor', 'default', 5);

-- ── Services ──────────────────────────────────────────────────
INSERT INTO site_services (name_bg, name_en, description_bg, description_en, link_url, link_text_bg, link_text_en, status, is_featured, display_order) VALUES
('Тренировки в студиото', 'Studio training',
 'Персонализирани тренировки с опитен треньор. Лимитирано студио с фокус върху техниката и прогреса. Записвай часове директно от app-а.',
 'Personalized training with an experienced coach. Limited studio with a focus on technique and progress. Book sessions directly from the app.',
 'studio.html', 'Към студиото →', 'To the studio →', 'active', true, 0),
('Онлайн програма', 'Online program',
 'Тренировъчна и рехабилитационна програма от Кари и Виви. Работи от всяка точка.',
 'Training and rehabilitation program by Kari and Vivy. Train from anywhere.',
 NULL, 'Очаквайте →', 'Coming soon →', 'coming_soon', false, 1),
('SYNRG Планер', 'SYNRG Planner',
 'Физически планер за структура в тренировките, храненето и ежедневието.',
 'A physical planner for structure in training, nutrition, and daily life.',
 NULL, 'Очаквайте →', 'Coming soon →', 'coming_soon', false, 2);
