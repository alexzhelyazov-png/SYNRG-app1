-- Transactional + reminder emails: make EVERY client-facing email the system
-- sends visible/editable from the admin "Имейли" tab. These store the FULL html
-- (with {tokens}) — each edge function fetches its row, fills tokens, and sends.
-- Categories: 'transactional' (always sent — toggle locked on in UI, text editable)
--             'reminder'      (toggle controls whether the cron sends it)

insert into public.email_automations (key, category, label, trigger_desc, audience, subject, body_html, enabled, sort_order) values

('registration_welcome','transactional','Регистрация · Добре дошъл','При успешна регистрация на нов профил','all',
 'Добре дошъл в SYNRG Beyond Fitness!',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Добре дошъл в SYNRG Beyond Fitness!</p><p style="font-size:14px;color:#999;line-height:1.6">Профилът ти е създаден успешно. Очакваме те в студиото!</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 100),

('password_reset','transactional','Смяна на парола · Код','Когато клиент поиска нова парола (валиден 15 мин)','all',
 'Код за смяна на парола',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Твоят код за смяна на парола е:</p><div style="text-align:center;margin:24px 0"><span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#c4e9bf;background:#252525;padding:16px 32px;border-radius:12px;display:inline-block">{code}</span></div><p style="font-size:14px;color:#999">Кодът е валиден 15 минути. Ако не си поискал смяна на парола, игнорирай този имейл.</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 110),

('plan_activated','transactional','План · Активиран','При активиране на студиен план','studio',
 'Планът ти е активиран!',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Планът ти <strong style="color:#c4e9bf">{planLabel}</strong> в SYNRG Beyond Fitness е активиран!</p><p style="font-size:14px;color:#999">Валиден до: <strong style="color:#e0e0e0">{planExpires}</strong></p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 120),

('plan_expired','transactional','План · Изтекъл','Когато студиен план премине в статус изтекъл','studio',
 'Планът ти изтече',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Планът ти в SYNRG Beyond Fitness изтече.</p><p style="font-size:14px;color:#999">Свържи се с нас за подновяване!</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 130),

('purchase_success','transactional','Покупка · Успешно плащане','При успешно онлайн плащане през Stripe','online',
 'Успешна покупка — SYNRG Beyond Fitness',
 '<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px"><h2 style="color:#c4e9bf;margin:0 0 16px">Успешна покупка!</h2><p>Здравей, <strong>{name}</strong>!</p><p>Плащането ти е потвърдено{amountLine}.</p><p>Достъпът до програмата SYNRG Метод е активиран за <strong>8 седмици</strong>. Съдържанието е в секция <strong>Програми</strong>.</p><p style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px">Отвори приложението</a></p><p style="font-size:13px;color:#bbb;margin-top:24px"><strong>Първа покупка с този имейл?</strong> Ще получиш втори имейл с директен линк за задаване на парола. Кликни го и си готов.<br><br><strong>Вече имаш акаунт?</strong> Натисни „Забравена парола" в приложението с този имейл — ще получиш код за нов вход.</p>{invoiceLine}<hr style="border:none;border-top:1px solid #333;margin:20px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p></div>',
 true, 140),

('onboarding_setup','transactional','Покупка · Достъп до акаунт','Втори имейл при анонимна онлайн покупка (линк/код за вход)','online',
 'Достъп до твоя SYNRG акаунт',
 '<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px"><h2 style="color:#c4e9bf;margin:0 0 16px">{heading}</h2><p>Здравей, <strong>{name}</strong>!</p><p>{intro}</p><p style="text-align:center;margin:24px 0"><a href="{setupUrl}" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px">{ctaLabel}</a></p><p style="font-size:13px;color:#bbb;margin-top:24px">Ако бутонът не работи, отвори <a href="https://synrg-beyondfitness.com/app/" style="color:#c4e9bf">приложението</a>, натисни „Забравена парола", въведи имейла си и този код:</p><div style="font-size:24px;letter-spacing:6px;font-weight:700;color:#c4e9bf;text-align:center;padding:14px;background:#0d1510;border-radius:12px;margin:12px 0">{code}</div><p style="font-size:13px;color:#bbb">Кодът е валиден 24 часа.</p><hr style="border:none;border-top:1px solid #333;margin:20px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД</p></div>',
 true, 150),

('refund','transactional','Покупка · Възстановена сума','При възстановяване (refund) на онлайн покупка','online',
 'Възстановяване на сума — SYNRG',
 '<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px"><h2 style="color:#c4e9bf;margin:0 0 16px">Възстановяване на сума</h2><p>Здравей, <strong>{name}</strong>!</p><p>Потвърждаваме, че сумата {refundLine}за програмата SYNRG Метод беше възстановена.</p><p>Парите ще се появят в банковата ти сметка в рамките на 5-10 работни дни (зависи от банката).</p><p>Достъпът ти до програмата е прекратен. Безплатните модули (хранене, тегло, стъпки) остават активни.</p><p>Ако имаш въпроси — отговори на този имейл.</p><hr style="border:none;border-top:1px solid #333;margin:20px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД</p></div>',
 true, 160),

('cod_order','transactional','Наложен платеж · Поръчка приета','При подаване на поръчка с наложен платеж','online',
 'Поръчката ти е приета — SYNRG Метод',
 '<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px"><h2 style="color:#c4e9bf;margin:0 0 16px">Поръчката ти е приета</h2><p>Здравей, <strong>{name}</strong>!</p><p>Получихме поръчката ти за <strong>SYNRG Метод</strong> (8-седмична онлайн програма) с наложен платеж.</p><p style="background:#0d1510;padding:14px;border-radius:12px;font-size:14px;line-height:1.7"><strong>Цена:</strong> €98 (плащаш на куриера при получаване)<br><strong>Куриер:</strong> Еконт<br><strong>Очаквай пратката:</strong> 2-3 работни дни</p><p>В плика ще намериш картичка с QR код. Сканирай го за да активираш профила си и да започнеш веднага.</p><p style="font-size:13px;color:#bbb;margin-top:20px"><strong>Важно:</strong> провери дали в имейла, който си написа при поръчката, няма грешка (<a href="mailto:{email}" style="color:#c4e9bf">{email}</a>). С него ще активираш профила си. Ако виждаш грешка — пиши ни на Viber или отговори на този имейл.</p><hr style="border:none;border-top:1px solid #333;margin:20px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p></div>',
 true, 170),

('cod_activation','transactional','Наложен платеж · Профил активиран','Когато клиент активира профила си (QR/код от картичката)','online',
 'Профилът ти е активен — SYNRG Метод',
 '<div style="font-family:sans-serif;padding:24px;background:#1a1a1a;color:#e0e0e0;border-radius:16px;max-width:520px"><h2 style="color:#c4e9bf;margin:0 0 16px">Профилът ти е активен</h2><p>Здравей, <strong>{loginName}</strong>!</p><p>Програмата <strong>SYNRG Метод</strong> е активна за 8 седмици. Достъпът ти започва от днес.</p><p style="background:#0d1510;padding:14px;border-radius:12px;font-size:14px;line-height:1.7"><strong>Влез в приложението с:</strong><br>Име: <strong>{loginName}</strong><br>Парола: тази, която избра при активацията</p><p style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:16px">Отвори приложението</a></p>{coachLine}{invoiceLine}<hr style="border:none;border-top:1px solid #333;margin:20px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД · ЕИК 207343690</p></div>',
 true, 180),

('reminder_expiry_3d','reminder','Напомняне · План изтича (3 дни)','3 дни преди изтичане на студиен план','studio',
 'Планът ти изтича скоро!',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#FB923C;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Планът ти в SYNRG Beyond Fitness изтича на <strong style="color:#FB923C">{fmtDate}</strong>.</p><p style="font-size:14px;color:#999;line-height:1.6">Свържи се с нас за подновяване, за да не прекъсваш тренировките!</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 190),

('reminder_training','reminder','Напомняне · Тренировка утре','Ден преди записана тренировка','studio',
 'Утре имаш тренировка!',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Напомняне: утре имаш тренировка!</p><div style="background:#252525;border-radius:12px;padding:16px;margin:16px 0"><p style="margin:0;font-size:18px;font-weight:bold;color:#c4e9bf">{timeStr}</p><p style="margin:4px 0 0;font-size:13px;color:#999">SYNRG Beyond Fitness Studio</p></div><p style="font-size:13px;color:#666">Ако не можеш да присъстваш, моля отмени от приложението.</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 200),

('program_warn_7d','reminder','Онлайн програма · Край след 7 дни','7 дни преди края на онлайн програма','online',
 'Програмата ти приключва след 7 дни',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Остават 7 дни до края на твоята 8-седмична програма SYNRG Метод!</p><p style="font-size:14px;color:#bbb;line-height:1.6">Това е момента да:</p><ul style="font-size:14px;color:#bbb;line-height:1.7"><li>Премериш напредъка си (тегло, снимки)</li><li>Запишеш final check-in с твоя ментор</li><li>Завършиш всички уроци които си пропуснал</li></ul><p style="font-size:13px;color:#999">След 7 дни преминаваш на freemium режим — задържаш достъп до hranene/тегло/стъпки трекерите, но не и до програмата и тренера.</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 210),

('program_warn_1d','reminder','Онлайн програма · Край утре','1 ден преди края на онлайн програма','online',
 'Утре приключва програмата ти',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#FB923C;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Утре е последният ти ден от 8-седмичната програма SYNRG Метод!</p><p style="font-size:14px;color:#bbb;line-height:1.6">Това е завършен цикъл — поздравления! От утре:</p><ul style="font-size:14px;color:#bbb;line-height:1.7"><li>Запазваш достъп до hranene, тегло и стъпки трекерите</li><li>Свалят се: програмата, тренера, тренировъчните планове</li></ul><p style="font-size:14px;color:#c4e9bf">Искаш ли да започнем нова програма заедно? Свържи се с нас!</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p></div>',
 true, 220),

('program_completed','reminder','Онлайн програма · Завършена','В деня на изтичане на онлайн програмата','online',
 'Завърши SYNRG Метод — поздравления!',
 '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px"><h2 style="color:#c4e9bf;margin:0 0 16px">{name},</h2><p style="font-size:16px;line-height:1.6">Завърши успешно 8-седмичната програма SYNRG Метод. Поздравления!</p><p style="font-size:14px;color:#bbb;line-height:1.6">Какво следва?</p><ul style="font-size:14px;color:#bbb;line-height:1.7"><li>Запазваш достъп до freemium трекери (hranene, тегло, стъпки)</li><li>Можеш да продължиш да си записваш тренировки и да следиш прогрес</li><li>Готов ли си за следващото ниво? Запиши се за студио тренировки или нова онлайн програма</li></ul><p style="font-size:14px;color:#c4e9bf">Благодарим ти за доверието. Очакваме те за следващата стъпка!</p><hr style="border:none;border-top:1px solid #333;margin:24px 0"><p style="font-size:12px;color:#666">SYNRG Beyond Fitness · Синерджи 93 ООД</p></div>',
 true, 230)

on conflict (key) do nothing;
