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
//      SYNRG's unique combo (ментор + програма + trackers + рецепти +
//      общност — all in one place).
//   3. Provide a single clear CTA to start SYNRG Метод — opens checkout
//      consent dialog (3 mandatory checkboxes per BG/EU law) → Stripe.

import { useState, useEffect } from 'react'
import { Box, Typography, Button, Stack, Chip, CircularProgress } from '@mui/material'
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

// Format price helper — keeps in sync with Programs.jsx
function formatPrice(cents, currency = 'BGN') {
  const amount = (cents / 100).toFixed(2).replace(/\.00$/, '')
  return currency === 'EUR' ? `${amount} EUR` : `${amount} лв`
}

// ── Result promises — concrete, specific, differentiating ─────────
const RESULTS_BG = [
  'Изграждане на устойчив режим за 8 седмици',
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
  { Icon: CalendarMonthIcon, title: '8-седмична програма',    sub: 'Структурирана тренировъчна седмица по седмица' },
  { Icon: PersonPinIcon,     title: 'Личен ментор',            sub: '2 check-in сесии на месец, реален треньор' },
  { Icon: FitnessCenterIcon, title: 'Видео на всяко упражнение', sub: 'Перфектна форма, бавно и чисто' },
  { Icon: RestaurantIcon,    title: 'Храна + тегло + стъпки',  sub: 'Всичко в един tracker, без external апове' },
  { Icon: MenuBookIcon,      title: 'Рецепти и меню',          sub: 'Предефинирани ястия, готови за готвене' },
  { Icon: GroupsIcon,        title: 'Общност и класация',      sub: 'Стена, значки, мотивация всеки ден' },
]
const FEATURES_EN = [
  { Icon: CalendarMonthIcon, title: '8-week program',          sub: 'Structured week by week' },
  { Icon: PersonPinIcon,     title: 'Personal mentor',          sub: '2 monthly check-ins, real coach' },
  { Icon: FitnessCenterIcon, title: 'Video on every exercise', sub: 'Perfect form, slow and clean' },
  { Icon: RestaurantIcon,    title: 'Food + weight + steps',   sub: 'All in one tracker, no extra apps' },
  { Icon: MenuBookIcon,      title: 'Recipes & meal plans',    sub: 'Predefined dishes ready to cook' },
  { Icon: GroupsIcon,        title: 'Community & ranking',     sub: 'Feed, badges, daily motivation' },
]

export default function LeadHome() {
  const { auth, setView, lang, t, showSnackbar, setPendingProgramOpen } = useApp()
  const modules = auth?.modules || []
  const results  = lang === 'en' ? RESULTS_EN  : RESULTS_BG
  const features = lang === 'en' ? FEATURES_EN : FEATURES_BG

  // ── Load SYNRG Метод program from DB (first active program) ─────
  const [program, setProgram]     = useState(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [buyLoading, setBuyLoading]   = useState(false)

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

  const heroTitle      = lang === 'en' ? '8 weeks to transform your body and routine' : '8 седмици да променим тялото и режима ти'
  const heroOverline   = 'SYNRG МЕТОД'
  const heroSub        = lang === 'en'
    ? 'The only platform in Bulgaria that combines a mentor, a structured program, trackers, recipes and a community — all in one place.'
    : 'Единствената платформа в България с ментор, структурирана програма, трекери, рецепти и общност — всичко на едно място.'
  const ctaLabel       = lang === 'en' ? 'Start SYNRG Method'  : 'Започни SYNRG Метод'
  // Dynamic price label — falls back to 397 лв if program hasn't loaded yet
  const priceFromDb    = program ? formatPrice(program.price_cents, program.currency) : '397 лв'
  const priceLabel     = lang === 'en'
    ? `${priceFromDb} · one-time · 8 weeks`
    : `${priceFromDb} · еднократно · 8 седмици`
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

      {/* ── Hero marketing card ─────────────────────────── */}
      <Box sx={{
        position: 'relative',
        background: `linear-gradient(135deg, ${C.primaryContainer} 0%, rgba(200,197,255,0.06) 100%)`,
        border: `1px solid ${C.purpleA20}`,
        borderRadius: '20px',
        p: { xs: 2.5, sm: 3.5 },
        overflow: 'hidden',
      }}>
        {/* Subtle glow */}
        <Box sx={{
          position: 'absolute', top: -60, right: -60,
          width: 180, height: 180, borderRadius: '50%',
          background: C.purpleGlow,
          filter: 'blur(60px)',
          opacity: 0.6,
          pointerEvents: 'none',
        }} />

        <Typography sx={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '3px',
          color: C.purple,
          mb: 1.25,
        }}>
          {heroOverline}
        </Typography>

        <Typography sx={{
          fontSize: { xs: '26px', sm: '34px' },
          lineHeight: 1.1,
          fontWeight: 800,
          fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif",
          color: C.text,
          mb: 1.5,
        }}>
          {heroTitle}
        </Typography>

        <Typography sx={{
          fontSize: { xs: '14px', sm: '15px' },
          lineHeight: 1.55,
          color: C.muted,
          mb: 2.5,
          maxWidth: 560,
        }}>
          {heroSub}
        </Typography>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            onClick={openConsent}
            disabled={buyLoading}
            variant="contained"
            endIcon={buyLoading
              ? <CircularProgress size={16} sx={{ color: '#0A0A14' }} />
              : <ArrowForwardIcon />}
            sx={{
              background: C.purple,
              color: '#0A0A14',
              fontWeight: 800,
              textTransform: 'none',
              px: 2.5, py: 1.1,
              borderRadius: '12px',
              letterSpacing: '0.2px',
              '&:hover': { background: C.purpleLighter },
            }}
          >
            {ctaLabel}
          </Button>
          <Chip
            label={priceLabel}
            sx={{
              background: 'transparent',
              color: C.muted,
              fontWeight: 700,
              fontSize: '12px',
              border: `1px solid ${C.border}`,
              height: 32,
            }}
          />
        </Stack>
      </Box>

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
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: '14px',
                  p: 1.75,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  cursor: enabled ? 'pointer' : 'default',
                  opacity: enabled ? 1 : 0.5,
                  transition: 'background 0.2s, border-color 0.2s',
                  '&:hover': enabled ? {
                    background: C.cardHigh,
                    borderColor: C.purpleA20,
                  } : {},
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
      </Box>

      {/* ── Final CTA (sticky feel) ─────────────────────── */}
      <Button
        onClick={openConsent}
        disabled={buyLoading}
        variant="outlined"
        endIcon={buyLoading
          ? <CircularProgress size={16} sx={{ color: C.purple }} />
          : <ArrowForwardIcon />}
        sx={{
          alignSelf: 'stretch',
          borderColor: C.purpleA20,
          color: C.purple,
          fontWeight: 800,
          textTransform: 'none',
          py: 1.25,
          borderRadius: '14px',
          fontSize: '14px',
          '&:hover': {
            borderColor: C.purple,
            background: C.purpleA5,
          },
        }}
      >
        {ctaLabel}
      </Button>

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
