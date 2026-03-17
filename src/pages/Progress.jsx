import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, Typography, Dialog, IconButton } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import {
  BADGES, BADGE_CATEGORIES, TIER_COLORS, TIER_ORDER,
  evaluateBadges, computeTotalXP, computeLevel, getLevelName,
  getNextBadges, getBadgeProgress, getMonthlyStepHistory,
} from '../lib/gamification'

// ── MUI Icon imports ────────────────────────────────────────
import MonitorWeightIcon        from '@mui/icons-material/MonitorWeight'
import RestaurantIcon           from '@mui/icons-material/Restaurant'
import DirectionsWalkIcon       from '@mui/icons-material/DirectionsWalk'
import FitnessCenterIcon        from '@mui/icons-material/FitnessCenter'
import DirectionsRunIcon        from '@mui/icons-material/DirectionsRun'
import TrendingDownIcon         from '@mui/icons-material/TrendingDown'
import LocalFireDepartmentIcon  from '@mui/icons-material/LocalFireDepartment'
import EventAvailableIcon       from '@mui/icons-material/EventAvailable'
import LocalDiningIcon          from '@mui/icons-material/LocalDining'
import EggIcon                  from '@mui/icons-material/Egg'
import EmojiEventsIcon          from '@mui/icons-material/EmojiEvents'
import AutoAwesomeIcon          from '@mui/icons-material/AutoAwesome'
import MilitaryTechIcon         from '@mui/icons-material/MilitaryTech'
import LockIcon                 from '@mui/icons-material/Lock'
import ArrowUpwardIcon          from '@mui/icons-material/ArrowUpward'

const ICON_MAP = {
  MonitorWeight:        MonitorWeightIcon,
  Restaurant:           RestaurantIcon,
  DirectionsWalk:       DirectionsWalkIcon,
  FitnessCenter:        FitnessCenterIcon,
  DirectionsRun:        DirectionsRunIcon,
  TrendingDown:         TrendingDownIcon,
  LocalFireDepartment:  LocalFireDepartmentIcon,
  EventAvailable:       EventAvailableIcon,
  LocalDining:          LocalDiningIcon,
  Egg:                  EggIcon,
  EmojiEvents:          EmojiEventsIcon,
  AutoAwesome:          AutoAwesomeIcon,
  MilitaryTech:         MilitaryTechIcon,
}

/* ═══════════════════════════════════════════════════════════════
   Tier color helpers — metallic Bronze / Silver / Gold
   ═══════════════════════════════════════════════════════════════ */
const tierColor  = (tier) => tier ? TIER_COLORS[tier] : C.primary
const tierBg     = (tier) => tier ? `${TIER_COLORS[tier]}18` : 'var(--c-primaryContainer)'
const tierBorder = (tier) => tier ? `${TIER_COLORS[tier]}40` : 'var(--c-primaryA20)'

function BadgeIcon({ muiIcon, size = 24, color: clr = C.muted }) {
  const Comp = ICON_MAP[muiIcon]
  if (!Comp) return null
  return <Comp sx={{ fontSize: size, color: clr }} />
}

/* ═══════════════════════════════════════════════════════════════
   Main Progress page — Gamification v2
   ═══════════════════════════════════════════════════════════════ */
export default function Progress() {
  const { client, t, lang, dismissBadge } = useApp()
  const isMobile = window.innerWidth < 640
  const [selectedBadge, setSelectedBadge] = useState(null)

  // ── Compute gamification data ────────────────────────────────
  const earnedIds  = useMemo(() => evaluateBadges(client), [client.meals, client.weightLogs, client.workouts, client.stepsLogs])
  const earnedSet  = useMemo(() => new Set(earnedIds), [earnedIds])
  const totalXP    = useMemo(() => computeTotalXP(earnedIds, client), [earnedIds, client])
  const levelData  = useMemo(() => computeLevel(totalXP), [totalXP])
  const levelName  = getLevelName(levelData.level, lang)
  const nextBadges = useMemo(() => getNextBadges(client, earnedIds, 3), [client, earnedIds])

  // ── Badge series for grid ──────────────────────────────────
  const seriesKeys = useMemo(() => {
    const seen = []
    for (const b of BADGES) {
      if (b.series && !seen.includes(b.series)) seen.push(b.series)
    }
    return seen
  }, [])

  const standaloneBadges  = useMemo(() => BADGES.filter(b => b.series === null), [])

  // ── Badge unlock notification ────────────────────────────────
  const [unlockedBadge, setUnlockedBadge] = useState(null)
  const prevEarnedRef = useRef(null)

  useEffect(() => {
    const dismissed = new Set(client.dismissedBadges || [])
    const undismissed = earnedIds.filter(id => !dismissed.has(id))
    if (undismissed.length > 0 && prevEarnedRef.current !== null) {
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

  useEffect(() => {
    if (!unlockedBadge) return
    const timer = setTimeout(handleDismissUnlock, 4000)
    return () => clearTimeout(timer)
  }, [unlockedBadge])

  // ── Level-up celebration ───────────────────────────────────────
  const [levelUpInfo, setLevelUpInfo] = useState(null)
  const prevLevelRef = useRef(null)

  useEffect(() => {
    const curLevel = levelData.level
    if (prevLevelRef.current !== null && curLevel > prevLevelRef.current) {
      setLevelUpInfo({ level: curLevel, name: getLevelName(curLevel, lang) })
    }
    prevLevelRef.current = curLevel
  }, [levelData.level, lang])

  useEffect(() => {
    if (!levelUpInfo) return
    const timer = setTimeout(() => setLevelUpInfo(null), 4500)
    return () => clearTimeout(timer)
  }, [levelUpInfo])

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
      <LevelCard levelData={levelData} levelName={levelName} t={t} lang={lang} earnedCount={earnedIds.length} />

      {/* ── Next Badges ──────────────────────────────────────── */}
      {nextBadges.length > 0 && (
        <NextBadgesSection items={nextBadges} t={t} lang={lang} onBadgeClick={setSelectedBadge} />
      )}

      {/* ── All Badges ───────────────────────────────────────── */}
      <Typography variant="h3" sx={{ mb: 2, fontStyle: 'italic' }}>
        {t('allBadgesTitle')}
      </Typography>

      {/* Tiered badge series */}
      {seriesKeys.filter(s => s !== 'monthly_steps').map(seriesKey => {
        const seriesBadges = BADGES.filter(b => b.series === seriesKey)
        return (
          <Box key={seriesKey} sx={{ mb: 2.5 }}>
            <Typography sx={{
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.9px', color: C.muted, mb: 1,
            }}>
              {t(`series_${seriesKey}`)}
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1.25,
            }}>
              {seriesBadges.map((badge, i) => (
                <BadgeTile key={badge.id} badge={badge} isEarned={earnedSet.has(badge.id)}
                  index={i} t={t} onClick={() => setSelectedBadge(badge)} />
              ))}
            </Box>
          </Box>
        )
      })}

      {/* Monthly steps section */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{
          fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.9px', color: C.muted, mb: 1,
        }}>
          {t('series_monthly_steps')}
        </Typography>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1.25,
        }}>
          {BADGES.filter(b => b.series === 'monthly_steps').map((badge, i) => (
            <BadgeTile key={badge.id} badge={badge} isEarned={earnedSet.has(badge.id)}
              index={i} t={t} onClick={() => setSelectedBadge(badge)} />
          ))}
        </Box>
        {/* Monthly step history count */}
        {(() => {
          const history = getMonthlyStepHistory(client)
          if (history.length === 0) return null
          return (
            <Typography sx={{
              fontSize: '11px', fontWeight: 600, color: C.muted,
              mt: 1, textAlign: 'center',
            }}>
              {lang === 'bg' ? `${history.length} месец${history.length === 1 ? '' : 'а'} с постижение` : `${history.length} month${history.length === 1 ? '' : 's'} achieved`}
            </Typography>
          )
        })()}
      </Box>

      {/* Special standalone badges */}
      {standaloneBadges.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{
            fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.9px', color: C.muted, mb: 1.5,
          }}>
            {t('badgeCat_special')}
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: 1.25,
          }}>
            {standaloneBadges.map((badge, i) => (
              <BadgeTile key={badge.id} badge={badge} isEarned={earnedSet.has(badge.id)}
                index={i} t={t} onClick={() => setSelectedBadge(badge)} />
            ))}
          </Box>
        </Box>
      )}

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
        <BadgeUnlockedToast badge={unlockedBadge} t={t} onDismiss={handleDismissUnlock} />
      )}

      {/* ── Level Up Celebration ───────────────────────────────── */}
      {levelUpInfo && (
        <LevelUpCelebration info={levelUpInfo} t={t} onDismiss={() => setLevelUpInfo(null)} />
      )}
    </>
  )
}


/* ═══════════════════════════════════════════════════════════════
   LevelCard — hero section
   ═══════════════════════════════════════════════════════════════ */
function LevelCard({ levelData, levelName, t, lang, earnedCount }) {
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
        {t('levelLbl')} {levelData.level}/20
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
          {levelData.xpForLevel - levelData.xpIntoLevel} {t('xpLbl')} {lang === 'bg' ? 'до следващо ниво' : 'to next level'}
        </Typography>
        <Typography sx={{ fontSize: '12px', color: C.primary, fontWeight: 700 }}>
          {levelData.totalXP} {t('xpLbl')}
        </Typography>
      </Box>
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   NextBadgesSection — 2-3 closest-to-unlock badges
   ═══════════════════════════════════════════════════════════════ */
function NextBadgesSection({ items, t, onBadgeClick }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h3" sx={{ mb: 1.5, fontStyle: 'italic' }}>
        {t('nextBadgesTitle')}
      </Typography>
      {items.map(({ badge, current, target, progress }, i) => {
        const color = tierColor(badge.tier)
        const dimColor = badge.tier ? `${TIER_COLORS[badge.tier]}55` : `${C.primary}55`
        const dimBg    = badge.tier ? `${TIER_COLORS[badge.tier]}0D` : 'var(--c-primaryContainer)'
        const dimBrd   = badge.tier ? `${TIER_COLORS[badge.tier]}22` : `${C.primary}18`
        return (
          <Box key={badge.id} onClick={() => onBadgeClick(badge)} sx={{
            display: 'flex', alignItems: 'center', gap: 2,
            p: '14px 16px', mb: 1,
            background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
            border: `1px solid ${dimBrd}`,
            borderRadius: '14px',
            cursor: 'pointer',
            animation: `fadeIn 0.2s ${EASE.standard} both`,
            animationDelay: `${i * 0.06}s`,
            transition: `all 0.2s ${EASE.standard}`,
            '&:hover': { borderColor: dimColor, transform: 'translateY(-1px)' },
          }}>
            {/* icon */}
            <Box sx={{
              width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: dimBg,
              border: `1px solid ${dimBrd}`,
            }}>
              <BadgeIcon muiIcon={badge.muiIcon} size={22} color={dimColor} />
            </Box>

            {/* info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                  {t(`badge_${badge.id}`)}
                </Typography>
                {badge.tier && (
                  <Typography sx={{
                    fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                    color, letterSpacing: '0.4px',
                  }}>
                    {t(`tier${badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1)}`)}
                  </Typography>
                )}
              </Box>
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
              +{badge.xp} XP
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeTile — metallic badge card
   ═══════════════════════════════════════════════════════════════ */
function BadgeTile({ badge, isEarned, index, t, onClick }) {
  const color = tierColor(badge.tier)
  const bg    = tierBg(badge.tier)
  const brd   = tierBorder(badge.tier)

  // ── Locked: light enough to read ──
  const lockedIcon   = badge.tier ? `${TIER_COLORS[badge.tier]}55` : `${C.primary}55`
  const lockedBg     = badge.tier ? `${TIER_COLORS[badge.tier]}0C` : `${C.primary}0C`
  const lockedBorder = badge.tier ? `${TIER_COLORS[badge.tier]}22` : `${C.primary}20`
  const lockedName   = 'rgba(255,255,255,0.45)'
  const lockedDesc   = 'rgba(255,255,255,0.28)'
  const lockedMeta   = badge.tier ? `${TIER_COLORS[badge.tier]}40` : `${C.primary}40`

  // ── Earned: vivid glow + strong colors ──
  const earnedBrd = badge.tier ? `${TIER_COLORS[badge.tier]}70` : `${C.primary}70`

  return (
    <Box onClick={onClick} sx={{
      p: '16px 12px',
      borderRadius: '14px',
      position: 'relative',
      border: isEarned ? `2px solid ${earnedBrd}` : `1px solid ${lockedBorder}`,
      background: isEarned
        ? `linear-gradient(145deg, ${color}28 0%, ${color}12 60%, transparent 100%)`
        : `linear-gradient(145deg, ${lockedBg} 0%, var(--c-cardDeep) 100%)`,
      boxShadow: isEarned
        ? `0 0 18px ${color}30, 0 4px 14px ${color}18, inset 0 1px 0 ${color}20`
        : 'none',
      cursor: 'pointer',
      textAlign: 'center',
      animation: `fadeIn 0.2s ${EASE.standard} both`,
      animationDelay: `${index * 0.04}s`,
      transition: `all 0.2s ${EASE.standard}`,
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: isEarned
          ? `0 0 24px ${color}40, 0 6px 20px ${color}25`
          : `0 2px 8px rgba(255,255,255,0.06)`,
        borderColor: isEarned ? earnedBrd : lockedName,
      },
    }}>
      {/* lock icon for unearned badges */}
      {!isEarned && (
        <LockIcon sx={{
          position: 'absolute',
          top: 6, right: 6,
          fontSize: 12,
          color: lockedIcon,
        }} />
      )}

      {/* square icon area */}
      <Box sx={{
        width: 48, height: 48, borderRadius: '12px', mx: 'auto', mb: 0.75,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isEarned ? `${color}20` : lockedBg,
        border: isEarned ? `1.5px solid ${earnedBrd}` : `1.5px solid ${lockedBorder}`,
        transition: `all 0.2s ${EASE.standard}`,
      }}>
        <BadgeIcon muiIcon={badge.muiIcon} size={24} color={isEarned ? color : lockedIcon} />
      </Box>

      {/* badge name (creative title) */}
      <Typography sx={{
        fontSize: '11px', fontWeight: 800,
        color: isEarned ? color : lockedName,
        mb: 0.25, lineHeight: 1.3,
      }}>
        {t(`badge_${badge.id}`)}
      </Typography>

      {/* description (what to do) */}
      <Typography sx={{
        fontSize: '9px', fontWeight: 600,
        color: isEarned ? C.muted : lockedDesc,
        mb: 0.5, lineHeight: 1.3,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {t(`badgeDesc_${badge.id}`)}
      </Typography>

      {/* tier label + xp */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        {badge.tier && (
          <Typography sx={{
            fontSize: '9px', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.5px',
            color: isEarned ? color : lockedMeta,
          }}>
            {badge.tier}
          </Typography>
        )}
        <Typography sx={{
          fontSize: '10px', fontWeight: 600,
          color: isEarned ? color : lockedMeta,
        }}>
          +{badge.xp} XP
        </Typography>
      </Box>
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeDetailDialog — modal on badge tap
   ═══════════════════════════════════════════════════════════════ */
function BadgeDetailDialog({ open, badge, isEarned, client, lang, t, onClose }) {
  if (!badge) return null
  const color = tierColor(badge.tier)
  const bg    = tierBg(badge.tier)
  const brd   = tierBorder(badge.tier)
  const { current, target } = getBadgeProgress(badge, client)
  const progress = target > 0 ? current / target : 0

  // Dimmed tier colors for locked state
  const lockedColor  = badge.tier ? `${TIER_COLORS[badge.tier]}66` : `${C.primary}66`
  const lockedBg     = badge.tier ? `${TIER_COLORS[badge.tier]}0D` : 'var(--c-primaryContainer)'
  const lockedBorder = badge.tier ? `${TIER_COLORS[badge.tier]}28` : `${C.primary}20`

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

      {/* large icon — square */}
      <Box sx={{
        width: 72, height: 72, borderRadius: '16px', mx: 'auto', mb: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isEarned ? bg : lockedBg,
        border: `2px solid ${isEarned ? brd : lockedBorder}`,
      }}>
        <BadgeIcon muiIcon={badge.muiIcon} size={36} color={isEarned ? color : lockedColor} />
      </Box>

      {/* tier label */}
      {badge.tier && (
        <Typography sx={{
          fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '1px', color: isEarned ? color : lockedColor, mb: 0.5,
        }}>
          {t(`tier${badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1)}`)}
        </Typography>
      )}

      {/* badge name */}
      <Typography sx={{
        fontSize: '18px', fontWeight: 800, fontStyle: 'italic',
        color: isEarned ? C.text : lockedColor, mb: 0.75,
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
        color: isEarned ? color : lockedColor, mb: 2,
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
              background: lockedColor,
              width: `${progress * 100}%`,
              transition: `width 0.4s ${EASE.standard}`,
            }} />
          </Box>
          <Typography sx={{ fontSize: '12px', color: lockedColor, fontWeight: 600 }}>
            {badge.condType === 'monthly_steps'
              ? `${current.toLocaleString()} / ${target.toLocaleString()}`
              : `${current} / ${target}`}
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

      {/* Monthly steps history */}
      {badge.condType === 'monthly_steps' && (() => {
        const history = getMonthlyStepHistory(client)
        if (history.length === 0) return null
        return (
          <Typography sx={{ fontSize: '11px', color: C.muted, mt: 1.5, fontWeight: 600 }}>
            {lang === 'bg'
              ? `Спечелен ${history.length} месец${history.length === 1 ? '' : 'а'}`
              : `Earned ${history.length} month${history.length === 1 ? '' : 's'}`}
          </Typography>
        )
      })()}
    </Dialog>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeUnlockedToast — elegant bottom notification
   ═══════════════════════════════════════════════════════════════ */
function BadgeUnlockedToast({ badge, t, onDismiss }) {
  const color = tierColor(badge.tier)
  const bg    = tierBg(badge.tier)
  const brd   = tierBorder(badge.tier)

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
        width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg, border: `1.5px solid ${brd}`,
      }}>
        <BadgeIcon muiIcon={badge.muiIcon} size={20} color={color} />
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


/* ═══════════════════════════════════════════════════════════════
   LevelUpCelebration — fullscreen overlay with particles
   ═══════════════════════════════════════════════════════════════ */
function LevelUpCelebration({ info, t, onDismiss }) {
  // Generate sparkle particles once
  const particles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 3 + Math.random() * 5,
      delay: Math.random() * 1.2,
      duration: 1.5 + Math.random() * 1.5,
      color: [C.primary, '#D4AF37', '#C0C0C0', '#CD7F32', '#fff'][i % 5],
    })),
  [])

  return (
    <Box onClick={onDismiss} sx={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(6, 18, 8, 0.92)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      animation: `levelOverlayIn 0.3s ${EASE.decelerate} both`,
      '@keyframes levelOverlayIn': {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      },
      '@keyframes levelPop': {
        '0%': { opacity: 0, transform: 'scale(0.3)' },
        '60%': { transform: 'scale(1.15)' },
        '100%': { opacity: 1, transform: 'scale(1)' },
      },
      '@keyframes levelSlideUp': {
        '0%': { opacity: 0, transform: 'translateY(20px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
      '@keyframes sparkle': {
        '0%': { opacity: 0, transform: 'scale(0) translateY(0)' },
        '30%': { opacity: 1, transform: 'scale(1) translateY(-10px)' },
        '100%': { opacity: 0, transform: 'scale(0.5) translateY(-40px)' },
      },
      '@keyframes glowPulse': {
        '0%, 100%': { boxShadow: `0 0 40px ${C.primary}44, 0 0 80px ${C.primary}22` },
        '50%': { boxShadow: `0 0 60px ${C.primary}66, 0 0 120px ${C.primary}33` },
      },
    }}>
      {/* Sparkle particles */}
      {particles.map(p => (
        <Box key={p.id} sx={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          animation: `sparkle ${p.duration}s ${EASE.decelerate} infinite`,
          animationDelay: `${p.delay}s`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Arrow up icon */}
      <Box sx={{
        animation: `levelPop 0.5s ${EASE.spring} 0.15s both`,
      }}>
        <ArrowUpwardIcon sx={{
          fontSize: 36, color: C.primary,
          mb: 1.5, opacity: 0.7,
        }} />
      </Box>

      {/* "LEVEL UP" label */}
      <Typography sx={{
        fontSize: '13px', fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '3px',
        color: C.primary,
        animation: `levelSlideUp 0.4s ${EASE.decelerate} 0.2s both`,
        mb: 1,
      }}>
        {t('levelUpMsg')}
      </Typography>

      {/* Big level number */}
      <Box sx={{
        width: 120, height: 120,
        borderRadius: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(145deg, ${C.primary}18 0%, transparent 100%)`,
        border: `2px solid ${C.primary}40`,
        animation: `levelPop 0.5s ${EASE.spring} 0.3s both, glowPulse 2.5s ease-in-out 0.8s infinite`,
        mb: 2,
      }}>
        <Typography sx={{
          fontSize: '64px', fontWeight: 900, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif",
          color: C.primary, lineHeight: 1,
          letterSpacing: '-2px',
        }}>
          {info.level}
        </Typography>
      </Box>

      {/* Level name */}
      <Typography sx={{
        fontSize: '24px', fontWeight: 800, fontStyle: 'italic',
        fontFamily: "'MontBlanc', sans-serif",
        color: C.text,
        animation: `levelSlideUp 0.4s ${EASE.decelerate} 0.45s both`,
        mb: 0.75,
      }}>
        {info.name}
      </Typography>

      {/* Sub message */}
      <Typography sx={{
        fontSize: '14px', fontWeight: 600,
        color: C.muted,
        animation: `levelSlideUp 0.4s ${EASE.decelerate} 0.55s both`,
      }}>
        {t('levelUpSub')}
      </Typography>
    </Box>
  )
}
