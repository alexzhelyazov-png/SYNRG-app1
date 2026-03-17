-- ══════════════════════════════════════════════════════════════
-- SYNRG Website — Seed site_content_blocks with current texts
-- Run AFTER migration_website_cms.sql
-- ══════════════════════════════════════════════════════════════

-- ── INDEX.HTML ───────────────────────────────────────────────

-- Hero
INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('index', 'hero', 'tag', 'Beyond Fitness · Варна', 'Beyond Fitness · Varna'),
('index', 'hero', 'title', 'Beyond<br>Fitness.<br>Не фитнес верига.<br>Нещо различно.', 'Beyond<br>Fitness.<br>Not a fitness chain.<br>Something different.'),
('index', 'hero', 'cta_consultation', 'Запиши се за консултация', 'Book a consultation'),
('index', 'hero', 'cta_studio', 'Разгледай студиото', 'Explore the studio')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- Stats
INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('index', 'stats', 'stat1_number', '300+', '300+'),
('index', 'stats', 'stat1_label', 'Трансформирани животи', 'Lives transformed'),
('index', 'stats', 'stat2_number', '5', '5'),
('index', 'stats', 'stat2_label', 'Години опит', 'Years of experience'),
('index', 'stats', 'stat3_number', '∞', '∞'),
('index', 'stats', 'stat3_label', 'Отвъд нормалното', 'Beyond normal')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- About
INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('index', 'about', 'overline', 'За нас', 'About'),
('index', 'about', 'heading', 'Не сме обикновен фитнес.', 'We''re not your typical gym.'),
('index', 'about', 'desc1', 'SYNRG е бутиково студио, изградено с убеждението, че истинските резултати идват от индивидуален подход, правилна методология и треньори, на които им пука.', 'SYNRG is a boutique studio built on the belief that real results come from a personalized approach, proper methodology and coaches who genuinely care.'),
('index', 'about', 'desc2', 'Работим с малки групи, за да може всеки клиент да получи вниманието, което заслужава. Не продаваме масови планове — изграждаме лична стратегия за всеки.', 'We work with small groups so each client gets the attention they deserve. We don''t sell mass plans — we build personal strategies.'),
('index', 'about', 'panel_quote', 'Изграждаме лична стратегия за всеки.', 'We build a personal strategy for everyone.')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- Team section header
INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('index', 'team', 'overline', 'Екипът', 'The team'),
('index', 'team', 'heading', 'Хората зад SYNRG.', 'The people behind SYNRG.'),
('index', 'team', 'desc', 'Не наемаме треньори. Изграждаме екип от хора, на които им пука.', 'We don''t hire trainers. We build a team of people who care.')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- CTA
INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('index', 'cta', 'overline', 'Готов ли си', 'Ready?'),
('index', 'cta', 'heading', 'Започни сега.', 'Start now.'),
('index', 'cta', 'desc', 'Запиши се за безплатна консултация и разбери как SYNRG може да работи за теб.', 'Sign up for a free consultation and find out how SYNRG can work for you.'),
('index', 'cta', 'form_submit', 'Безплатна консултация →', 'Free consultation →')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- Footer (shared across pages)
INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('shared', 'footer', 'tagline', 'Бутиково фитнес студио · Варна', 'Boutique fitness studio · Varna'),
('shared', 'footer', 'cta_link', 'Безплатна консултация', 'Free consultation'),
('shared', 'footer', 'copyright', '© 2026 SYNRG Beyond Fitness. Всички права запазени.', '© 2026 SYNRG Beyond Fitness. All rights reserved.')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- ── STUDIO.HTML ──────────────────────────────────────────────

INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('studio', 'hero', 'overline', 'SYNRG · Варна', 'SYNRG · Varna'),
('studio', 'hero', 'title', 'Студиото.', 'The Studio.'),
('studio', 'hero', 'desc', 'Бутиково фитнес студио с лимитиран брой места. Персонализирани тренировки, малки групи, треньори с цел.', 'A boutique fitness studio with limited spots. Personalized training, small groups, coaches with purpose.'),
('studio', 'hero', 'address', 'Варна, България', 'Varna, Bulgaria'),
('studio', 'hero', 'hours', 'Пн – Сб, 08:00 – 20:00', 'Mon – Sat, 08:00 – 20:00'),
('studio', 'app', 'overline', 'Апликацията', 'The App'),
('studio', 'app', 'heading', 'Консултирай се.<br>Управлявай всичко.', 'Consult with us.<br>Manage everything.'),
('studio', 'app', 'desc', 'Записвай часове, следи напредъка си и общувай с треньора — директно от app-а.', 'Book sessions, track your progress and communicate with your coach — directly from the app.'),
('studio', 'app', 'cta_button', 'Безплатна консултация →', 'Free consultation →'),
('studio', 'pricing', 'overline', 'Членство', 'Membership'),
('studio', 'pricing', 'heading', 'Избери своя план.', 'Choose your plan.'),
('studio', 'pricing', 'subheading', 'Всички планове включват едно и също. Единствената разлика е броят тренировки в студиото.', 'All plans include the same. The only difference is the number of studio sessions.')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- ── REMOTE.HTML ──────────────────────────────────────────────

INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('remote', 'hero', 'overline', 'SYNRG · Онлайн', 'SYNRG · Online'),
('remote', 'hero', 'title', 'С нас<br>навсякъде.', 'With us<br>anywhere.'),
('remote', 'hero', 'desc', 'Програмите и продуктите на SYNRG, достъпни от всяка точка. Без да живееш във Варна.', 'SYNRG programs and products available from anywhere. No need to live in Varna.'),
('remote', 'products', 'overline', 'Нашите продукти', 'Our products'),
('remote', 'products', 'heading', 'Програмите.<br>Навсякъде.', 'The programs.<br>From anywhere.')
ON CONFLICT (page, section, block_key) DO NOTHING;

-- ── SERVICES.HTML ────────────────────────────────────────────

INSERT INTO site_content_blocks (page, section, block_key, value_bg, value_en) VALUES
('services', 'hero', 'overline', 'SYNRG · Членство', 'SYNRG · Membership'),
('services', 'hero', 'title', 'Избери<br>своя план.', 'Choose<br>your plan.'),
('services', 'hero', 'desc', 'Три нива на ангажираност. Един стандарт на качество. Намери плана, който е за теб.', 'Three levels of commitment. One standard of quality. Find the plan that''s right for you.'),
('services', 'plans', 'overline', 'Членство', 'Membership'),
('services', 'plans', 'heading', 'Три плана.<br>Твоят избор.', 'Three plans.<br>Your choice.'),
('services', 'plans', 'subheading', 'Всички планове включват достъп до лимитираното студио и персонализиран подход.', 'All plans include access to the limited studio and a personalized approach.')
ON CONFLICT (page, section, block_key) DO NOTHING;
