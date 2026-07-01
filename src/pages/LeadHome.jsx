// ── LeadHome ───────────────────────────────────────────────────────
// Home screen shown to LEAD users — potential customers who registered
// via free.html and are using the freemium trackers (food / weight / steps)
// without having bought either a studio plan or the online program.
//
// Purpose:
//   1. Give them immediate value — keep the freemium trackers accessible
//      as shortcuts (so they stay in the app, keep logging, stay engaged).
//   2. Continuously remind them what SYNRG Метод is and what they're
//      missing — precise, strong, specific result promises that show
//      SYNRG's unique combo (ментор + път + trackers + рецепти +
//      общност — all in one place).
//   3. Provide a single clear CTA to start SYNRG Метод — opens checkout
//      consent dialog (3 mandatory checkboxes per BG/EU law) → Stripe.

import { useState, useEffect } from 'react'
import { Box, Typography, Button, Stack, Chip, CircularProgress, Collapse, TextField } from '@mui/material'
import RestaurantIcon   from '@mui/icons-material/Restaurant'
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import CheckCircleIcon  from '@mui/icons-material/CheckCircle'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PersonPinIcon    from '@mui/icons-material/PersonPin'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import MenuBookIcon     from '@mui/icons-material/MenuBook'
import GroupsIcon       from '@mui/icons-material/Groups'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { useApp } from '../context/AppContext'
import { C } from '../theme'
import { hasModule } from '../lib/modules'
import { DB } from '../lib/db'
import CheckoutConsentDialog from '../components/CheckoutConsentDialog'
import ChallengeCard from '../components/ChallengeCard'

// Format price helper — keeps in sync with Programs.jsx
function formatPrice(cents, currency = 'BGN') {
  const amount = (cents / 100).toFixed(2).replace(/\.00$/, '')
  return currency === 'EUR' ? `${amount} EUR` : `${amount} лв`
}

const VIBER_LINK = 'https://invite.viber.com/?g2=AQAEHMI4GEukN1bA7byJAaMIQ0bmNQscqaB2r0HDjfG7PX23NyIbFPg20AHRLSyz'

// Normalize a Bulgarian mobile number to E.164 (+359XXXXXXXXX); null if invalid.
// Accepts 0885123456, +359885123456, 359885..., with spaces/dashes.
function normalizeBgPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('359')) d = d.slice(3)
  else if (d.startsWith('0')) d = d.slice(1)
  return /^8[7-9]\d{7}$/.test(d) ? '+359' + d : null
}

// ── Result promises — concrete, specific, differentiating ─────────
const RESULTS_BG = [
  'Изграждане на устойчив ритъм за 8 седмици',
  'Навици, които остават за цял живот',
  'Личен ментор — не бот, реален човек',
  'Сила и стойка, които усещаш всеки ден',
]
const RESULTS_EN = [
  'Build a sustainable routine in 8 weeks',
  'Habits that stay for life',
  'A real human mentor — not a bot',
  'Strength and posture you feel daily',
]

// ── What you get — the unique combo, all in one place ────────────
const FEATURES_BG = [
  { Icon: CalendarMonthIcon, title: '8 седмици с ментор',     sub: 'Структуриран път, седмица по седмица' },
  { Icon: PersonPinIcon,     title: 'Личен ментор',            sub: '2 check-in сесии на месец, реален треньор' },
  { Icon: FitnessCenterIcon, title: 'Видео на всяко упражнение', sub: 'Перфектна форма, бавно и чисто' },
  { Icon: RestaurantIcon,    title: 'Храна + тегло + стъпки',  sub: 'Всичко в един tracker, без external апове' },
  { Icon: MenuBookIcon,      title: 'Рецепти и меню',          sub: 'Предефинирани ястия, готови за готвене' },
  { Icon: GroupsIcon,        title: 'Общност и класация',      sub: 'Стена, значки, мотивация всеки ден' },
]
const FEATURES_EN = [
  { Icon: CalendarMonthIcon, title: '8 weeks with a mentor',   sub: 'A structured path, week by week' },
  { Icon: PersonPinIcon,     title: 'Personal mentor',          sub: '2 monthly check-ins, real coach' },
  { Icon: FitnessCenterIcon, title: 'Video on every exercise', sub: 'Perfect form, slow and clean' },
  { Icon: RestaurantIcon,    title: 'Food + weight + steps',   sub: 'All in one tracker, no extra apps' },
  { Icon: MenuBookIcon,      title: 'Recipes & meal plans',    sub: 'Predefined dishes ready to cook' },
  { Icon: GroupsIcon,        title: 'Community & ranking',     sub: 'Feed, badges, daily motivation' },
]

export default function LeadHome() {
  const { auth, client, setView, lang, t, showSnackbar, setPendingProgramOpen, savePhone } = useApp()
  const modules = auth?.modules || []
  const results  = lang === 'en' ? RESULTS_EN  : RESULTS_BG
  const features = lang === 'en' ? FEATURES_EN : FEATURES_BG

  // ── Load SYNRG Метод program from DB (first active program) ─────
  const [program, setProgram]     = useState(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [buyLoading, setBuyLoading]   = useState(false)

  // ── Viber join: capture phone before opening the group invite ──────
  const [viberOpen, setViberOpen]   = useState(false)
  const [viberPhone, setViberPhone] = useState(client?.phone || '')
  const [viberBusy, setViberBusy]   = useState(false)
  const viberPhoneOk = !!normalizeBgPhone(viberPhone)

  const confirmViber = async () => {
    const normalized = normalizeBgPhone(viberPhone)
    if (!normalized) return
    setViberBusy(true)
    try { await savePhone(normalized) } catch { /* non-blocking — still let them join */ }
    // Navigate (not window.open): a popup opened after an await is blocked by the
    // browser, so on mobile it looked like "nothing happened". location.href
    // reliably fires the Viber deep-link / invite page.
    window.location.href = VIBER_LINK
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const progs = await DB.getPrograms('active')
        if (!alive) return
        // Pick the first active program (SYNRG Метод). If multiple, lowest display_order.
        if (progs && progs.length > 0) setProgram(progs[0])
      } catch {
        // silent fail — fallback to default price label below
      }
    })()
    return () => { alive = false }
  }, [])

  // ── CTA: redirect to marketing site's SYNRG Метод landing page (full sales LP).
  // The LP has detailed description, "за кого е", "как работи", reviews, FAQ, buy button.
  const openConsent = () => {
    window.location.href = '../synrg-method.html'
  }

  const proceedToStripe = async () => {
    if (!program?.stripe_price_id) return
    setBuyLoading(true)
    try {
      const baseUrl = window.location.origin + window.location.pathname
      const result = await DB.createCheckoutSession(
        program.id, auth.id, program.stripe_price_id,
        `${baseUrl}?purchase=success&program_id=${program.id}#/programs`,
        `${baseUrl}#/`, lang,
      )
      if (result?.url) {
        window.location.href = result.url
      } else {
        if (showSnackbar) showSnackbar(t('purchaseError') || 'Грешка при плащане')
        setBuyLoading(false)
        setConsentOpen(false)
      }
    } catch {
      if (showSnackbar) showSnackbar(t('purchaseError') || 'Грешка при плащане')
      setBuyLoading(false)
      setConsentOpen(false)
    }
  }

  const heroTitle      = lang === 'en' ? '8 weeks to transform your body and rhythm' : '8 седмици да променим тялото и ритъма ти'
  const heroOverline   = 'SYNRG МЕТОД'
  const heroSub        = lang === 'en'
    ? 'A method built by a doctor — no diets, no grueling workouts, but with a mentor, a clear path and a community. Everything you need.'
    : 'Метод, изграден от лекар — без диети, без тежки тренировки, а с ментор, ясен път и общност. Всичко, което ти трябва.'
  const ctaLabel       = lang === 'en' ? 'Start SYNRG Method'  : 'Започни SYNRG Метод'
  // Dynamic price label — falls back to 397 лв if program hasn't loaded yet
  const priceFromDb    = program ? formatPrice(program.price_cents, program.currency) : '397 лв'
  const priceLabel     = lang === 'en'
    ? 'Online. A method built by doctors and coaches.'
    : 'Онлайн. Метод изграден от лекари и треньори.'
  const trackersTitle  = lang === 'en' ? 'Your free trackers' : 'Безплатните ти трекери'
  const whatYouGetLabel= lang === 'en' ? "What you get with SYNRG Method" : 'Какво получаваш със SYNRG Метод'
  const resultsTitle   = lang === 'en' ? 'What you can expect' : 'Какво можеш да очакваш'
  const programName    = program ? (lang === 'en' && program.name_en ? program.name_en : program.name_bg) : 'SYNRG Метод'

  const firstName = (auth?.name || '').split(' ')[0]
  const greeting  = lang === 'en'
    ? (firstName ? `Hey, ${firstName}.` : 'Hey.')
    : (firstName ? `Здравей, ${firstName}.` : 'Здравей.')

  const trackers = [
    { key: 'food',   Icon: RestaurantIcon,    label: t('navFood')   || 'Храна',   view: 'food',   module: 'nutrition_tracking' },
    { key: 'weight', Icon: MonitorWeightIcon, label: t('navWeight') || 'Тегло',  view: 'weight', module: 'weight_tracking'    },
    { key: 'steps',  Icon: DirectionsRunIcon, label: t('navSteps')  || 'Стъпки', view: 'steps',  module: 'nutrition_tracking' },
  ]

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>

      {/* ── Greeting ─────────────────────────────────────── */}
      <Typography sx={{
        fontSize: { xs: '22px', sm: '26px' },
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: C.text,
      }}>
        {greeting}
      </Typography>

      {/* ── In-app 7-day challenge (the zero-friction on-ramp) ── */}
      <ChallengeCard />

      {/* ── Freemium trackers — keep them using the app ─── */}
      <Box>
        <Typography sx={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '2px',
          color: C.muted,
          mb: 1.25,
          textTransform: 'uppercase',
        }}>
          {trackersTitle}
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.25,
        }}>
          {trackers.map(({ key, Icon, label, view, module }) => {
            const enabled = hasModule(modules, module)
            return (
              <Box
                key={key}
                onClick={() => enabled && setView(view)}
                sx={{
                  background: 'rgba(170,169,205,0.22)',
                  border: `1.5px solid ${C.purpleA20}`,
                  borderRadius: '14px',
                  p: 1.75,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  cursor: enabled ? 'pointer' : 'default',
                  opacity: enabled ? 1 : 0.5,
                  transition: 'background 0.2s, border-color 0.2s',
                  '@media (hover: hover)': {
                    '&:hover': enabled ? {
                      background: C.card,
                      borderColor: C.purple,
                    } : {},
                  },
                }}
              >
                <Icon sx={{ fontSize: 24, color: C.purple }} />
                <Typography sx={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: C.text,
                }}>
                  {label}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* ── Viber group CTA — captures the phone before opening the invite ── */}
        <Button
          onClick={() => setViberOpen(o => !o)}
          fullWidth
          startIcon={<GroupsIcon sx={{ fontSize: 20 }} />}
          sx={{
            mt: 1.25,
            background: 'rgba(115,96,242,0.14)',
            border: '1.5px solid rgba(115,96,242,0.5)',
            color: '#b5a8ff',
            fontWeight: 800,
            textTransform: 'none',
            py: 1,
            borderRadius: '14px',
            fontSize: '13px',
            '&:hover': { background: 'rgba(115,96,242,0.24)', borderColor: '#7360f2' },
          }}
        >
          {lang === 'en' ? 'Join the Viber group' : 'Влез в Viber групата'}
        </Button>

        <Collapse in={viberOpen}>
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ fontSize: '12.5px', lineHeight: 1.45, color: C.muted, mb: 1 }}>
              {lang === 'en'
                ? 'Enter your Viber phone number so we can add you to the group.'
                : 'Въведи телефона си във Viber, за да те добавим в групата.'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="stretch">
              <TextField
                value={viberPhone}
                onChange={(e) => setViberPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && viberPhoneOk && !viberBusy) confirmViber() }}
                placeholder={lang === 'en' ? 'Viber phone' : 'Viber телефон'}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: C.text, borderRadius: '12px', background: 'rgba(255,255,255,0.03)',
                    '& fieldset': { borderColor: 'rgba(115,96,242,0.4)' },
                    '&:hover fieldset': { borderColor: '#7360f2' },
                    '&.Mui-focused fieldset': { borderColor: '#7360f2' },
                  },
                  '& input::placeholder': { color: C.muted, opacity: 0.7 },
                }}
              />
              <Button
                onClick={confirmViber}
                disabled={!viberPhoneOk || viberBusy}
                endIcon={viberBusy ? <CircularProgress size={15} sx={{ color: '#0A0A14' }} /> : <ArrowForwardIcon sx={{ fontSize: 17 }} />}
                sx={{
                  flexShrink: 0, background: '#7360f2', color: '#fff', fontWeight: 800, textTransform: 'none',
                  px: 2, borderRadius: '12px', fontSize: '13px', whiteSpace: 'nowrap',
                  '&:hover': { background: '#8676f5' },
                  '&.Mui-disabled': { background: 'rgba(115,96,242,0.25)', color: 'rgba(255,255,255,0.5)' },
                }}
              >
                {lang === 'en' ? 'Join' : 'Влез'}
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </Box>

      {/* ── Discreet SYNRG Метод card (secondary offer, below trackers) ── */}
      <Box sx={{
        background: C.primaryContainer,
        border: `1px solid ${C.border}`,
        borderRadius: '16px',
        p: { xs: 1.75, sm: 2 },
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1.5,
      }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2.5px', color: C.purple, mb: 0.5 }}>
            {heroOverline}
          </Typography>
          <Typography sx={{ fontSize: { xs: '14px', sm: '15px' }, fontWeight: 800, color: C.text, lineHeight: 1.25 }}>
            {lang === 'en'
              ? 'Let us help you reach your goal with the full program.'
              : 'Нека ти помогнем да постигнеш целта си с пълната си програма.'}
          </Typography>
          <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.25 }}>
            {priceLabel}
          </Typography>
        </Box>
        <Button
          onClick={openConsent}
          disabled={buyLoading}
          variant="outlined"
          endIcon={buyLoading
            ? <CircularProgress size={14} sx={{ color: C.purple }} />
            : <ArrowForwardIcon sx={{ fontSize: 16 }} />}
          sx={{
            flexShrink: 0,
            borderColor: C.purpleA20,
            color: C.purple,
            fontWeight: 800,
            textTransform: 'none',
            py: 0.85, px: 2,
            borderRadius: '12px',
            fontSize: '13px',
            '&:hover': { borderColor: C.purple, background: C.purpleA5 },
          }}
        >
          {ctaLabel}
        </Button>
      </Box>

      {/* ── Educational disclaimer ──────────────────────── */}
      <Typography sx={{
        fontSize: '10px',
        color: C.muted,
        opacity: 0.55,
        textAlign: 'center',
        lineHeight: 1.45,
        px: 2,
        mt: 0.5,
      }}>
        {lang === 'en'
          ? 'SYNRG is an educational method for healthy habits. It is not a medical service and does not replace consultation with a physician. Individual results may vary.'
          : 'SYNRG е образователен метод за здравословни навици. Не е медицинска услуга и не замества консултация с лекар. Индивидуалните резултати може да варират.'}
      </Typography>

      {/* ── Company info (mandatory per ЗЕТ Чл. 4) ─────── */}
      <Typography sx={{
        fontSize: '10px',
        color: C.muted,
        opacity: 0.45,
        textAlign: 'center',
        lineHeight: 1.55,
        px: 2,
        mt: 0.5,
      }}>
        {lang === 'en'
          ? 'Sinerji 93 Ltd. · UIC 207343690 · info@synrg-beyondfitness.com · Supervisory authority: Consumer Protection Commission, kzp.bg, 0700 111 22'
          : 'Синерджи 93 ООД · ЕИК 207343690 · info@synrg-beyondfitness.com · Надзорен орган: Комисия за защита на потребителите, kzp.bg, 0700 111 22'}
      </Typography>

      {/* ── Checkout consent gate (Чл. 57 т. 12 ЗЗП + Terms + Health) ── */}
      <CheckoutConsentDialog
        open={consentOpen}
        onClose={() => { if (!buyLoading) setConsentOpen(false) }}
        onConfirm={proceedToStripe}
        programName={programName}
        price={priceFromDb}
        loading={buyLoading}
      />
    </Box>
  )
}
