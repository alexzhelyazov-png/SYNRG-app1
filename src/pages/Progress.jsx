import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, Typography, Dialog, IconButton } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import {
  BADGES, BADGE_CATEGORIES,
  evaluateBadges, computeTotalXP, computeLevel, getLevelName,
  getNextBadges, getBadgeProgress,
} from '../lib/gamification'

/* ═══════════════════════════════════════════════════════════════
   Accent color helpers — maps category accent to C tokens
   ═══════════════════════════════════════════════════════════════ */
const accentColor = (accent) =>
  accent === 'purple' ? C.purple : accent === 'orange' ? C.orange : C.primary

const accentSoft = (accent) =>
  accent === 'purple' ? C.purpleSoft : accent === 'orange' ? 'rgba(255,184,122,0.12)' : C.primaryContainer

const accentBorder = (accent) =>
  accent === 'purple' ? C.purpleA20 : accent === 'orange' ? 'rgba(255,184,122,0.20)' : C.primaryA20

/* ═══════════════════════════════════════════════════════════════
   Main Progress page — Gamification
   ═══════════════════════════════════════════════════════════════ */
export default function Progress() {
  const { client, t, lang, dismissBadge } = useApp()
  const isMobile = window.innerWidth < 640
  const [selectedBadge, setSelectedBadge] = useState(null)

  // ── Compute gamification data ────────────────────────────────
  const earnedIds = useMemo(() => evaluateBadges(client), [client.meals, client.weightLogs, client.workouts])
  const earnedSet = useMemo(() => new Set(earnedIds), [earnedIds])
  const totalXP   = useMemo(() => computeTotalXP(earnedIds), [earnedIds])
  const levelData = useMemo(() => computeLevel(totalXP), [totalXP])
  const levelName = getLevelName(levelData.level, lang)
  const nextBadges = useMemo(() => getNextBadges(client, earnedIds, 3), [client, earnedIds])

  // ── Badge unlock notification ────────────────────────────────
  const [unlockedBadge, setUnlockedBadge] = useState(null)
  const prevEarnedRef = useRef(null)

  useEffect(() => {
    const dismissed = new Set(client.dismissedBadges || [])
    const undismissed = earnedIds.filter(id => !dismissed.has(id))
    if (undismissed.length > 0 && prevEarnedRef.current !== null) {
      // show the first undismissed badge
      const badge = BADGES.find(b => b.id === undismissed[0])
      if (badge) setUnlockedBadge(badge)
    }
    prevEarnedRef.current = earnedIds
  }, [earnedIds, client.dismissedBadges])

  const handleDismissUnlock = () => {
    if (unlockedBadge) {
      dismissBadge(unlockedBadge.id)
      setUnlockedBadge(null)
    }
  }

  // auto-dismiss after 4s
  useEffect(() => {
    if (!unlockedBadge) return
    const timer = setTimeout(handleDismissUnlock, 4000)
    return () => clearTimeout(timer)
  }, [unlockedBadge])

  return (
    <>
      {/* ── Header ───────────────────────────────────────────── */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h2" sx={{ fontStyle: 'italic' }}>
          {t('gamificationTitle')}
        </Typography>
        <Typography variant="body2" sx={{ color: C.muted, mt: 0.5, fontWeight: 600 }}>
          {client.name}
        </Typography>
      </Box>

      {/* ── Level Card ───────────────────────────────────────── */}
      <LevelCard levelData={levelData} levelName={levelName} t={t} earnedCount={earnedIds.length} />

      {/* ── Next Badges ──────────────────────────────────────── */}
      {nextBadges.length > 0 && (
        <NextBadgesSection items={nextBadges} t={t} lang={lang} />
      )}

      {/* ── All Badges by Category ───────────────────────────── */}
      <Typography variant="h3" sx={{ mb: 2, fontStyle: 'italic' }}>
        {t('allBadgesTitle')}
      </Typography>

      {BADGE_CATEGORIES.map(cat => {
        const catBadges = BADGES.filter(b => b.category === cat.key)
        return (
          <Box key={cat.key} sx={{ mb: 3 }}>
            <Typography sx={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.9px', color: C.muted, mb: 1.5,
            }}>
              {lang === 'bg' ? cat.labelBg : cat.labelEn}
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: 1.25,
            }}>
              {catBadges.map((badge, i) => (
                <BadgeTile
                  key={badge.id}
                  badge={badge}
                  isEarned={earnedSet.has(badge.id)}
                  accent={cat.accent}
                  index={i}
                  lang={lang}
                  t={t}
                  onClick={() => setSelectedBadge(badge)}
                />
              ))}
            </Box>
          </Box>
        )
      })}

      {/* ── Badge Detail Dialog ──────────────────────────────── */}
      <BadgeDetailDialog
        open={!!selectedBadge}
        badge={selectedBadge}
        isEarned={selectedBadge ? earnedSet.has(selectedBadge.id) : false}
        client={client}
        lang={lang}
        t={t}
        onClose={() => setSelectedBadge(null)}
      />

      {/* ── Badge Unlock Toast ───────────────────────────────── */}
      {unlockedBadge && (
        <BadgeUnlockedToast badge={unlockedBadge} lang={lang} t={t} onDismiss={handleDismissUnlock} />
      )}
    </>
  )
}


/* ═══════════════════════════════════════════════════════════════
   LevelCard — hero section
   ═══════════════════════════════════════════════════════════════ */
function LevelCard({ levelData, levelName, t, earnedCount }) {
  return (
    <Box sx={{
      background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
      border: `1px solid ${C.border}`,
      borderRadius: '20px',
      p: '24px',
      mb: 3,
      animation: `fadeInUp 0.3s ${EASE.decelerate} both`,
    }}>
      <Typography sx={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.9px', color: C.muted, mb: 0.75,
      }}>
        {t('levelLbl')}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 }}>
        <Typography sx={{
          fontSize: '48px', fontWeight: 900, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif",
          color: C.primary, lineHeight: 1,
          letterSpacing: '-1px',
        }}>
          {levelData.level}
        </Typography>
        <Typography sx={{
          fontSize: '18px', fontWeight: 700, color: C.text,
          fontStyle: 'italic',
        }}>
          {levelName}
        </Typography>
      </Box>

      {/* XP progress bar */}
      <Box sx={{
        height: '8px', borderRadius: '4px',
        background: C.border, overflow: 'hidden', mb: 1,
      }}>
        <Box sx={{
          height: '100%', borderRadius: '4px',
          background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDeep})`,
          width: `${levelData.progress * 100}%`,
          transition: `width 0.6s ${EASE.spring}`,
        }} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>
          {levelData.xpIntoLevel} / {levelData.xpForLevel} {t('xpLbl')}
        </Typography>
        <Typography sx={{ fontSize: '12px', color: C.primary, fontWeight: 700 }}>
          {levelData.totalXP} {t('xpLbl')} {' '} {earnedCount}/{BADGES.length}
        </Typography>
      </Box>
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   NextBadgesSection — 2-3 closest-to-unlock badges
   ═══════════════════════════════════════════════════════════════ */
function NextBadgesSection({ items, t, lang }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h3" sx={{ mb: 1.5, fontStyle: 'italic' }}>
        {t('nextBadgesTitle')}
      </Typography>
      {items.map(({ badge, current, target, progress }, i) => {
        const cat = BADGE_CATEGORIES.find(c => c.key === badge.category)
        const color = accentColor(cat?.accent || 'primary')
        return (
          <Box key={badge.id} sx={{
            display: 'flex', alignItems: 'center', gap: 2,
            p: '14px 16px', mb: 1,
            background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
            border: `1px solid ${C.border}`,
            borderRadius: '14px',
            animation: `fadeIn 0.2s ${EASE.standard} both`,
            animationDelay: `${i * 0.06}s`,
            transition: `border-color 0.2s ${EASE.standard}`,
            '&:hover': { borderColor: C.borderHover },
          }}>
            {/* icon circle */}
            <Box sx={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.border,
              border: `2px solid transparent`,
            }}>
              <Typography sx={{
                fontSize: '13px', fontWeight: 900, color: C.muted,
                fontFamily: "'MontBlanc', sans-serif",
              }}>
                {badge.icon}
              </Typography>
            </Box>

            {/* info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                {t(`badge_${badge.id}`)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Box sx={{ flex: 1, height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', borderRadius: 2,
                    background: color,
                    width: `${progress * 100}%`,
                    transition: `width 0.4s ${EASE.standard}`,
                  }} />
                </Box>
                <Typography sx={{
                  fontSize: '11px', color: C.muted, fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {current}/{target}
                </Typography>
              </Box>
            </Box>

            {/* xp */}
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color, whiteSpace: 'nowrap' }}>
              +{badge.xp} {' '} XP
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeTile — single badge in the grid
   ═══════════════════════════════════════════════════════════════ */
function BadgeTile({ badge, isEarned, accent, index, lang, t, onClick }) {
  const color = accentColor(accent)
  const soft  = accentSoft(accent)
  const brd   = accentBorder(accent)

  return (
    <Box onClick={onClick} sx={{
      p: '14px',
      borderRadius: '16px',
      border: `1px solid ${isEarned ? brd : C.border}`,
      background: isEarned
        ? `linear-gradient(145deg, ${soft} 0%, transparent 100%)`
        : 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
      opacity: isEarned ? 1 : 0.5,
      cursor: 'pointer',
      textAlign: 'center',
      animation: `fadeIn 0.2s ${EASE.standard} both`,
      animationDelay: `${index * 0.04}s`,
      transition: `all 0.2s ${EASE.standard}`,
      '&:hover': {
        transform: 'translateY(-2px)',
        opacity: isEarned ? 1 : 0.7,
        boxShadow: isEarned
          ? `0 4px 16px ${C.shadow}`
          : `0 2px 8px ${C.shadowSm}`,
        borderColor: isEarned ? brd : C.borderHover,
      },
    }}>
      {/* icon circle */}
      <Box sx={{
        width: 44, height: 44, borderRadius: '50%', mx: 'auto', mb: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isEarned ? soft : C.border,
        border: `2px solid ${isEarned ? brd : 'transparent'}`,
        transition: `all 0.2s ${EASE.standard}`,
      }}>
        <Typography sx={{
          fontSize: badge.icon.length > 2 ? '11px' : '15px',
          fontWeight: 900,
          color: isEarned ? color : C.muted,
          fontFamily: "'MontBlanc', sans-serif",
          letterSpacing: '-0.3px',
        }}>
          {badge.icon}
        </Typography>
      </Box>

      <Typography sx={{
        fontSize: '12px', fontWeight: 700,
        color: isEarned ? C.text : C.muted,
        mb: 0.25, lineHeight: 1.3,
      }}>
        {t(`badge_${badge.id}`)}
      </Typography>

      <Typography sx={{
        fontSize: '11px', fontWeight: 600,
        color: isEarned ? color : C.muted,
      }}>
        +{badge.xp} XP
      </Typography>
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeDetailDialog — modal on badge tap
   ═══════════════════════════════════════════════════════════════ */
function BadgeDetailDialog({ open, badge, isEarned, client, lang, t, onClose }) {
  if (!badge) return null
  const cat = BADGE_CATEGORIES.find(c => c.key === badge.category)
  const color = accentColor(cat?.accent || 'primary')
  const soft  = accentSoft(cat?.accent || 'primary')
  const brd   = accentBorder(cat?.accent || 'primary')
  const { current, target } = getBadgeProgress(badge, client)
  const progress = target > 0 ? current / target : 0

  return (
    <Dialog open={open} onClose={onClose}
      PaperProps={{ sx: {
        background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
        border: `1px solid ${C.border}`,
        borderRadius: '20px',
        p: 3.5,
        maxWidth: 340,
        width: '90vw',
        textAlign: 'center',
        animation: `scaleIn 0.2s ${EASE.decelerate} both`,
      }}}>
      {/* close button */}
      <IconButton onClick={onClose} sx={{
        position: 'absolute', top: 8, right: 8,
        color: C.muted, fontSize: '18px',
      }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>x</span>
      </IconButton>

      {/* large icon */}
      <Box sx={{
        width: 72, height: 72, borderRadius: '50%', mx: 'auto', mb: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isEarned ? soft : C.border,
        border: `3px solid ${isEarned ? brd : 'transparent'}`,
      }}>
        <Typography sx={{
          fontSize: badge.icon.length > 2 ? '18px' : '28px',
          fontWeight: 900,
          color: isEarned ? color : C.muted,
          fontFamily: "'MontBlanc', sans-serif",
        }}>
          {badge.icon}
        </Typography>
      </Box>

      {/* badge name */}
      <Typography sx={{
        fontSize: '18px', fontWeight: 800, fontStyle: 'italic',
        color: isEarned ? C.text : C.muted, mb: 0.75,
        fontFamily: "'MontBlanc', sans-serif",
      }}>
        {t(`badge_${badge.id}`)}
      </Typography>

      {/* description */}
      <Typography sx={{
        fontSize: '13px', fontWeight: 600, color: C.muted, mb: 2, lineHeight: 1.5,
      }}>
        {t(`badgeDesc_${badge.id}`)}
      </Typography>

      {/* XP */}
      <Typography sx={{
        fontSize: '14px', fontWeight: 700,
        color: isEarned ? color : C.muted, mb: 2,
      }}>
        +{badge.xp} XP
      </Typography>

      {/* progress indicator */}
      {!isEarned && (
        <Box sx={{ mb: 1 }}>
          <Box sx={{
            height: 6, borderRadius: 3,
            background: C.border, overflow: 'hidden', mb: 0.75,
          }}>
            <Box sx={{
              height: '100%', borderRadius: 3,
              background: color,
              width: `${progress * 100}%`,
              transition: `width 0.4s ${EASE.standard}`,
            }} />
          </Box>
          <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>
            {current} / {target}
          </Typography>
        </Box>
      )}

      {isEarned && (
        <Typography sx={{
          fontSize: '12px', fontWeight: 700,
          color, textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {t('earnedLbl')}
        </Typography>
      )}
    </Dialog>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeUnlockedToast — elegant bottom notification
   ═══════════════════════════════════════════════════════════════ */
function BadgeUnlockedToast({ badge, lang, t, onDismiss }) {
  const cat = BADGE_CATEGORIES.find(c => c.key === badge.category)
  const color = accentColor(cat?.accent || 'primary')
  const soft  = accentSoft(cat?.accent || 'primary')
  const brd   = accentBorder(cat?.accent || 'primary')

  return (
    <Box onClick={onDismiss} sx={{
      position: 'fixed',
      bottom: 96, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1400,
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 2.5, py: 1.5,
      background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
      border: `1px solid ${brd}`,
      borderRadius: '16px',
      boxShadow: `0 8px 32px ${C.shadow}`,
      cursor: 'pointer',
      animation: `scaleIn 0.3s ${EASE.spring} both`,
      maxWidth: '90vw',
    }}>
      {/* icon */}
      <Box sx={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: soft, border: `2px solid ${brd}`,
      }}>
        <Typography sx={{
          fontSize: badge.icon.length > 2 ? '10px' : '14px',
          fontWeight: 900, color,
          fontFamily: "'MontBlanc', sans-serif",
        }}>
          {badge.icon}
        </Typography>
      </Box>

      {/* text */}
      <Box>
        <Typography sx={{
          fontSize: '11px', fontWeight: 700, color: C.muted,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {t('badgeUnlockedMsg')}
        </Typography>
        <Typography sx={{ fontSize: '14px', fontWeight: 800, color: C.text }}>
          {t(`badge_${badge.id}`)}
        </Typography>
      </Box>

      {/* xp */}
      <Typography sx={{
        fontSize: '14px', fontWeight: 800, color,
        ml: 1, whiteSpace: 'nowrap',
      }}>
        +{badge.xp} XP
      </Typography>
    </Box>
  )
}
