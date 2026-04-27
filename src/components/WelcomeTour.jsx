// ── WelcomeTour ─────────────────────────────────────────────────────
// Global onboarding tour for online clients. Walks the client through
// the key screens of the app with a spotlight + tooltip for each step.
//
// Steps navigate across routes (setView) and sub-tabs (pendingProgressTab).
// Each step scrolls its target element into view and highlights it.
//
// Persistence:
//   • synrg_tour_step_<auth.id>       — current step index (survives reload)
//   • synrg_welcome_dismissed_<auth.id> — '1' after the tour is closed
//
// Mount globally (e.g. in App.jsx AppShell) and it will auto-activate
// for online clients who haven't dismissed it yet.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography, Button, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

// ── Tour configuration ─────────────────────────────────────────────
// Each step describes: what route/sub-tab to show, which element to
// spotlight (data-tour attribute), and the copy to display.
// Copy for each step comes from translations (bg + en). The `i18n` field
// is the prefix — we resolve `<prefix>_eyebrow`, `<prefix>_title`,
// `<prefix>_body` at render time via t().
const STEPS = [
  { key: 'welcome',       view: 'dashboard', tab: null,       target: null,                         i18n: 'tour_welcome'       },
  // ── Section 1: Today (dashboard) ──────────────────────────────
  { key: 'nav-dashboard', view: 'dashboard', tab: null,       target: '[data-tour="nav-dashboard"]', i18n: 'tour_navDashboard' },
  { key: 'focus',         view: 'dashboard', tab: null,       target: '[data-tour="focus"]',         i18n: 'tour_focus'         },
  { key: 'dailies',       view: 'dashboard', tab: null,       target: '[data-tour="dailies"]',       i18n: 'tour_dailies'       },
  { key: 'workout',       view: 'dashboard', tab: null,       target: '[data-tour="workout"]',       i18n: 'tour_workout'       },
  { key: 'chat',          view: 'dashboard', tab: null,       target: '[data-tour="chat"]',          i18n: 'tour_chat'          },
  // ── Section 2: Progress ───────────────────────────────────────
  { key: 'nav-progress',  view: 'progress',  tab: 'progress', target: '[data-tour="nav-progress"]',  i18n: 'tour_navProgress'   },
  { key: 'badges',        view: 'progress',  tab: 'progress', target: '[data-tour="tab-badges"]',    i18n: 'tour_badges'        },
  { key: 'ranking',       view: 'progress',  tab: 'ranking',  target: '[data-tour="tab-ranking"]',   i18n: 'tour_ranking'       },
  // ── Section 3: Resources ──────────────────────────────────────
  { key: 'nav-resources', view: 'programs',  tab: null,       target: '[data-tour="nav-programs"]',  i18n: 'tour_navResources'  },
  { key: 'recipes',       view: 'recipes',   tab: null,       target: '[data-tour="recipes"]',       i18n: 'tour_recipes'       },
]

const TOTAL = STEPS.length
const PADDING = 8           // px around the spotlight rectangle
const TOOLTIP_GAP = 16      // px gap between spotlight and tooltip
const TOOLTIP_WIDTH = 360   // max tooltip width
const SCROLL_DELAY = 250    // ms wait after route change before scrolling

// Read persisted step / dismissed state
const readStep = (id) => {
  try {
    const raw = localStorage.getItem(`synrg_tour_step_${id}`)
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 && n < TOTAL ? n : 0
  } catch { return 0 }
}
const readDismissed = (id) => {
  try { return localStorage.getItem(`synrg_welcome_dismissed_${id}`) === '1' } catch { return false }
}

export default function WelcomeTour() {
  const { auth, view, setView, setPendingProgressTab, t } = useApp()

  // Only run for online clients. We detect via a lightweight signal: the
  // auth object has role='client' and the online tier is active. To keep
  // this component self-contained and avoid circular dependencies we
  // read the localStorage flag set by OnlineHome / App, falling back to
  // 'active if not dismissed'.
  const [dismissed, setDismissed] = useState(() => readDismissed(auth?.id))
  const [step, setStep] = useState(() => readStep(auth?.id))
  const [rect, setRect] = useState(null)      // target bounding rect (viewport)
  const [ready, setReady] = useState(false)   // target element located

  // Re-read persisted state when auth changes
  useEffect(() => {
    setDismissed(readDismissed(auth?.id))
    setStep(readStep(auth?.id))
  }, [auth?.id])

  const active = Boolean(auth?.id) && !dismissed
  const current = STEPS[step] || STEPS[0]

  // Navigate to the correct view/tab whenever the step changes.
  useEffect(() => {
    if (!active) return
    if (current.view && view !== current.view) setView(current.view)
    if (current.tab) setPendingProgressTab(current.tab)
  }, [active, current.view, current.tab, step])

  // Locate the target element + observe its position. Retries briefly
  // while the target page mounts.
  useLayoutEffect(() => {
    if (!active) return
    setReady(false)
    setRect(null)
    if (!current.target) { setReady(true); return }

    let cancelled = false
    let retries = 0
    const maxRetries = 30 // ~3s total
    const tick = () => {
      if (cancelled) return
      const el = document.querySelector(current.target)
      if (el) {
        // For very tall targets, scroll so the TOP of the element is just
        // below the page's top edge — this keeps sub-tab bars and headers
        // inside the spotlight visible.
        const r0 = el.getBoundingClientRect()
        if (r0.height > window.innerHeight * 0.7) {
          // Find the nearest scrollable ancestor
          let scroller = el.parentElement
          while (scroller && scroller !== document.body) {
            const style = getComputedStyle(scroller)
            if (/(auto|scroll)/.test(style.overflowY)) break
            scroller = scroller.parentElement
          }
          const target = scroller && scroller !== document.body ? scroller : window
          const curTop = (target === window ? window.scrollY : target.scrollTop) || 0
          const delta = r0.top - 16 // 16px breathing room above
          if (target === window) window.scrollTo({ top: curTop + delta, behavior: 'smooth' })
          else target.scrollTo({ top: curTop + delta, behavior: 'smooth' })
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        // Allow the scroll to settle before measuring
        setTimeout(() => {
          if (cancelled) return
          const r = el.getBoundingClientRect()
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
          setReady(true)
        }, SCROLL_DELAY)
        return
      }
      if (retries++ < maxRetries) setTimeout(tick, 100)
      else { setReady(true) /* show centered if target never appears */ }
    }
    tick()

    // Keep the rect in sync while on this step
    const onResize = () => {
      const el = document.querySelector(current.target)
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [active, step, current.target, view])

  const goTo = (next) => {
    const clamped = Math.max(0, Math.min(TOTAL - 1, next))
    setStep(clamped)
    try { localStorage.setItem(`synrg_tour_step_${auth?.id}`, String(clamped)) } catch {}
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(`synrg_welcome_dismissed_${auth?.id}`, '1')
      localStorage.removeItem(`synrg_tour_step_${auth?.id}`)
    } catch {}
  }

  // Compute tooltip position: below the target if there is room, else above.
  // If the target is taller than the viewport (e.g. a full page wrapper) we
  // pin the tooltip to the bottom of the viewport so it doesn't cover the
  // top of the spotlight (where tabs/headers typically live).
  const tooltipStyle = useMemo(() => {
    if (!rect) return null
    const vw = window.innerWidth
    const vh = window.innerHeight
    const TOOLTIP_H = 240
    const width = Math.min(TOOLTIP_WIDTH, vw - 24)

    // Case 1: target overflows viewport — pin tooltip to bottom
    if (rect.height > vh - 120) {
      const top = vh - TOOLTIP_H - 24
      const rawLeft = vw / 2 - width / 2
      const left = Math.max(12, Math.min(vw - width - 12, rawLeft))
      return { top, left, width }
    }

    // Pick the side (above / below) with more empty space so the tooltip
    // lands over the emptier region, not over content right next to the pill.
    const spaceBelow = vh - (rect.top + rect.height)
    const spaceAbove = rect.top
    const below = spaceBelow >= spaceAbove
    let top = below
      ? rect.top + rect.height + TOOLTIP_GAP + PADDING
      : rect.top - TOOLTIP_GAP - PADDING - TOOLTIP_H

    // Clamp vertically so the card is always fully on-screen
    top = Math.max(12, Math.min(vh - TOOLTIP_H - 12, top))

    const rawLeft = rect.left + rect.width / 2 - width / 2
    const left = Math.max(12, Math.min(vw - width - 12, rawLeft))
    return { top, left, width }
  }, [rect])

  if (!active || !ready) return null

  const isLast = step >= TOTAL - 1
  const hasTarget = Boolean(current.target && rect)

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {/* Light dim only when no target (welcome step) so the centered tooltip reads cleanly */}
      {!hasTarget && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.55)',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Subtle highlight on the target — no dim overlay, just a glowing ring */}
      {hasTarget && (
        <Box
          sx={{
            position: 'absolute',
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            borderRadius: 999,
            border: `3px solid #F09664`,
            boxShadow: `0 0 0 4px rgba(240,150,100,0.28), 0 0 28px rgba(240,150,100,0.65)`,
            pointerEvents: 'none',
            transition: 'all 180ms ease',
          }}
        />
      )}

      {/* Tooltip card */}
      <Box
        sx={{
          position: 'absolute',
          pointerEvents: 'auto',
          ...(hasTarget && tooltipStyle ? tooltipStyle : {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `min(${TOOLTIP_WIDTH}px, calc(100vw - 24px))`,
          }),
        }}
      >
        <Box
          sx={{
            position: 'relative',
            p: 2.5,
            borderRadius: 3,
            background: '#15151f',
            border: `1px solid ${C.loganBorder || 'rgba(170,169,205,0.35)'}`,
            boxShadow: '0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4)',
          }}
        >
          <IconButton
            onClick={dismiss}
            size="small"
            sx={{ position: 'absolute', top: 6, right: 6, color: C.muted }}
            aria-label={t('tour_close')}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Typography
            sx={{
              fontSize: 11,
              letterSpacing: 1.4,
              color: C.primary,
              fontWeight: 700,
              mb: 0.5,
              pr: 3,
            }}
          >
            {t(`${current.i18n}_eyebrow`)}
          </Typography>
          <Typography
            sx={{
              fontStyle: 'italic',
              fontWeight: 700,
              fontSize: 22,
              lineHeight: 1.2,
              mb: 1,
              color: C.text,
            }}
          >
            {t(`${current.i18n}_title`)}
          </Typography>
          <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: C.muted }}>
            {t(`${current.i18n}_body`)}
          </Typography>

          {/* Dots + actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {STEPS.map((_, i) => (
                <Box
                  key={i}
                  onClick={() => goTo(i)}
                  sx={{
                    width: i === step ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    bgcolor: i === step ? C.primary : 'rgba(255,255,255,0.18)',
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                  }}
                />
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {step > 0 && (
                <Button
                  size="small"
                  onClick={() => goTo(step - 1)}
                  sx={{ color: C.muted, textTransform: 'none' }}
                >
                  {t('tour_back')}
                </Button>
              )}
              {!isLast && step === 0 && (
                <Button
                  size="small"
                  onClick={dismiss}
                  sx={{ color: C.muted, textTransform: 'none' }}
                >
                  {t('tour_skip')}
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                onClick={() => isLast ? dismiss() : goTo(step + 1)}
                sx={{
                  bgcolor: C.primary,
                  color: '#0a1a0c',
                  textTransform: 'none',
                  fontWeight: 700,
                  '&:hover': { bgcolor: C.primary, filter: 'brightness(1.1)' },
                }}
              >
                {isLast ? t('tour_start') : t('tour_next')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
