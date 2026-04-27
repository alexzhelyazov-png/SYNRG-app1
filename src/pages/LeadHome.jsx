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
//   3. Provide a single clear CTA to start SYNRG Метод (routes into the
//      Programs / Ресурси tab where the purchase flow lives).
//
// No studio / online specific content is shown.

import { Box, Typography, Button, Stack, Chip } from '@mui/material'
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

// ── Result promises — concrete, specific, differentiating ─────────
const RESULTS_BG = [
  'Свали до 8 кг устойчиво за 8 седмици',
  'Изгради режим, който остава за цял живот',
  'Личен ментор — не бот, реален човек',
  'Сила и стойка, които усещаш всеки ден',
]
const RESULTS_EN = [
  'Lose up to 8 kg sustainably in 8 weeks',
  'Build a routine that stays for life',
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
  const { auth, setView, lang, t } = useApp()
  const modules = auth?.modules || []
  const results  = lang === 'en' ? RESULTS_EN  : RESULTS_BG
  const features = lang === 'en' ? FEATURES_EN : FEATURES_BG

  const heroTitle      = lang === 'en' ? '8 weeks to transform your body and routine' : '8 седмици да променим тялото и режима ти'
  const heroOverline   = 'SYNRG МЕТОД'
  const heroSub        = lang === 'en'
    ? 'The only platform in Bulgaria that combines a mentor, a structured program, trackers, recipes and a community — all in one place.'
    : 'Единствената платформа в България с ментор, структурирана програма, трекери, рецепти и общност — всичко на едно място.'
  const ctaLabel       = lang === 'en' ? 'Start SYNRG Method'  : 'Започни SYNRG Метод'
  const priceLabel     = lang === 'en' ? '199 BGN · one-time · 8 weeks' : '199 лв · еднократно · 8 седмици'
  const trackersTitle  = lang === 'en' ? 'Your free trackers' : 'Безплатните ти трекери'
  const whatYouGetLabel= lang === 'en' ? "What you get with SYNRG Method" : 'Какво получаваш със SYNRG Метод'
  const resultsTitle   = lang === 'en' ? 'What you can expect' : 'Какво можеш да очакваш'

  const firstName = (auth?.name || '').split(' ')[0]
  const greeting  = lang === 'en'
    ? (firstName ? `Hey, ${firstName}.` : 'Hey.')
    : (firstName ? `Здравей, ${firstName}.` : 'Здравей.')

  const goToPrograms = () => setView('programs')

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
            onClick={goToPrograms}
            variant="contained"
            endIcon={<ArrowForwardIcon />}
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

      {/* ── Results block (concrete promises) ───────────── */}
      <Box sx={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '18px',
        p: { xs: 2, sm: 2.5 },
      }}>
        <Typography sx={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '2px',
          color: C.muted,
          mb: 1.5,
          textTransform: 'uppercase',
        }}>
          {resultsTitle}
        </Typography>
        <Stack spacing={1.25}>
          {results.map((r, i) => (
            <Stack key={i} direction="row" spacing={1.25} alignItems="flex-start">
              <CheckCircleIcon sx={{ fontSize: 18, color: C.purple, mt: '2px', flexShrink: 0 }} />
              <Typography sx={{
                fontSize: { xs: '14px', sm: '15px' },
                fontWeight: 600,
                color: C.text,
                lineHeight: 1.45,
              }}>
                {r}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* ── What you get (feature grid) ─────────────────── */}
      <Box sx={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '18px',
        p: { xs: 2, sm: 2.5 },
      }}>
        <Typography sx={{
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '2px',
          color: C.muted,
          mb: 1.75,
          textTransform: 'uppercase',
        }}>
          {whatYouGetLabel}
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
        }}>
          {features.map(({ Icon, title, sub }, i) => (
            <Box key={i} sx={{
              display: 'flex',
              gap: 1.5,
              p: 1.5,
              borderRadius: '14px',
              background: C.primaryA3,
              border: `1px solid ${C.border}`,
            }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: C.purpleA13,
                color: C.purple,
                flexShrink: 0,
              }}>
                <Icon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: C.text, lineHeight: 1.2, mb: '2px' }}>
                  {title}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: C.muted, lineHeight: 1.35 }}>
                  {sub}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
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
        onClick={goToPrograms}
        variant="outlined"
        endIcon={<ArrowForwardIcon />}
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
          ? 'SYNRG is an educational method for healthy habits. It is not a medical service and does not replace consultation with a physician.'
          : 'SYNRG е образователен метод за здравословни навици. Не е медицинска услуга и не замества консултация с лекар.'}
      </Typography>
    </Box>
  )
}
