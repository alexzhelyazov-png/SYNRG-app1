import { useState } from 'react'
import { Box, Typography, Paper, Chip, Dialog, TextField, Button, IconButton } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SendIcon from '@mui/icons-material/Send'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import { BADGES, TIER_COLORS, getLevelName } from '../lib/gamification'
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

const ICON_MAP = {
  MonitorWeight: MonitorWeightIcon, Restaurant: RestaurantIcon,
  DirectionsWalk: DirectionsWalkIcon, FitnessCenter: FitnessCenterIcon,
  DirectionsRun: DirectionsRunIcon, TrendingDown: TrendingDownIcon,
  LocalFireDepartment: LocalFireDepartmentIcon, EventAvailable: EventAvailableIcon,
  LocalDining: LocalDiningIcon, Egg: EggIcon, EmojiEvents: EmojiEventsIcon,
  AutoAwesome: AutoAwesomeIcon, MilitaryTech: MilitaryTechIcon,
}
function BadgeIcon({ muiIcon, size = 24, color = C.muted }) {
  const Comp = ICON_MAP[muiIcon]; if (!Comp) return null
  return <Comp sx={{ fontSize: size, color }} />
}
const tierColor = (tier) => tier ? TIER_COLORS[tier] : C.purple

// Podium medal colors
const RANK_LABELS  = ['1', '2', '3']
const RANK_COLORS  = [C.purple, '#94A3B8', '#CD7F32']
const PODIUM_H     = [130, 110, 90]
const PODIUM_ORDER = [1, 0, 2] // 2nd, 1st, 3rd in display order

export default function Ranking() {
  const { auth, ranking, t, lang, feedPosts, addFeedPost, deleteFeedPost } = useApp()
  const isMobile = window.innerWidth < 640
  const [viewProfile, setViewProfile] = useState(null)
  const [postText, setPostText] = useState('')

  return (
    <>
      {/* ── Header ────────────────────────────────────── */}
      <Box sx={{
        mb:        3.5,
        animation: `fadeInUp 0.22s ${EASE.decelerate} both`,
      }}>
        <Typography variant="h2" sx={{ mb: 0.75 }}>{t('rankingTitle')}</Typography>
        <Typography sx={{ color: C.muted, fontSize: '14px' }}>
          {t('rankingDesc')}
        </Typography>
      </Box>

      {/* ── Podium (top 3) ────────────────────────────── */}
      {ranking.length >= 3 && (
        <Box sx={{
          display:        'flex',
          alignItems:     'flex-end',
          justifyContent: 'center',
          gap:            1.5,
          mb:             3.5,
          animation:      `fadeInUp 0.3s ${EASE.decelerate} 0.12s both`,
        }}>
          {PODIUM_ORDER.map((rank, displayIdx) => {
            const item    = ranking[rank]
            const isFirst = rank === 0

            return (
              <Box
                key={rank}
                onClick={() => setViewProfile(item)}
                sx={{
                  textAlign: 'center',
                  flex:      1,
                  maxWidth:  isFirst ? '200px' : '180px',
                  cursor:    'pointer',
                  animation: `scaleIn 0.3s ${EASE.spring} ${displayIdx * 0.06 + 0.15}s both`,
                }}
              >
                {/* Rank number badge */}
                <Box sx={{
                  display:        'inline-flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  width:          isFirst ? '44px' : '36px',
                  height:         isFirst ? '44px' : '36px',
                  borderRadius:   '50%',
                  background:     `${RANK_COLORS[rank]}22`,
                  border:         `2px solid ${RANK_COLORS[rank]}55`,
                  mb:             0.75,
                }}>
                  <Typography sx={{
                    fontWeight:  900,
                    fontSize:    isFirst ? '20px' : '16px',
                    color:       RANK_COLORS[rank],
                    lineHeight:  1,
                    fontFamily:  "'MontBlanc', sans-serif",
                  }}>
                    {RANK_LABELS[rank]}
                  </Typography>
                </Box>

                <Paper
                  sx={{
                    p:             '16px 10px',
                    height:        `${PODIUM_H[rank]}px`,
                    display:       'flex',
                    flexDirection: 'column',
                    justifyContent:'center',
                    alignItems:    'center',
                    gap:           0.25,
                    ...(isFirst ? {
                      background: 'linear-gradient(145deg, rgba(170,169,205,0.12) 0%, rgba(170,169,205,0.07) 100%)',
                      border:     '1px solid rgba(170,169,205,0.3)',
                      boxShadow:  '0 0 40px rgba(170,169,205,0.15), 0 0 0 1px rgba(170,169,205,0.12)',
                    } : {}),
                    transition: `box-shadow 0.25s ${EASE.standard}, transform 0.25s ${EASE.standard}`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: isFirst
                        ? '0 0 50px rgba(170,169,205,0.2), 0 8px 32px rgba(0,0,0,0.4)'
                        : '0 6px 24px rgba(0,0,0,0.4)',
                    },
                  }}
                >
                  <Typography sx={{
                    fontWeight:    800,
                    fontSize:      isFirst ? '16px' : '15px',
                    mb:            0.25,
                    color:         isFirst ? C.purple : C.text,
                    letterSpacing: '-0.1px',
                  }}>
                    {item?.name}
                  </Typography>
                  <Typography sx={{
                    fontSize:   '11px',
                    fontWeight: 600,
                    color:      C.muted,
                    fontStyle:  'italic',
                    mb:         0.5,
                  }}>
                    {getLevelName(item?.level || 1, lang)}
                  </Typography>
                  <Typography sx={{
                    fontSize:      isFirst ? '30px' : '24px',
                    fontWeight:    800,
                    color:         RANK_COLORS[rank],
                    lineHeight:    1,
                    letterSpacing: '-0.5px',
                    fontFamily:    "'MontBlanc', sans-serif",
                  }}>
                    {item?.xp}
                  </Typography>
                  <Typography sx={{ color: isFirst ? 'rgba(170,169,205,0.55)' : C.muted, fontSize: '12px' }}>
                    XP
                  </Typography>
                </Paper>
              </Box>
            )
          })}
        </Box>
      )}

      {/* ── Full table ────────────────────────────────── */}
      <Paper sx={{
        overflow:  'hidden',
        p:         0,
        animation: `fadeInUp 0.3s ${EASE.decelerate} 0.18s both`,
      }}>
        {/* Table header */}
        <Box sx={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '35px 1fr 40px 60px' : '50px 1fr 50px 140px 70px 80px',
          px:                  isMobile ? '12px' : '20px',
          py:                  '12px',
          borderBottom:        `1px solid ${C.border}`,
          background:          'rgba(0,0,0,0.25)',
        }}>
          {[
            '#',
            t('rankClientLbl'),
            ...(isMobile
              ? ['Lvl', 'XP']
              : ['Lvl', t('levelNameLbl'), t('badgesLbl'), 'XP']
            ),
          ].map((h, i) => (
            <Typography
              key={i}
              sx={{
                fontSize:      '10.5px',
                color:         C.muted,
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                textAlign:     i >= 2 ? 'center' : 'left',
              }}
            >
              {h}
            </Typography>
          ))}
        </Box>

        {/* Rows */}
        {ranking.map((item, i) => {
          const isMe    = item.name === auth.name
          const isFirst = i === 0

          return (
            <Box
              key={item.name}
              onClick={() => setViewProfile(item)}
              sx={{
                display:             'grid',
                gridTemplateColumns: isMobile ? '35px 1fr 40px 60px' : '50px 1fr 50px 140px 70px 80px',
                px:                  isMobile ? '12px' : '20px',
                cursor:              'pointer',
                py:                  isMobile ? '10px' : '14px',
                borderBottom:        i < ranking.length - 1 ? `1px solid ${C.border}` : 'none',
                background:          isMe
                  ? 'linear-gradient(90deg, rgba(170,169,205,0.07) 0%, rgba(170,169,205,0.03) 100%)'
                  : 'transparent',
                alignItems:          'center',
                transition:          `background-color 0.15s ${EASE.standard}`,
                animation:           `fadeIn 0.2s ${EASE.standard} both`,
                animationDelay:      `${i * 0.04 + 0.2}s`,
                '&:hover':           {
                  background: isMe
                    ? 'rgba(170,169,205,0.09)'
                    : 'rgba(255,255,255,0.025)',
                },
              }}
            >
              {/* Rank number */}
              <Typography sx={{ fontWeight: 800, fontSize: isFirst ? '18px' : '14px', color: i < 3 ? RANK_COLORS[i] : C.muted }}>
                {i + 1}
              </Typography>

              {/* Name + "you" badge */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{
                  fontWeight:    isMe ? 800 : 600,
                  color:         C.text,
                  fontSize:      '14px',
                  letterSpacing: isFirst ? '-0.1px' : 'normal',
                }}>
                  {item.name}
                </Typography>
                {isMe && (
                  <Chip
                    label={t('youBadge')}
                    size="small"
                    sx={{
                      fontSize:   '10px',
                      background: C.accentSoft,
                      color:      C.text,
                      border:     '1px solid rgba(170,169,205,0.35)',
                      fontWeight: 800,
                      height:     '20px',
                    }}
                  />
                )}
              </Box>

              {/* Level number */}
              <Typography sx={{
                textAlign:  'center',
                fontWeight: 700,
                fontSize:   '14px',
                color:      C.text,
              }}>
                {item.level}
              </Typography>

              {/* Desktop-only columns */}
              {!isMobile && (
                <>
                  <Typography sx={{
                    textAlign:  'center',
                    fontWeight: 600,
                    fontSize:   '13px',
                    color:      C.muted,
                    fontStyle:  'italic',
                  }}>
                    {getLevelName(item.level, lang)}
                  </Typography>
                  <Typography sx={{
                    textAlign:  'center',
                    fontWeight: 700,
                    fontSize:   '14px',
                    color:      C.purple,
                  }}>
                    {item.badgeCount}
                  </Typography>
                </>
              )}

              {/* XP */}
              <Typography sx={{
                textAlign:     'center',
                fontWeight:    800,
                fontSize:      isFirst ? '18px' : '15px',
                color:         isFirst ? C.purple : C.text,
                fontFamily:    "'MontBlanc', sans-serif",
                letterSpacing: '-0.3px',
                filter:        isFirst ? 'drop-shadow(0 0 6px rgba(170,169,205,0.25))' : 'none',
              }}>
                {item.xp}
              </Typography>
            </Box>
          )
        })}
      </Paper>

      <Typography sx={{
        mt:        2,
        color:     C.muted,
        fontSize:  '12px',
        textAlign: 'center',
        opacity:   0.7,
        animation: `fadeIn 0.3s ${EASE.decelerate} 0.4s both`,
      }}>
        {t('rankFooterXP')}
      </Typography>

      {/* ── Community Feed ────────────────────────────────── */}
      <Paper sx={{ mt: 4, p: 2.5, animation: `fadeInUp 0.3s ${EASE.decelerate} 0.5s both` }}>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('feedTitle')}</Typography>

        {/* Post input */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          <TextField
            fullWidth size="small"
            placeholder={t('feedPlaceholder')}
            value={postText}
            onChange={e => setPostText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && postText.trim()) {
                e.preventDefault()
                addFeedPost(postText.trim())
                setPostText('')
              }
            }}
            multiline maxRows={3}
            sx={{
              '& .MuiInputBase-input': { color: C.text, fontSize: '14px' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
            }}
          />
          <Button variant="contained" size="small" disabled={!postText.trim()}
            onClick={() => { addFeedPost(postText.trim()); setPostText('') }}
            sx={{ background: C.primary, color: C.primaryOn, fontWeight: 700, minWidth: 0, px: 2, alignSelf: 'flex-end' }}>
            <SendIcon sx={{ fontSize: 18 }} />
          </Button>
        </Box>

        {/* Posts list */}
        {feedPosts.length === 0 ? (
          <Typography sx={{ color: C.muted, fontSize: '13px', textAlign: 'center', py: 2 }}>
            {t('feedEmpty')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {feedPosts.slice(0, 50).map((post, i) => {
              const isOwn = post.client_id === auth.id || post.author_name === auth.name
              const isCoach = auth.role === 'coach' || auth.role === 'admin'
              const diff = Date.now() - new Date(post.created_at).getTime()
              const mins = Math.floor(diff / 60000)
              const timeStr = mins < 1 ? (lang === 'bg' ? 'сега' : 'now')
                : mins < 60 ? `${mins} ${lang === 'bg' ? 'мин.' : 'min'}`
                : mins < 1440 ? `${Math.floor(mins / 60)} ${lang === 'bg' ? 'ч.' : 'h'}`
                : `${Math.floor(mins / 1440)} ${lang === 'bg' ? 'д.' : 'd'}`
              return (
                <Box key={post.id} sx={{
                  display: 'flex', gap: 1.5, py: 1.5,
                  borderBottom: i < feedPosts.length - 1 ? `1px solid ${C.border}` : 'none',
                  animation: `fadeIn 0.2s ${EASE.standard} both`,
                  animationDelay: `${i * 0.03}s`,
                }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: isOwn ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 800, color: isOwn ? C.purple : C.muted,
                  }}>
                    {(post.author_name || '?').charAt(0).toUpperCase()}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: isOwn ? C.purple : C.text }}>
                        {post.author_name}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: C.muted }}>{timeStr}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '14px', color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {post.content}
                    </Typography>
                  </Box>
                  {(isOwn || isCoach) && (
                    <IconButton size="small" onClick={() => deleteFeedPost(post.id)}
                      sx={{ color: C.muted, opacity: 0.4, alignSelf: 'flex-start', p: 0.5,
                        '&:hover': { opacity: 1, color: '#F87171' } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
      </Paper>

      {/* ── Badge Profile Dialog ── */}
      {viewProfile && (() => {
        const earnedSet = new Set(viewProfile.earnedIds || [])
        const earned = BADGES.filter(b => earnedSet.has(b.id))
        return (
          <Dialog open onClose={() => setViewProfile(null)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}`, p: 3 } }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 2.5 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 1.5,
                background: C.primaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: 800, color: C.purple,
              }}>
                {viewProfile.name.charAt(0).toUpperCase()}
              </Box>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: C.text, fontFamily: "'MontBlanc', sans-serif", fontStyle: 'italic' }}>
                {viewProfile.name}
              </Typography>
              <Typography sx={{ fontSize: '13px', color: C.muted, fontStyle: 'italic', mt: 0.25 }}>
                {getLevelName(viewProfile.level, lang)}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1.5 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '24px', fontWeight: 800, color: C.purple, fontFamily: "'MontBlanc', sans-serif" }}>
                    {viewProfile.level}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: C.muted }}>{t('levelLbl')}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '24px', fontWeight: 800, color: C.text, fontFamily: "'MontBlanc', sans-serif" }}>
                    {viewProfile.xp}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: C.muted }}>XP</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '24px', fontWeight: 800, color: C.text, fontFamily: "'MontBlanc', sans-serif" }}>
                    {earned.length}
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: C.muted }}>{t('badgesLbl')}</Typography>
                </Box>
              </Box>
            </Box>

            {/* Earned badges grid */}
            {earned.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {earned.map(b => {
                  const color = tierColor(b.tier)
                  return (
                    <Box key={b.id} sx={{
                      width: 56, height: 56, borderRadius: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${color}15`, border: `1.5px solid ${color}35`,
                    }}>
                      <BadgeIcon muiIcon={b.muiIcon} size={26} color={color} />
                    </Box>
                  )
                })}
              </Box>
            ) : (
              <Typography sx={{ textAlign: 'center', color: C.muted, fontSize: '13px' }}>
                {t('noBadgesYet')}
              </Typography>
            )}
          </Dialog>
        )
      })()}
    </>
  )
}
