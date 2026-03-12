import { Box, Typography, TextField, Button, Chip, Paper } from '@mui/material'
import { useApp } from '../context/AppContext'
import { quickFoods, foodDB, foodLabel } from '../lib/constants'
import { C, EASE } from '../theme'
import ProgressRing from '../components/ProgressRing'
import FoodModal    from '../components/FoodModal'
import { fmt1, parseDate } from '../lib/utils'
import { useMemo } from 'react'

export default function FoodTracker() {
  const {
    auth, client, t, lang,
    viewingCoach,
    foodDate, setFoodDate,
    setFoodModalOpen,
    mealsForDate, selFoodDate,
    foodTotals, kcalPct, protPct,
    addQuickFood, deleteMealFromClient,
    isTrackerReadOnly,
  } = useApp()

  const dailyHistory = useMemo(() => {
    const byDate = {}
    ;(client.meals || []).forEach(m => {
      if (!byDate[m.date]) byDate[m.date] = { kcal: 0, protein: 0 }
      byDate[m.date].kcal    += Number(m.kcal    || 0)
      byDate[m.date].protein += Number(m.protein || 0)
    })
    return Object.entries(byDate)
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => parseDate(b.date) - parseDate(a.date))
      .filter(d => d.date !== selFoodDate)
      .slice(0, 10)
  }, [client.meals, selFoodDate])

  const isMobile = window.innerWidth < 640

  return (
    <>
      <FoodModal />

      {/* ── Viewing banner (coaches only) ───────────── */}
      {auth.role === 'coach' && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mb: 2, px: 2, py: 1, borderRadius: '10px',
          background: viewingCoach === auth.name
            ? 'linear-gradient(135deg, rgba(196,233,191,0.12) 0%, rgba(196,233,191,0.06) 100%)'
            : 'rgba(200,197,255,0.08)',
          border: `1px solid ${viewingCoach === auth.name ? 'rgba(196,233,191,0.25)' : 'rgba(200,197,255,0.2)'}`,
          animation: 'fadeIn 0.2s ease',
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            background: viewingCoach === auth.name ? C.primary : C.purple,
            flexShrink: 0,
          }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: viewingCoach === auth.name ? C.primary : C.purple }}>
            {viewingCoach === auth.name ? t('viewingOwnTracker') : `${t('viewingClient')}: ${client.name}`}
          </Typography>
        </Box>
      )}

      {/* ── Header ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h2">{t('foodTrackerTitle')}</Typography>
          <Typography variant="body2" sx={{ color: C.muted, mt: 0.5 }}>{client.name}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            type="date"
            value={foodDate}
            onChange={e => setFoodDate(e.target.value)}
            sx={{ width: '160px' }}
            size="small"
          />
          {!isTrackerReadOnly && (
            <Button variant="contained" color="primary" onClick={() => setFoodModalOpen(true)}>
              {t('addFoodBtn')}
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Progress rings ─────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 2, mb: 2.5 }}>
        {[
          { labelKey: 'caloriesLbl', pct: kcalPct,  cur: foodTotals.kcal,    tgt: client.calorieTarget, suf: '',          color: C.primary, cn: 'primary' },
          { labelKey: 'proteinLbl',  pct: protPct,  cur: foodTotals.protein, tgt: client.proteinTarget, suf: t('gUnit'), color: C.purple,  cn: 'purple'  },
        ].map(({ labelKey, pct, cur, tgt, suf, color, cn }) => (
          <Box key={labelKey} sx={{
            background:   `linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)`,
            border:       `1px solid var(--c-border)`,
            borderRadius: '18px',
            p:            '22px',
            display:      'flex',
            alignItems:   'center',
            gap:          2.5,
            transition:   `box-shadow 0.25s ${EASE.standard}, transform 0.25s ${EASE.standard}, border-color 0.25s ${EASE.standard}`,
            '&:hover': {
              boxShadow:   `0 0 0 1px var(--c-${cn}A13), 0 8px 28px var(--c-shadow)`,
              borderColor: `var(--c-${cn}A20)`,
              transform:   'translateY(-2px)',
            },
          }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <ProgressRing percent={pct} color={color} size={80} />
              <Box sx={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '13px',
                fontWeight:     800,
                color,
                fontFamily:     "'MontBlanc', sans-serif",
              }}>
                {Math.round(pct)}%
              </Box>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ color: C.muted, display: 'block', mb: 0.5 }}>
                {t(labelKey)}
              </Typography>
              <Typography sx={{
                fontSize:      '28px',
                fontWeight:    800,
                color,
                lineHeight:    1,
                letterSpacing: '-0.5px',
                fontFamily:    "'MontBlanc', sans-serif",
              }}>
                {fmt1(cur)}{suf}
              </Typography>
              <Typography variant="caption" sx={{ color: C.muted, mt: 0.5, display: 'block' }}>
                {t('ofLbl')} {tgt}{suf}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Quick-add chips (own tracker only) ──────── */}
      {!isTrackerReadOnly && (
        <Paper sx={{ p: 2.5, mb: 2.5 }}>
          <Typography variant="overline" sx={{ color: C.muted, display: 'block', mb: 1.5 }}>
            {t('quickAddLbl')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {quickFoods.map(item => (
              <Chip
                key={item.key}
                label={`+ ${item.count !== undefined
                  ? `${item.count} ${foodLabel(foodDB[item.key], lang)}`
                  : `${foodLabel(foodDB[item.key], lang)} ${item.grams}${t('gUnit')}`}`}
                onClick={() => addQuickFood(item.key, item.grams)}
                sx={{
                  background: C.purpleSoft,
                  color:      C.purple,
                  border:     '1px solid rgba(200,197,255,0.18)',
                  '&:hover':  {
                    background: 'rgba(200,197,255,0.2)',
                    borderColor:'rgba(200,197,255,0.3)',
                    boxShadow:  '0 3px 12px rgba(200,197,255,0.15)',
                  },
                  '& .MuiChip-label': { fontWeight: 600 },
                }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* ── Meals list ──────────────────────────────── */}
      <Paper sx={{ p: 2.75 }}>
        <Typography variant="h3" sx={{ mb: 2.5 }}>
          {t('foodForLbl')} {selFoodDate}
        </Typography>

        {mealsForDate.length === 0 ? (
          <Typography variant="body2" sx={{ color: C.muted, py: 1 }}>{t('noFoodToday')}</Typography>
        ) : (
          <>
            {mealsForDate.map((item, i) => (
              <Box
                key={item.id || i}
                sx={{
                  display:             'grid',
                  gridTemplateColumns: isMobile
                    ? (auth.role === 'coach' ? '1fr 56px auto' : '1fr 56px')
                    : (auth.role === 'coach' ? '1fr 72px 100px 104px auto' : '1fr 72px 100px 104px'),
                  gap:          1.5,
                  py:           1.25,
                  borderBottom: `1px solid ${C.border}`,
                  alignItems:   'center',
                  transition:   `background-color 0.12s ${EASE.standard}`,
                  borderRadius: '8px',
                  px:           1,
                  mx:           -1,
                  '&:hover':    { background: 'rgba(255,255,255,0.025)' },
                  animation:    `fadeIn 0.2s ${EASE.standard} both`,
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{lang === 'en' ? (foodDB[item.key]?.labelEn || item.label) : item.label}</Typography>
                <Typography variant="body2" sx={{ color: C.muted }}>{item.grams}{t('gUnit')}</Typography>
                {!isMobile && (
                  <Typography variant="body2" sx={{ color: C.text }}>
                    {item.kcal} kcal
                  </Typography>
                )}
                {!isMobile && (
                  <Typography variant="body2" sx={{ color: C.purple, fontWeight: 600 }}>
                    {item.protein}{t('gUnit')}
                  </Typography>
                )}
                {auth.role === 'coach' && !isTrackerReadOnly && (
                  <Button
                    size="small"
                    onClick={() => deleteMealFromClient(client.id, item.id)}
                    sx={{
                      minWidth:    'auto',
                      background:  C.dangerSoft,
                      color:       C.danger,
                      border:      '1px solid rgba(255,107,157,0.2)',
                      borderRadius:'10px',
                      px:          1.25,
                      py:          '4px',
                      fontSize:    '13px',
                      '&:hover':   {
                        background: 'rgba(255,107,157,0.18)',
                        boxShadow:  '0 3px 10px rgba(255,107,157,0.2)',
                        transform:  'translateY(-1px)',
                      },
                    }}
                  >×</Button>
                )}
              </Box>
            ))}

            {/* Total */}
            <Box sx={{
              mt:         2,
              pt:         1.5,
              borderTop:  `1px solid ${C.border}`,
              display:    'flex',
              gap:        2,
              flexWrap:   'wrap',
              alignItems: 'center',
            }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: C.primary }}>
                {t('totalLbl')}: {foodTotals.kcal} kcal
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: C.purple }}>
                {fmt1(foodTotals.protein)}{t('gUnit')} {t('proteinShortLbl')}
              </Typography>
            </Box>
          </>
        )}
      </Paper>

      {/* ── Daily history ────────────────────────────── */}
      {dailyHistory.length > 0 && (
        <Paper sx={{ p: 2.75, mt: 2.5 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>{t('calHistoryLbl')}</Typography>
          {dailyHistory.map((day, i) => {
            const metKcal = day.kcal <= client.calorieTarget
            const metProt = day.protein >= client.proteinTarget
            const kcalColor = metKcal ? C.primary : C.danger
            return (
              <Box
                key={day.date}
                sx={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  py:             1.1,
                  px:             1,
                  mx:             -1,
                  gap:            1.5,
                  borderBottom:   i < dailyHistory.length - 1 ? `1px solid ${C.border}` : 'none',
                  borderRadius:   '8px',
                  transition:     `background-color 0.12s ${EASE.standard}`,
                  '&:hover':      { background: 'rgba(255,255,255,0.025)' },
                  animation:      `fadeIn 0.18s ${EASE.standard} both`,
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <Typography sx={{ color: C.muted, fontSize: '13px', minWidth: '92px', fontWeight: 500 }}>
                  {day.date}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 700, color: kcalColor }}>
                    {Math.round(day.kcal)}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: C.muted, fontWeight: 500 }}>
                    / {client.calorieTarget} kcal
                  </Typography>
                  <Box sx={{
                    ml:           0.75,
                    px:           0.75,
                    py:           '2px',
                    borderRadius: '6px',
                    fontSize:     '11px',
                    fontWeight:   700,
                    background:   metKcal ? 'rgba(196,233,191,0.12)' : 'rgba(255,107,157,0.1)',
                    color:        kcalColor,
                    border:       `1px solid ${metKcal ? 'rgba(196,233,191,0.2)' : 'rgba(255,107,157,0.2)'}`,
                  }}>
                    {metKcal ? '✓' : '✕'}
                  </Box>
                </Box>

                <Typography sx={{ fontSize: '13px', color: metProt ? C.purple : C.muted, fontWeight: metProt ? 600 : 400, ml: 'auto' }}>
                  {fmt1(day.protein)}{t('gUnit')} {t('proteinShortLbl')}
                </Typography>
              </Box>
            )
          })}
        </Paper>
      )}
    </>
  )
}
