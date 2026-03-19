import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box, Typography, Paper, Button, IconButton, LinearProgress, Chip,
  CircularProgress,
} from '@mui/material'
import ArrowBackIcon       from '@mui/icons-material/ArrowBack'
import PlayCircleIcon      from '@mui/icons-material/PlayCircle'
import CheckCircleIcon     from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import SkipNextIcon        from '@mui/icons-material/SkipNext'
import SkipPreviousIcon    from '@mui/icons-material/SkipPrevious'
import AccessTimeIcon      from '@mui/icons-material/AccessTime'
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore'
import ExpandLessIcon      from '@mui/icons-material/ExpandLess'
// Inline SVGs to avoid Vite dep optimization issues with @mui/icons-material
const LockSvg = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
)
const CartSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
)
import { useApp }          from '../context/AppContext'
import { DB }              from '../lib/db'
import { parseVideoUrl }   from '../lib/videoUtils'
import { hasModule }       from '../lib/modules'
import { C, EASE }         from '../theme'

// ── Video Embed Component ───────────────────────────────────
function VideoEmbed({ url }) {
  const parsed = parseVideoUrl(url)
  if (!parsed) return null

  if (parsed.type === 'direct') {
    return (
      <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
        <video
          src={parsed.embedUrl}
          controls
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: '16px', overflow: 'hidden', background: '#000' }}>
      <iframe
        src={parsed.embedUrl}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        loading="lazy"
      />
    </Box>
  )
}

/** Check if client can access a program (purchased or studio client) */
function canAccessProgram(auth, prog, purchases) {
  // Coaches/admins always have access
  if (auth.role === 'coach') return true
  // Free programs (no price)
  if (!prog.price_cents || prog.price_cents === 0) return true
  // Studio clients get all programs free
  if (hasModule(auth.modules, 'studio_access')) return true
  // Check if purchased
  if (purchases.some(p => p.program_id === prog.id)) return true
  return false
}

function formatPrice(cents, currency, t) {
  const amount = (cents / 100).toFixed(2).replace(/\.00$/, '')
  return currency === 'EUR' ? `${amount} EUR` : `${amount} ${t('currencyBGN')}`
}

// ── Programs List View ──────────────────────────────────────
function ProgramsList({ programs, progress, lessons, purchases, onSelect, onBuy, buyLoading, t, lang, auth }) {
  const n = (p) => lang === 'en' && p.name_en ? p.name_en : p.name_bg
  const d = (p) => lang === 'en' && p.description_en ? p.description_en : p.description_bg

  return (
    <Box>
      <Typography variant="overline" sx={{ color: C.primary, display: 'block', mb: 0.5 }}>
        {t('programsOverline')}
      </Typography>
      <Typography variant="h2" sx={{ color: C.text, mb: 3 }}>
        {t('programsTitle')}
      </Typography>

      {programs.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: C.muted, fontSize: '15px' }}>{t('noPrograms')}</Typography>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5 }}>
        {programs.map((prog, i) => {
          const hasAccess = canAccessProgram(auth, prog, purchases)
          const isPaid = prog.price_cents > 0
          const isPurchased = purchases.some(p => p.program_id === prog.id)
          const isStudioFree = hasModule(auth.modules, 'studio_access') && isPaid
          const progLessons   = lessons.filter(l => l.program_id === prog.id)
          const completedCount = hasAccess ? progLessons.filter(l => progress.some(p => p.lesson_id === l.id)).length : 0
          const totalCount     = progLessons.length
          const pct            = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

          return (
            <Paper
              key={prog.id}
              onClick={() => hasAccess ? onSelect(prog) : null}
              sx={{
                cursor: hasAccess ? 'pointer' : 'default',
                overflow: 'hidden', p: 0,
                animation: `fadeInUp 0.3s ${EASE.standard} both`,
                animationDelay: `${i * 0.08}s`,
                opacity: hasAccess ? 1 : 0.85,
                '&:hover': hasAccess ? { transform: 'translateY(-3px)' } : {},
              }}
            >
              {/* Cover image */}
              <Box sx={{
                width: '100%', pt: '50%', position: 'relative',
                background: prog.cover_url
                  ? `url(${prog.cover_url}) center/cover`
                  : `linear-gradient(135deg, ${C.primaryContainer} 0%, ${C.purpleSoft} 100%)`,
              }}>
                {/* Badges */}
                {hasAccess && pct === 100 && (
                  <Box sx={{
                    position: 'absolute', top: 12, right: 12,
                    background: C.primary, color: C.primaryOn,
                    borderRadius: '12px', px: 1.25, py: 0.4,
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px',
                  }}>
                    {t('completedLabel')}
                  </Box>
                )}
                {isPaid && !hasAccess && (
                  <Box sx={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'rgba(0,0,0,0.65)', color: '#fff',
                    borderRadius: '12px', px: 1.25, py: 0.4,
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px',
                    display: 'flex', alignItems: 'center', gap: 0.5,
                  }}>
                    <LockSvg />
                    {formatPrice(prog.price_cents, prog.currency, t)}
                  </Box>
                )}
                {isPurchased && (
                  <Box sx={{
                    position: 'absolute', top: 12, left: 12,
                    background: C.primary, color: C.primaryOn,
                    borderRadius: '12px', px: 1.25, py: 0.4,
                    fontSize: '11px', fontWeight: 800,
                  }}>
                    {t('purchased')}
                  </Box>
                )}
                {isStudioFree && !isPurchased && (
                  <Box sx={{
                    position: 'absolute', top: 12, left: 12,
                    background: 'rgba(200,197,255,0.9)', color: '#1a1a2e',
                    borderRadius: '12px', px: 1.25, py: 0.4,
                    fontSize: '10px', fontWeight: 800,
                  }}>
                    {t('includedStudio')}
                  </Box>
                )}
              </Box>

              {/* Card body */}
              <Box sx={{ p: 2.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '18px', color: C.text, mb: 0.5, lineHeight: 1.3 }}>
                  {n(prog)}
                </Typography>
                <Typography sx={{
                  fontSize: '13px', color: C.muted, mb: 2, lineHeight: 1.5,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {d(prog)}
                </Typography>

                {/* Progress (only if has access) */}
                {hasAccess && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        flex: 1, height: 6, borderRadius: 3,
                        backgroundColor: C.border,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          background: pct === 100
                            ? `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`
                            : `linear-gradient(90deg, ${C.primary}, ${C.primaryHover})`,
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: pct > 0 ? C.primary : C.muted, whiteSpace: 'nowrap' }}>
                      {completedCount}/{totalCount}
                    </Typography>
                  </Box>
                )}

                {/* Action buttons */}
                {hasAccess ? (
                  <Button
                    fullWidth
                    variant={pct === 0 ? 'contained' : 'outlined'}
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onSelect(prog) }}
                  >
                    {pct === 0 ? t('startProgram') : pct === 100 ? t('reviewProgram') : t('continueProgram')}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    startIcon={buyLoading === prog.id ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <CartSvg />}
                    disabled={!!buyLoading}
                    onClick={(e) => { e.stopPropagation(); onBuy(prog) }}
                    sx={{
                      background: `linear-gradient(135deg, ${C.purple} 0%, ${C.primary} 100%)`,
                      '&:hover': { background: `linear-gradient(135deg, ${C.primary} 0%, ${C.purple} 100%)` },
                    }}
                  >
                    {t('buyProgramFor')} {formatPrice(prog.price_cents, prog.currency, t)}
                  </Button>
                )}
              </Box>
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
}

// ── Program Detail View ─────────────────────────────────────
function ProgramDetail({ program, modules, lessons, progress, onBack, onLesson, onToggle, t, lang }) {
  const [expanded, setExpanded] = useState({})
  const n  = (o) => lang === 'en' && o.name_en ? o.name_en : o.name_bg
  const d  = (o) => lang === 'en' && o.description_en ? o.description_en : o.description_bg

  const completedSet = useMemo(() => new Set(progress.map(p => p.lesson_id)), [progress])
  const totalLessons = lessons.length
  const completedCount = lessons.filter(l => completedSet.has(l.id)).length
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  // Auto-expand first module with incomplete lessons
  useEffect(() => {
    if (modules.length > 0 && Object.keys(expanded).length === 0) {
      const firstIncomplete = modules.find(m => {
        const mLessons = lessons.filter(l => l.module_id === m.id)
        return mLessons.some(l => !completedSet.has(l.id))
      })
      if (firstIncomplete) setExpanded({ [firstIncomplete.id]: true })
      else if (modules[0]) setExpanded({ [modules[0].id]: true })
    }
  }, [modules, lessons, completedSet])

  return (
    <Box sx={{ animation: 'fadeInUp 0.25s ease both' }}>
      {/* Back button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={onBack}
        sx={{ color: C.muted, mb: 2, '&:hover': { color: C.text } }}
      >
        {t('backToPrograms')}
      </Button>

      {/* Hero banner */}
      <Box sx={{
        width: '100%', pt: '35%', position: 'relative', borderRadius: '20px', overflow: 'hidden', mb: 3,
        background: program.cover_url
          ? `url(${program.cover_url}) center/cover`
          : `linear-gradient(135deg, ${C.primaryContainer} 0%, ${C.purpleSoft} 100%)`,
      }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 3,
        }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '22px', md: '28px' }, color: '#fff', lineHeight: 1.2, mb: 0.5 }}>
            {n(program)}
          </Typography>
          <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', maxWidth: '600px' }}>
            {d(program)}
          </Typography>
        </Box>
      </Box>

      {/* Progress bar */}
      <Paper sx={{ p: 2.5, mb: 2.5, display: 'flex', alignItems: 'center', gap: 2.5 }}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress variant="determinate" value={pct} size={56} thickness={4}
            sx={{ color: C.primary, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{pct}%</Typography>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '15px', color: C.text }}>{t('programProgress')}</Typography>
          <Typography sx={{ fontSize: '13px', color: C.muted }}>
            {completedCount} / {totalLessons} {t('lessonsCount')} {t('completedLessons')}
          </Typography>
        </Box>
        {pct === 100 && (
          <Chip label={t('allLessonsComplete')} sx={{ background: C.primaryContainer, color: C.primary, fontWeight: 700 }} />
        )}
      </Paper>

      {/* Modules accordion */}
      {modules.map((mod, mi) => {
        const modLessons = lessons.filter(l => l.module_id === mod.id)
        const modCompleted = modLessons.filter(l => completedSet.has(l.id)).length
        const isOpen = expanded[mod.id]

        return (
          <Paper key={mod.id} sx={{ mb: 1.5, overflow: 'hidden', p: 0 }}>
            {/* Module header */}
            <Box
              onClick={() => setExpanded(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))}
              sx={{
                px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
                cursor: 'pointer', '&:hover': { background: C.listHover },
              }}
            >
              <Box sx={{
                width: 32, height: 32, borderRadius: '10px',
                background: modCompleted === modLessons.length && modLessons.length > 0 ? C.primaryContainer : C.border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '13px',
                color: modCompleted === modLessons.length && modLessons.length > 0 ? C.primary : C.muted,
              }}>
                {mi + 1}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '15px', color: C.text }}>{n(mod)}</Typography>
                <Typography sx={{ fontSize: '12px', color: C.muted }}>
                  {modCompleted}/{modLessons.length} {t('lessonsCount')}
                </Typography>
              </Box>
              {isOpen ? <ExpandLessIcon sx={{ color: C.muted }} /> : <ExpandMoreIcon sx={{ color: C.muted }} />}
            </Box>

            {/* Lessons list */}
            {isOpen && (
              <Box sx={{ borderTop: `1px solid ${C.border}` }}>
                {modLessons.map((lesson, li) => {
                  const isDone = completedSet.has(lesson.id)
                  return (
                    <Box
                      key={lesson.id}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        px: 2.5, py: 1.5,
                        borderBottom: li < modLessons.length - 1 ? `1px solid ${C.border}` : 'none',
                        cursor: 'pointer',
                        '&:hover': { background: C.listHover },
                        animation: `fadeInUp 0.2s ${EASE.standard} both`,
                        animationDelay: `${li * 0.04}s`,
                      }}
                    >
                      {/* Completion toggle */}
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onToggle(lesson.id) }}
                        sx={{ p: 0.25 }}
                      >
                        {isDone
                          ? <CheckCircleIcon sx={{ fontSize: 22, color: C.primary }} />
                          : <RadioButtonUncheckedIcon sx={{ fontSize: 22, color: C.muted }} />
                        }
                      </IconButton>

                      {/* Lesson info */}
                      <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => onLesson(lesson)}>
                        <Typography sx={{
                          fontWeight: 600, fontSize: '14px', lineHeight: 1.3,
                          color: isDone ? C.muted : C.text,
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}>
                          {n(lesson)}
                        </Typography>
                      </Box>

                      {/* Duration + play */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        {lesson.is_free_preview && (
                          <Chip label={t('freePreview')} size="small"
                            sx={{ height: 20, fontSize: '10px', fontWeight: 700, background: C.purpleSoft, color: C.purple }} />
                        )}
                        {lesson.duration_min > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <AccessTimeIcon sx={{ fontSize: 14, color: C.muted }} />
                            <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>
                              {lesson.duration_min} {t('minutesShort')}
                            </Typography>
                          </Box>
                        )}
                        <IconButton size="small" onClick={() => onLesson(lesson)} sx={{ color: C.primary }}>
                          <PlayCircleIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Paper>
        )
      })}
    </Box>
  )
}

// ── Lesson View ─────────────────────────────────────────────
function LessonView({ lesson, allLessons, progress, onBack, onToggle, onNavigate, t, lang }) {
  const n = (o) => lang === 'en' && o.name_en ? o.name_en : o.name_bg
  const d = (o) => lang === 'en' && o.description_en ? o.description_en : o.description_bg
  const isDone = progress.some(p => p.lesson_id === lesson.id)

  // Find prev/next in the full flat lesson list
  const idx  = allLessons.findIndex(l => l.id === lesson.id)
  const prev = idx > 0 ? allLessons[idx - 1] : null
  const next = idx < allLessons.length - 1 ? allLessons[idx + 1] : null

  return (
    <Box sx={{ animation: 'fadeInUp 0.25s ease both', maxWidth: '900px', mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack}
        sx={{ color: C.muted, mb: 2, '&:hover': { color: C.text } }}>
        {t('backToProgram')}
      </Button>

      {/* Video player */}
      {lesson.video_url && <VideoEmbed url={lesson.video_url} />}

      {/* Lesson info */}
      <Box sx={{ mt: 2.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '20px', md: '24px' }, color: C.text, mb: 1, lineHeight: 1.3 }}>
          {n(lesson)}
        </Typography>

        {lesson.duration_min > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <AccessTimeIcon sx={{ fontSize: 16, color: C.muted }} />
            <Typography sx={{ fontSize: '13px', color: C.muted, fontWeight: 600 }}>
              {lesson.duration_min} {t('minutesShort')}
            </Typography>
          </Box>
        )}

        {d(lesson) && (
          <Typography sx={{ fontSize: '14px', color: C.muted, lineHeight: 1.7, mb: 2.5 }}>
            {d(lesson)}
          </Typography>
        )}

        {/* Mark complete button */}
        <Button
          variant={isDone ? 'outlined' : 'contained'}
          startIcon={isDone ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
          onClick={() => onToggle(lesson.id)}
          sx={{ mb: 2.5 }}
        >
          {isDone ? t('markIncomplete') : t('markComplete')}
        </Button>

        {/* Prev / Next navigation */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {prev && (
            <Button
              variant="outlined" size="small"
              startIcon={<SkipPreviousIcon />}
              onClick={() => onNavigate(prev)}
              sx={{ flex: 1 }}
            >
              {n(prev)}
            </Button>
          )}
          {next && (
            <Button
              variant="outlined" size="small"
              endIcon={<SkipNextIcon />}
              onClick={() => onNavigate(next)}
              sx={{ flex: 1 }}
            >
              {n(next)}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ── Resources List View ──────────────────────────────────────
function ResourcesList({ resources, hasAccess, onWatch, t, lang }) {
  const n = (r) => lang === 'en' && r.name_en ? r.name_en : r.name_bg
  const d = (r) => lang === 'en' && r.description_en ? r.description_en : r.description_bg
  const cat = (r) => lang === 'en' && r.category_en ? r.category_en : r.category_bg

  // Group by category
  const categories = useMemo(() => {
    const map = {}
    resources.forEach(r => {
      const c = cat(r) || ''
      if (!map[c]) map[c] = []
      map[c].push(r)
    })
    return Object.entries(map)
  }, [resources, lang])

  return (
    <Box>
      <Typography variant="overline" sx={{ color: C.primary, display: 'block', mb: 0.5 }}>
        {t('resourcesOverline')}
      </Typography>
      <Typography variant="h2" sx={{ color: C.text, mb: 3 }}>
        {t('resourcesTitle')}
      </Typography>

      {!hasAccess && (
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center', background: 'rgba(200,197,255,0.06)', border: `1px solid rgba(200,197,255,0.15)` }}>
          <LockSvg />
          <Typography sx={{ fontSize: '14px', color: C.muted, mt: 1 }}>{t('resourcesLocked')}</Typography>
        </Paper>
      )}

      {resources.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: C.muted, fontSize: '15px' }}>{t('noResources')}</Typography>
        </Paper>
      )}

      {categories.map(([category, items]) => (
        <Box key={category} sx={{ mb: 3 }}>
          {category && (
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.primary, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}>
              {category}
            </Typography>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            {items.map((res, i) => (
              <Paper
                key={res.id}
                onClick={() => hasAccess && onWatch(res)}
                sx={{
                  cursor: hasAccess ? 'pointer' : 'default',
                  overflow: 'hidden', p: 0,
                  opacity: hasAccess ? 1 : 0.5,
                  animation: `fadeInUp 0.3s ${EASE.standard} both`,
                  animationDelay: `${i * 0.06}s`,
                  '&:hover': hasAccess ? { transform: 'translateY(-2px)' } : {},
                }}
              >
                {/* Thumbnail */}
                <Box sx={{
                  width: '100%', pt: '56.25%', position: 'relative',
                  background: res.thumbnail_url
                    ? `url(${res.thumbnail_url}) center/cover`
                    : `linear-gradient(135deg, ${C.primaryContainer} 0%, ${C.purpleSoft} 100%)`,
                }}>
                  {hasAccess && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayCircleIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.85)' }} />
                    </Box>
                  )}
                  {!hasAccess && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
                      <LockSvg />
                    </Box>
                  )}
                  {res.duration_min > 0 && (
                    <Box sx={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: '6px', px: 1, py: 0.25, fontSize: '11px', fontWeight: 700 }}>
                      {res.duration_min} {t('minutesShort')}
                    </Box>
                  )}
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '15px', color: C.text, lineHeight: 1.3 }}>
                    {n(res)}
                  </Typography>
                  {d(res) && (
                    <Typography sx={{ fontSize: '12px', color: C.muted, mt: 0.5, lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {d(res)}
                    </Typography>
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// ── Resource Video View ─────────────────────────────────────
function ResourceView({ resource, onBack, t, lang }) {
  const n = (o) => lang === 'en' && o.name_en ? o.name_en : o.name_bg
  const d = (o) => lang === 'en' && o.description_en ? o.description_en : o.description_bg

  return (
    <Box sx={{ animation: 'fadeInUp 0.25s ease both', maxWidth: '900px', mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack}
        sx={{ color: C.muted, mb: 2, '&:hover': { color: C.text } }}>
        {t('tabResources')}
      </Button>
      {resource.video_url && <VideoEmbed url={resource.video_url} />}
      <Box sx={{ mt: 2.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '20px', md: '24px' }, color: C.text, mb: 1, lineHeight: 1.3 }}>
          {n(resource)}
        </Typography>
        {resource.duration_min > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
            <AccessTimeIcon sx={{ fontSize: 16, color: C.muted }} />
            <Typography sx={{ fontSize: '13px', color: C.muted, fontWeight: 600 }}>
              {resource.duration_min} {t('minutesShort')}
            </Typography>
          </Box>
        )}
        {d(resource) && (
          <Typography sx={{ fontSize: '14px', color: C.muted, lineHeight: 1.7 }}>
            {d(resource)}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PROGRAMS PAGE
// ══════════════════════════════════════════════════════════════
export default function Programs() {
  const { auth, t, lang, showSnackbar } = useApp()

  const [tab, setTab] = useState('programs') // 'programs' | 'resources'
  const [programs, setPrograms]   = useState([])
  const [modules, setModules]     = useState([])
  const [lessons, setLessons]     = useState([])
  const [progress, setProgress]   = useState([])
  const [purchases, setPurchases] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading]     = useState(true)
  const [buyLoading, setBuyLoading] = useState(null)

  // Navigation state
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedLesson, setSelectedLesson]   = useState(null)
  const [selectedResource, setSelectedResource] = useState(null)

  // Check for purchase success URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('purchase') === 'success') {
      showSnackbar(t('purchaseSuccess'))
      const url = new URL(window.location.href)
      url.searchParams.delete('purchase')
      url.searchParams.delete('program_id')
      window.history.replaceState({}, '', url.pathname + url.hash)
    }
  }, [])

  // Resources access: studio clients OR clients who purchased any program
  const hasResourceAccess = auth.role === 'coach'
    || hasModule(auth.modules, 'studio_access')
    || hasModule(auth.modules, 'program_access')
    || purchases.length > 0

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [progs, res] = await Promise.all([
        DB.getPrograms('active'),
        DB.getResources('active'),
      ])
      setPrograms(progs)
      setResources(res)

      const allModules = []
      const allLessons = []
      await Promise.all(progs.map(async (p) => {
        const [mods, lsns] = await Promise.all([
          DB.getProgramModules(p.id),
          DB.getProgramLessons(p.id),
        ])
        allModules.push(...mods)
        allLessons.push(...lsns)
      }))
      setModules(allModules)
      setLessons(allLessons)

      if (auth.id) {
        const [prog, purch] = await Promise.all([
          DB.getClientProgress(auth.id),
          DB.getClientPurchases(auth.id),
        ])
        setProgress(prog)
        setPurchases(purch)
      }
    } catch (err) {
      console.error('Programs load error:', err)
    } finally {
      setLoading(false)
    }
  }, [auth.id])

  useEffect(() => { loadData() }, [loadData])

  const toggleLesson = useCallback(async (lessonId) => {
    const isDone = progress.some(p => p.lesson_id === lessonId)
    if (isDone) {
      await DB.unmarkLessonComplete(auth.id, lessonId)
      setProgress(prev => prev.filter(p => p.lesson_id !== lessonId))
    } else {
      await DB.markLessonComplete(auth.id, lessonId)
      setProgress(prev => [...prev, { client_id: auth.id, lesson_id: lessonId, completed_at: new Date().toISOString() }])
    }
  }, [auth.id, progress])

  const handleBuy = useCallback(async (prog) => {
    if (!prog.stripe_price_id) { showSnackbar(t('purchaseError')); return }
    setBuyLoading(prog.id)
    try {
      const baseUrl = window.location.origin + window.location.pathname
      const result = await DB.createCheckoutSession(
        prog.id, auth.id, prog.stripe_price_id,
        `${baseUrl}?purchase=success&program_id=${prog.id}#/programs`,
        `${baseUrl}#/programs`, lang,
      )
      if (result?.url) window.location.href = result.url
      else showSnackbar(t('purchaseError'))
    } catch { showSnackbar(t('purchaseError')) }
    finally { setBuyLoading(null) }
  }, [auth.id, lang, showSnackbar, t])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <CircularProgress sx={{ color: C.primary }} size={36} />
      </Box>
    )
  }

  // Lesson View (inside programs tab)
  if (selectedLesson && selectedProgram) {
    const progLessons = lessons
      .filter(l => l.program_id === selectedProgram.id)
      .sort((a, b) => {
        const modA = modules.find(m => m.id === a.module_id)
        const modB = modules.find(m => m.id === b.module_id)
        return ((modA?.display_order || 0) * 10000 + (a.display_order || 0)) - ((modB?.display_order || 0) * 10000 + (b.display_order || 0))
      })
    return <LessonView lesson={selectedLesson} allLessons={progLessons} progress={progress}
      onBack={() => setSelectedLesson(null)} onToggle={toggleLesson}
      onNavigate={(l) => { setSelectedLesson(l); window.scrollTo({ top: 0, behavior: 'smooth' }) }} t={t} lang={lang} />
  }

  // Program Detail View
  if (selectedProgram) {
    return <ProgramDetail program={selectedProgram}
      modules={modules.filter(m => m.program_id === selectedProgram.id)}
      lessons={lessons.filter(l => l.program_id === selectedProgram.id)}
      progress={progress} onBack={() => setSelectedProgram(null)}
      onLesson={(l) => { setSelectedLesson(l); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
      onToggle={toggleLesson} t={t} lang={lang} />
  }

  // Resource Video View
  if (selectedResource) {
    return <ResourceView resource={selectedResource}
      onBack={() => setSelectedResource(null)} t={t} lang={lang} />
  }

  // ── Main view with sub-tabs ────────────────────────────────
  return (
    <Box>
      {/* Sub-tab bar */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
        {['programs', 'resources'].map(key => (
          <Box key={key} onClick={() => setTab(key)} sx={{
            px: 2, py: 1, borderRadius: '12px', cursor: 'pointer',
            fontSize: '14px', fontWeight: tab === key ? 800 : 600,
            background: tab === key ? C.primaryContainer : 'transparent',
            color: tab === key ? C.primary : C.muted,
            border: `1px solid ${tab === key ? C.primaryA20 : C.border}`,
            transition: 'all 0.15s',
          }}>
            {key === 'programs' ? t('tabMyPrograms') : t('tabResources')}
          </Box>
        ))}
      </Box>

      {/* Tab content */}
      {tab === 'programs' && (
        <ProgramsList programs={programs} progress={progress} lessons={lessons} purchases={purchases}
          onSelect={(p) => { setSelectedProgram(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          onBuy={handleBuy} buyLoading={buyLoading} t={t} lang={lang} auth={auth} />
      )}
      {tab === 'resources' && (
        <ResourcesList resources={resources} hasAccess={hasResourceAccess}
          onWatch={(r) => { setSelectedResource(r); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          t={t} lang={lang} />
      )}
    </Box>
  )
}
