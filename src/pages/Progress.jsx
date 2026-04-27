import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, Typography, Dialog, IconButton } from '@mui/material'
import Ranking from './Ranking'
import CommunityFeed from './CommunityFeed'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'
import { C, EASE } from '../theme'
import {
  ALLTIME_BADGES, MONTHLY_BADGES, BADGES, PR_EXERCISES, getCurrentPRs,
  TIER_COLORS, TIER_ORDER, LEVEL_THRESHOLDS, LEVEL_NAMES,
  evaluateBadges, evaluateMonthlyBadgesForMonth,
  computeTotalXP, computeMonthlyXP, computeLevel, getLevelName,
  getNextBadges, getBadgeProgress, getMonthlyBadgeHistory,
  getCurrentMonthKey,
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
const tierColor  = (tier) => tier ? TIER_COLORS[tier] : C.purple
const tierBg     = (tier) => tier ? `${TIER_COLORS[tier]}18` : 'var(--c-primaryContainer)'
const tierBorder = (tier) => tier ? `${TIER_COLORS[tier]}40` : 'var(--c-primaryA20)'

function BadgeIcon({ muiIcon, size = 24, color: clr = C.muted }) {
  const Comp = ICON_MAP[muiIcon]
  if (!Comp) return null
  return <Comp sx={{ fontSize: size, color: clr }} />
}

/* ═══════════════════════════════════════════════════════════════
   Main Progress page — Gamification v3
   ═══════════════════════════════════════════════════════════════ */
export default function Progress() {
  const { client, auth, ranking, t, lang, dismissBadge, markFeedSeen, feedPosts, postComments, unreadFeedCount, pendingProgressTab, setPendingProgressTab } = useApp()
  const isMobile = window.innerWidth < 640
  const [selectedBadge, setSelectedBadge] = useState(null)
  const [tab, setTab] = useState(() => pendingProgressTab || 'progress') // 'progress' | 'ranking' | 'feed'

  // Consume pending deep-link tab once on mount
  useEffect(() => {
    if (pendingProgressTab) {
      setTab(pendingProgressTab)
      if (pendingProgressTab === 'feed' && markFeedSeen) markFeedSeen()
      setPendingProgressTab(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchTab(key) {
    setTab(key)
    if (key === 'feed' && markFeedSeen) markFeedSeen()
    if (key === 'ranking') DB.trackEvent(auth.id, 'ranking_viewed')
    if (key === 'feed')    DB.trackEvent(auth.id, 'feed_viewed')
  }

  // ── Enrich client with community data for badge evaluation ──
  const clientWithCommunity = useMemo(() => ({
    ...client,
    communityPosts:    feedPosts.filter(p => p.author_name === client.name),
    communityComments: postComments.filter(c => c.author_name === client.name),
  }), [client, feedPosts, postComments])

  // ── All-time gamification data ─────────────────────────────
  const earnedIds  = useMemo(() => evaluateBadges(clientWithCommunity), [clientWithCommunity])
  const earnedSet  = useMemo(() => new Set(earnedIds), [earnedIds])
  const totalXP    = useMemo(() => computeTotalXP(earnedIds, clientWithCommunity), [earnedIds, clientWithCommunity])
  const levelData  = useMemo(() => computeLevel(totalXP), [totalXP])
  const levelName  = getLevelName(levelData.level, lang)
  const nextBadges = useMemo(() => getNextBadges(clientWithCommunity, earnedIds, 3), [clientWithCommunity, earnedIds])

  // ── Monthly gamification data ──────────────────────────────
  const currentMonthKey   = useMemo(() => getCurrentMonthKey(), [])
  const monthlyEarnedIds  = useMemo(() => evaluateMonthlyBadgesForMonth(clientWithCommunity, currentMonthKey), [clientWithCommunity, currentMonthKey])
  const monthlyEarnedSet  = useMemo(() => new Set(monthlyEarnedIds), [monthlyEarnedIds])
  const monthlyXP         = useMemo(() => computeMonthlyXP(clientWithCommunity), [clientWithCommunity])

  // ── Monthly badge series for grid ──────────────────────────
  const monthlySeriesKeys = useMemo(() => {
    const seen = []
    for (const b of MONTHLY_BADGES) {
      if (b.series && !seen.includes(b.series)) seen.push(b.series)
    }
    return seen
  }, [])

  // ── Personal Records (display only, no celebration logic) ──
  const currentPRs = useMemo(() => getCurrentPRs(client.workouts), [client.workouts])
  const [prDialogOpen, setPrDialogOpen] = useState(false)
  const prTotalUnlocked = useMemo(() => Object.values(currentPRs).reduce((s, p) => s + p.count, 0), [currentPRs])
  const prTotalAll = useMemo(() => Object.values(currentPRs).reduce((s, p) => s + p.total, 0), [currentPRs])
  const prTotalXP = useMemo(() => Object.values(currentPRs).reduce((s, p) => s + p.totalXP, 0), [currentPRs])

  // ── Badge unlock notification ────────────────────────────────
  const [unlockedBadge, setUnlockedBadge] = useState(null)

  const prevEarnedRef = useRef(null)

  // Detect NEW badges only (not already-earned ones on first load)
  useEffect(() => {
    if (earnedIds.length === 0) return
    if (unlockedBadge) return
    if (prevEarnedRef.current === null) {
      // First load: store current state, no celebration
      prevEarnedRef.current = { alltime: [...earnedIds], monthly: [...monthlyEarnedIds] }
      return
    }
    // Check for newly earned all-time badges
    const dismissed = new Set(client.dismissedBadges || [])
    const newAlltime = earnedIds.find(id => !prevEarnedRef.current.alltime.includes(id) && !dismissed.has(id))
    if (newAlltime) {
      const badge = ALLTIME_BADGES.find(b => b.id === newAlltime)
      if (badge) { setUnlockedBadge(badge); prevEarnedRef.current.alltime = [...earnedIds]; return }
    }
    // Check for newly earned monthly badges
    const newMonthly = monthlyEarnedIds.find(id =>
      !prevEarnedRef.current.monthly.includes(id) && !dismissed.has(`${id}:${currentMonthKey}`)
    )
    if (newMonthly) {
      const badge = MONTHLY_BADGES.find(b => b.id === newMonthly)
      if (badge) { setUnlockedBadge(badge); prevEarnedRef.current.monthly = [...monthlyEarnedIds]; return }
    }
    prevEarnedRef.current = { alltime: [...earnedIds], monthly: [...monthlyEarnedIds] }
  }, [earnedIds, monthlyEarnedIds, client.dismissedBadges, unlockedBadge])

  const handleDismissUnlock = () => {
    if (unlockedBadge) {
      if (unlockedBadge.monthly) {
        dismissBadge(unlockedBadge.id, currentMonthKey)
      } else {
        dismissBadge(unlockedBadge.id)
      }
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
      {/* ── Sub-tabs ────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
        {[
          { key: 'progress', label: lang === 'bg' ? 'Моите значки' : 'My Badges' },
          { key: 'ranking',  label: t('navRanking') },
          { key: 'feed',     label: lang === 'bg' ? 'Стена' : 'Feed', badge: unreadFeedCount },
        ].map(({ key, label, badge }) => (
          <Box
            key={key}
            onClick={() => switchTab(key)}
            data-tour={key === 'progress' ? 'tab-badges' : key === 'ranking' ? 'tab-ranking' : undefined}
            sx={{
            px: 2.5, py: 1, borderRadius: '100px', cursor: 'pointer',
            fontSize: '14px', fontWeight: 700,
            background: tab === key ? C.primary : 'transparent',
            color: tab === key ? C.primaryOn : C.text,
            border: `1px solid ${tab === key ? C.primary : C.loganBorder}`,
            transition: 'all 0.22s',
            '&:hover': tab === key ? {} : { borderColor: C.logan, background: C.loganDeep },
            display: 'flex', alignItems: 'center', gap: 0.75, position: 'relative',
          }}>
            {label}
            {badge > 0 && tab !== key && (
              <Box sx={{
                minWidth: 18, height: 18, borderRadius: '9px',
                background: '#F87171', color: '#fff',
                fontSize: '10px', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                px: 0.5, lineHeight: 1,
              }}>
                {badge > 9 ? '9+' : badge}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {tab === 'ranking' && <Ranking />}
      {tab === 'feed'    && <CommunityFeed />}
      {tab === 'progress' && <>
      {/* ── Header ───────────────────────────────────────────── */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h2" sx={{ fontStyle: 'italic' }}>
          {t('gamificationTitle')}
        </Typography>
        <Typography variant="body2" sx={{ color: C.muted, mt: 0.5, fontWeight: 600 }}>
          {client.name}
        </Typography>
      </Box>

      {/* ── Mini Leaderboard ─────────────────────────────────── */}
      {ranking.length >= 2 && (
        <Box onClick={() => switchTab('ranking')} sx={{
          mb: 2, p: 1.5, borderRadius: '14px', cursor: 'pointer',
          border: `1px solid ${C.border}`,
          background: 'rgba(255,255,255,0.02)',
          transition: `all 0.2s ${EASE.standard}`,
          '&:hover': { borderColor: C.borderHover, transform: 'translateY(-2px)' },
        }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 1.5 }}>
            {t('monthlyXpLbl')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {ranking.slice(0, 5).map((r, i) => {
              const isMe = r.name === auth.name
              const medal = i < 3 ? ['#C8C5FF', '#94A3B8', '#CD7F32'][i] : null
              return (
                <Box key={r.name} sx={{
                  flex: 1, textAlign: 'center', py: 1, px: 0.5, borderRadius: '10px',
                  background: isMe ? 'rgba(170,169,205,0.08)' : 'transparent',
                  border: isMe ? '1px solid rgba(170,169,205,0.2)' : '1px solid transparent',
                }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 700, color: medal || C.muted, mb: 0.5 }}>
                    #{i + 1}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', fontWeight: isMe ? 800 : 600, color: C.text, mb: 0.5,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name?.split(' ')[0]}
                  </Typography>
                  <Typography sx={{ fontSize: '17px', fontWeight: 800, color: medal || C.text,
                    fontFamily: "'MontBlanc', sans-serif", lineHeight: 1 }}>
                    {r.xp}
                  </Typography>
                  <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 600 }}>XP</Typography>
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {/* ── Level Card ───────────────────────────────────────── */}
      <LevelCard levelData={levelData} levelName={levelName} t={t} lang={lang} earnedCount={earnedIds.length} />

      {/* ── Next Badges ──────────────────────────────────────── */}
      {nextBadges.length > 0 && (
        <NextBadgesSection items={nextBadges} t={t} lang={lang} onBadgeClick={setSelectedBadge} />
      )}

      {/* ═══════════════════════════════════════════════════════
          МЕСЕЧНИ ЗНАЧКИ — Monthly badges (earn ranking XP)
          ═══════════════════════════════════════════════════════ */}
      <Box sx={{
        background: 'linear-gradient(145deg, rgba(170,169,205,0.06) 0%, rgba(170,169,205,0.02) 100%)',
        border: `1px solid rgba(170,169,205,0.15)`,
        borderRadius: '20px',
        p: '20px 16px',
        mb: 3,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
          <Typography variant="h3" sx={{ fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t('monthlyBadgesTitle')}
          </Typography>
          <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
        </Box>
        <Typography sx={{ fontSize: '14px', color: C.muted, fontWeight: 600, textAlign: 'center', mb: 2 }}>
          {t('monthlyBadgesDesc')}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            px: 1.5, py: 0.5, borderRadius: '8px',
            background: `${C.primary}15`, border: `1px solid ${C.primary}25`,
          }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: C.purple, fontFamily: "'MontBlanc', sans-serif" }}>
              {monthlyXP}
            </Typography>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted }}>XP</Typography>
          </Box>
        </Box>

        {/* Monthly badge series */}
        {monthlySeriesKeys.map(seriesKey => {
          const seriesBadges = MONTHLY_BADGES.filter(b => b.series === seriesKey)
          return (
            <Box key={seriesKey} sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}>
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
                  <BadgeTile key={badge.id} badge={badge} isEarned={monthlyEarnedSet.has(badge.id)}
                    index={i} t={t} onClick={() => setSelectedBadge(badge)} />
                ))}
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* ═══════════════════════════════════════════════════════
          ALL-TIME ЗНАЧКИ — Permanent achievements
          ═══════════════════════════════════════════════════════ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 1 }}>
        <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
        <Typography variant="h3" sx={{ fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t('allTimeBadgesTitle')}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: 1.25,
        mb: 3,
      }}>
        {/* PR Badge Tile */}
        <Box onClick={() => setPrDialogOpen(true)} sx={{
          p: '16px 12px', borderRadius: '14px', position: 'relative',
          border: '2px solid rgba(212,175,55,0.7)',
          background: 'linear-gradient(145deg, rgba(212,175,55,0.28) 0%, rgba(212,175,55,0.12) 60%, transparent 100%)',
          boxShadow: '0 0 18px rgba(212,175,55,0.30), 0 4px 14px rgba(212,175,55,0.18), inset 0 1px 0 rgba(212,175,55,0.20)',
          cursor: 'pointer', textAlign: 'center',
          transition: `all 0.2s ${EASE.standard}`,
          '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 0 24px rgba(212,175,55,0.40), 0 6px 20px rgba(212,175,55,0.25)' },
        }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '12px', mx: 'auto', mb: 0.75,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(212,175,55,0.20)',
          }}>
            <BadgeIcon muiIcon="EmojiEvents" size={24} color="#D4AF37" />
          </Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#D4AF37', mb: 0.5, lineHeight: 1.3 }}>
            {lang === 'bg' ? 'Лични рекорди' : 'Personal Records'}
          </Typography>
          <Typography sx={{ fontSize: '10px', fontWeight: 600, color: '#D4AF37' }}>
            +{prTotalXP} XP
          </Typography>
        </Box>

        {ALLTIME_BADGES.map((badge, i) => (
          <BadgeTile key={badge.id} badge={badge} isEarned={earnedSet.has(badge.id)}
            index={i + 1} t={t} onClick={() => setSelectedBadge(badge)} />
        ))}
      </Box>

      {/* ── PR Dialog ────────────────────────────────────────── */}
      <PRDialog open={prDialogOpen} onClose={() => setPrDialogOpen(false)} currentPRs={currentPRs} lang={lang} />

      {/* ── Badge Detail Dialog ──────────────────────────────── */}
      <BadgeDetailDialog
        open={!!selectedBadge}
        badge={selectedBadge}
        isEarned={selectedBadge
          ? (selectedBadge.monthly ? monthlyEarnedSet.has(selectedBadge.id) : earnedSet.has(selectedBadge.id))
          : false}
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
      </>}
    </>
  )
}


/* ═══════════════════════════════════════════════════════════════
   LevelCard — hero section
   ═══════════════════════════════════════════════════════════════ */
function LevelCard({ levelData, levelName, t, lang, earnedCount }) {
  const [showLevels, setShowLevels] = useState(false)
  const names = LEVEL_NAMES[lang] || LEVEL_NAMES.bg

  return (
    <>
      <Box onClick={() => setShowLevels(true)} sx={{
        background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
        border: `1px solid ${C.border}`,
        borderRadius: '20px',
        p: '24px',
        mb: 3,
        cursor: 'pointer',
        animation: `fadeInUp 0.3s ${EASE.decelerate} both`,
        '&:hover': { borderColor: C.primary },
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
            color: C.text, lineHeight: 1,
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
          <Typography sx={{ fontSize: '12px', color: C.text, fontWeight: 700 }}>
            {levelData.totalXP} {t('xpLbl')}
          </Typography>
        </Box>
      </Box>

      {/* All levels dialog */}
      <Dialog open={showLevels} onClose={() => setShowLevels(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.9px', color: C.muted, mb: 2 }}>
            {lang === 'bg' ? 'Всички нива' : 'All levels'}
          </Typography>
          {LEVEL_THRESHOLDS.map((xp, i) => {
            const lvl = i + 1
            const isCurrent = levelData.level === lvl
            const isReached = levelData.level >= lvl
            return (
              <Box key={lvl} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, py: 1,
                borderBottom: `1px solid ${i < 19 ? 'rgba(255,255,255,0.04)' : 'transparent'}`,
                opacity: isReached ? 1 : 0.45,
              }}>
                <Typography sx={{
                  fontSize: '20px', fontWeight: 900, fontStyle: 'italic',
                  fontFamily: "'MontBlanc', sans-serif",
                  color: isCurrent ? C.primary : isReached ? C.purple : C.muted,
                  minWidth: 32, textAlign: 'center', lineHeight: 1,
                }}>
                  {lvl}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: isCurrent ? C.primary : C.text }}>
                    {names[i]}
                  </Typography>
                  <Typography sx={{ fontSize: '10px', color: C.muted }}>
                    {xp} {t('xpLbl')}{i < 19 ? ` — ${LEVEL_THRESHOLDS[i + 1] - 1} ${t('xpLbl')}` : '+'}
                  </Typography>
                </Box>
                {isCurrent && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: C.primary, flexShrink: 0 }} />
                )}
                {isReached && !isCurrent && (
                  <Typography sx={{ fontSize: '10px', color: C.purple }}>&#10003;</Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </Dialog>
    </>
  )
}


/* ═══════════════════════════════════════════════════════════════
   NextBadgesSection — 2-3 closest-to-unlock badges
   ═══════════════════════════════════════════════════════════════ */
function NextBadgesSection({ items, t, lang, onBadgeClick }) {
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
                {badge.monthly && (
                  <Typography sx={{
                    fontSize: '8px', fontWeight: 700, textTransform: 'uppercase',
                    color: C.primary, letterSpacing: '0.3px', opacity: 0.7,
                  }}>
                    {lang === 'bg' ? 'МЕСЕЧНА' : 'MONTHLY'}
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
  const brd   = badge.tier ? `${TIER_COLORS[badge.tier]}70` : `${C.primary}70`

  return (
    <Box onClick={onClick} sx={{
      p: '16px 12px',
      borderRadius: '14px',
      position: 'relative',
      border: `2px solid ${brd}`,
      background: `linear-gradient(145deg, ${color}28 0%, ${color}12 60%, transparent 100%)`,
      boxShadow: `0 0 18px ${color}30, 0 4px 14px ${color}18, inset 0 1px 0 ${color}20`,
      cursor: 'pointer',
      textAlign: 'center',
      animation: `fadeIn 0.2s ${EASE.standard} both`,
      animationDelay: `${index * 0.04}s`,
      transition: `all 0.2s ${EASE.standard}`,
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 0 24px ${color}40, 0 6px 20px ${color}25`,
        borderColor: brd,
      },
    }}>
      {/* square icon area with lock overlay for unearned */}
      <Box sx={{
        width: 48, height: 48, borderRadius: '12px', mx: 'auto', mb: 0.75,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        background: `${color}20`,
        transition: `all 0.2s ${EASE.standard}`,
      }}>
        <BadgeIcon muiIcon={badge.muiIcon} size={24} color={color} />
        {!isEarned && (
          <Box sx={{
            position: 'absolute', inset: 0, borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
          }}>
            <LockIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.9)' }} />
          </Box>
        )}
      </Box>

      {/* badge name */}
      <Typography sx={{
        fontSize: '11px', fontWeight: 800,
        color,
        mb: 0.25, lineHeight: 1.3,
      }}>
        {t(`badge_${badge.id}`)}
      </Typography>

      {/* description */}
      <Typography sx={{
        fontSize: '9px', fontWeight: 600,
        color: C.muted,
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
            color,
          }}>
            {badge.tier}
          </Typography>
        )}
        <Typography sx={{
          fontSize: '10px', fontWeight: 600,
          color,
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

      {/* monthly indicator */}
      {badge.monthly && (
        <Typography sx={{
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '1px', color: C.primary, mb: 0.5, opacity: 0.7,
        }}>
          {lang === 'bg' ? 'МЕСЕЧНА ЗНАЧКА' : 'MONTHLY BADGE'}
        </Typography>
      )}

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

      {/* Monthly badge: can be earned every month note */}
      {badge.monthly && (
        <Typography sx={{ fontSize: '11px', color: C.muted, mt: 1.5, fontWeight: 600, fontStyle: 'italic' }}>
          {lang === 'bg' ? 'Може да се печели всеки месец' : 'Can be earned every month'}
        </Typography>
      )}
    </Dialog>
  )
}


/* ═══════════════════════════════════════════════════════════════
   BadgeUnlockedToast — celebration with confetti burst
   ═══════════════════════════════════════════════════════════════ */
export function BadgeUnlockedToast({ badge, t, onDismiss }) {
  const color = tierColor(badge.tier)
  const bg    = tierBg(badge.tier)
  const brd   = tierBorder(badge.tier)

  // Big confetti burst — 60 particles spread across screen
  const confetti = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist = 120 + Math.random() * 280
      const colors = [C.primary, '#D4AF37', '#C0C0C0', '#CD7F32', color, '#fff', '#FF6B9D', '#7C5CFC', '#4ADE80', '#FACC15']
      return {
        id: i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 60,
        size: 8 + Math.random() * 12,
        color: colors[i % colors.length],
        delay: Math.random() * 0.5,
        dur: 1.2 + Math.random() * 1.0,
        rotate: Math.random() * 720,
        shape: i % 3,
      }
    }),
  [color])

  return (
    <Box onClick={onDismiss} sx={{
      position: 'fixed', inset: 0, zIndex: 1500,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer',
      animation: `badgeOverlayIn 0.3s ease both`,
      '@keyframes badgeOverlayIn': {
        '0%': { opacity: 0 },
        '100%': { opacity: 1 },
      },
      '@keyframes confettiBurst': {
        '0%': { opacity: 1, transform: 'translate(0,0) scale(1) rotate(0deg)' },
        '100%': { opacity: 0, transform: 'translate(var(--tx), var(--ty)) scale(0.2) rotate(var(--rot))' },
      },
      '@keyframes badgeIconIn': {
        '0%': { opacity: 0, transform: 'scale(0)' },
        '50%': { transform: 'scale(1.15)' },
        '70%': { transform: 'scale(0.92)' },
        '100%': { opacity: 1, transform: 'scale(1)' },
      },
      '@keyframes badgeGlow': {
        '0%, 100%': { boxShadow: `0 0 40px ${color}40, 0 0 80px ${color}20` },
        '50%': { boxShadow: `0 0 60px ${color}60, 0 0 120px ${color}35` },
      },
      '@keyframes textFadeUp': {
        '0%': { opacity: 0, transform: 'translateY(20px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      {/* Confetti particles — centered on icon */}
      {confetti.map(p => (
        <Box key={p.id} sx={{
          position: 'absolute',
          left: '50%', top: '40%',
          width: p.shape === 2 ? p.size * 0.7 : p.size,
          height: p.shape === 0 ? p.size : p.size * 0.5,
          borderRadius: p.shape === 0 ? '50%' : p.shape === 2 ? '3px' : '2px',
          background: p.color,
          transform: p.shape === 2 ? 'rotate(45deg)' : 'none',
          '--tx': `${p.tx}px`,
          '--ty': `${p.ty}px`,
          '--rot': `${p.rotate}deg`,
          animation: `confettiBurst ${p.dur}s ${EASE.decelerate} forwards`,
          animationDelay: `${p.delay}s`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Big badge icon — 40% of viewport width */}
      <Box sx={{
        width: '40vw', height: '40vw', maxWidth: 280, maxHeight: 280,
        borderRadius: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg, border: `3px solid ${brd}`,
        animation: `badgeIconIn 0.6s ${EASE.spring} 0.1s both, badgeGlow 2s ease 0.5s infinite`,
        mb: 3,
      }}>
        <BadgeIcon muiIcon={badge.muiIcon} size={120} color={color} />
      </Box>

      {/* Badge name */}
      <Typography sx={{
        fontSize: '24px', fontWeight: 800, color: C.text,
        fontFamily: "'MontBlanc', sans-serif", fontStyle: 'italic',
        textAlign: 'center', px: 3,
        animation: `textFadeUp 0.4s ease 0.3s both`,
      }}>
        {t(`badge_${badge.id}`)}
      </Typography>

      {/* "СПЕЧЕЛИ БАДЖ +XP" */}
      <Typography sx={{
        fontSize: '18px', fontWeight: 800, color,
        textTransform: 'uppercase', letterSpacing: '1.5px',
        mt: 1.5,
        animation: `textFadeUp 0.4s ease 0.5s both`,
      }}>
        {t('badgeUnlockedMsg')} +{badge.xp} XP
      </Typography>
    </Box>
  )
}


/* ═══════════════════════════════════════════════════════════════
   LevelUpCelebration — fullscreen overlay with particles
   ═══════════════════════════════════════════════════════════════ */
export function LevelUpCelebration({ info, t, onDismiss }) {
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
          fontSize: 36, color: C.purple,
          mb: 1.5, opacity: 0.7,
        }} />
      </Box>

      {/* "LEVEL UP" label */}
      <Typography sx={{
        fontSize: '13px', fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '3px',
        color: C.purple,
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
          color: C.purple, lineHeight: 1,
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


/* ═══════════════════════════════════════════════════════════════
   PRDialog — expandable personal records dialog
   ═══════════════════════════════════════════════════════════════ */
function PRDialog({ open, onClose, currentPRs, lang }) {
  const gold = '#D4AF37'
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: {
        background: 'linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)',
        border: `1px solid ${gold}30`, borderRadius: '20px', p: 3,
      }}}>
      <IconButton onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, color: C.muted }}>
        <span style={{ fontSize: '18px', lineHeight: 1 }}>x</span>
      </IconButton>

      <Box sx={{ textAlign: 'center', mb: 2.5 }}>
        <Box sx={{
          width: 56, height: 56, borderRadius: '14px', mx: 'auto', mb: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${gold}18`, border: `2px solid ${gold}35`,
        }}>
          <BadgeIcon muiIcon="EmojiEvents" size={30} color={gold} />
        </Box>
        <Typography sx={{ fontSize: '20px', fontWeight: 800, fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif", color: C.text }}>
          {lang === 'bg' ? 'Лични рекорди' : 'Personal Records'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {PR_EXERCISES.map(ex => {
          const pr = currentPRs[ex.id]
          const best = pr?.best || 0
          const hasData = best >= 0 && pr?.count > 0
          const suffix = ex.type === 'weight' ? ' kg' : (lang === 'bg' ? ' пъти' : ' reps')
          return (
            <Box key={ex.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2, py: 1.5, borderRadius: '12px',
              background: hasData ? `${gold}10` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${hasData ? `${gold}25` : 'rgba(255,255,255,0.06)'}`,
            }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hasData ? `${gold}18` : 'rgba(255,255,255,0.06)',
              }}>
                <BadgeIcon muiIcon={ex.muiIcon} size={20} color={hasData ? gold : C.muted} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: hasData ? C.text : C.muted }}>
                  {lang === 'bg' ? ex.labelBg : ex.labelEn}
                </Typography>
                <Typography sx={{ fontSize: '10px', color: C.muted }}>
                  +{pr?.totalXP || 0} XP
                </Typography>
              </Box>
              <Typography sx={{
                fontSize: hasData ? '22px' : '14px',
                fontWeight: 800, color: hasData ? gold : C.muted,
                fontFamily: "'MontBlanc', sans-serif",
              }}>
                {hasData ? `${best}${suffix}` : '—'}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Dialog>
  )
}
