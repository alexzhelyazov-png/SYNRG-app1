import { Box, Typography, Paper, Chip } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import { getLevelName } from '../lib/gamification'

// Podium medal colors
const RANK_LABELS  = ['1', '2', '3']
const RANK_COLORS  = [C.primary, '#94A3B8', '#CD7F32']
const PODIUM_H     = [130, 110, 90]
const PODIUM_ORDER = [1, 0, 2] // 2nd, 1st, 3rd in display order

export default function Ranking() {
  const { auth, ranking, t, lang } = useApp()
  const isMobile = window.innerWidth < 640

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
                sx={{
                  textAlign: 'center',
                  flex:      1,
                  maxWidth:  isFirst ? '200px' : '180px',
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
                      background: 'linear-gradient(145deg, rgba(196,233,191,0.12) 0%, rgba(196,233,191,0.07) 100%)',
                      border:     '1px solid rgba(196,233,191,0.3)',
                      boxShadow:  '0 0 40px rgba(196,233,191,0.15), 0 0 0 1px rgba(196,233,191,0.12)',
                    } : {}),
                    transition: `box-shadow 0.25s ${EASE.standard}, transform 0.25s ${EASE.standard}`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: isFirst
                        ? '0 0 50px rgba(196,233,191,0.2), 0 8px 32px rgba(0,0,0,0.4)'
                        : '0 6px 24px rgba(0,0,0,0.4)',
                    },
                  }}
                >
                  <Typography sx={{
                    fontWeight:    800,
                    fontSize:      isFirst ? '16px' : '15px',
                    mb:            0.25,
                    color:         isFirst ? C.primary : C.text,
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
                  <Typography sx={{ color: isFirst ? 'rgba(196,233,191,0.55)' : C.muted, fontSize: '12px' }}>
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
              sx={{
                display:             'grid',
                gridTemplateColumns: isMobile ? '35px 1fr 40px 60px' : '50px 1fr 50px 140px 70px 80px',
                px:                  isMobile ? '12px' : '20px',
                py:                  isMobile ? '10px' : '14px',
                borderBottom:        i < ranking.length - 1 ? `1px solid ${C.border}` : 'none',
                background:          isMe
                  ? 'linear-gradient(90deg, rgba(196,233,191,0.07) 0%, rgba(196,233,191,0.03) 100%)'
                  : 'transparent',
                alignItems:          'center',
                transition:          `background-color 0.15s ${EASE.standard}`,
                animation:           `fadeIn 0.2s ${EASE.standard} both`,
                animationDelay:      `${i * 0.04 + 0.2}s`,
                '&:hover':           {
                  background: isMe
                    ? 'rgba(196,233,191,0.09)'
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
                  color:         isMe ? C.primary : C.text,
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
                      color:      C.primary,
                      border:     '1px solid rgba(196,233,191,0.35)',
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
                color:      C.primary,
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
                color:         isFirst ? C.primary : C.text,
                fontFamily:    "'MontBlanc', sans-serif",
                letterSpacing: '-0.3px',
                filter:        isFirst ? 'drop-shadow(0 0 6px rgba(196,233,191,0.25))' : 'none',
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
    </>
  )
}
