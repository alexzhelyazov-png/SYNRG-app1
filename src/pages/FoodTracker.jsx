import { Box, Typography, TextField, Button, Chip, Paper } from '@mui/material'
import { useApp } from '../context/AppContext'
import { quickFoods, foodDB, foodLabel } from '../lib/constants'
import { C, EASE } from '../theme'
import ProgressRing from '../components/ProgressRing'
import FoodModal    from '../components/FoodModal'
import { fmt1 } from '../lib/utils'

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
            ? 'linear-gradient(135deg, rgba(170,169,205,0.12) 0%, rgba(170,169,205,0.06) 100%)'
            : 'rgba(200,197,255,0.08)',
          border: `1px solid ${viewingCoach === auth.name ? 'rgba(170,169,205,0.25)' : 'rgba(200,197,255,0.2)'}`,
          animation: 'fadeIn 0.2s ease',
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            background: viewingCoach === auth.name ? C.primary : C.purple,
            flexShrink: 0,
          }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>
            {viewingCoach === auth.name ? t('viewingOwnTracker') : `${t('viewingClient')}: ${client.name}`}
          </Typography>
        </Box>
      )}

      {/* ── + Добави храна ─────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2">{t('foodTrackerTitle')}</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {auth.role !== 'client' && (
            <TextField
              type="date"
              value={foodDate}
              onChange={e => setFoodDate(e.target.value)}
              sx={{ width: '140px' }}
              size="small"
            />
          )}
          {!isTrackerReadOnly && (
            <Button variant="contained" color="primary" size="small" onClick={() => setFoodModalOpen(true)}
              sx={{ py: '8px', px: 2, fontSize: '13px', fontWeight: 700 }}>
              {t('addFoodBtn')}
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Compact progress row: Calories | Protein ── */}
      <Paper sx={{
        display: 'flex', alignItems: 'center', gap: 2,
        p: '12px 16px', mb: 2, borderRadius: '14px',
        border: `1px solid ${C.border}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <ProgressRing percent={kcalPct} color={C.primary} size={40} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: C.text, fontFamily: "'MontBlanc', sans-serif" }}>
              {Math.round(kcalPct)}%
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '15px', fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: "'MontBlanc', sans-serif" }}>
              {fmt1(foodTotals.kcal)}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: C.muted }}>/ {client.calorieTarget} kcal</Typography>
          </Box>
        </Box>

        <Box sx={{ width: '1px', height: 28, background: C.border, flexShrink: 0 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <ProgressRing percent={protPct} color={C.purple} size={40} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: C.purple, fontFamily: "'MontBlanc', sans-serif" }}>
              {Math.round(protPct)}%
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '15px', fontWeight: 800, color: C.purple, lineHeight: 1, fontFamily: "'MontBlanc', sans-serif" }}>
              {fmt1(foodTotals.protein)}{t('gUnit')}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: C.muted }}>/ {client.proteinTarget}{t('gUnit')} {t('proteinShortLbl')}</Typography>
          </Box>
        </Box>
      </Paper>

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

      {/* ── Храна за деня ──────────────────────────── */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1.5 }}>
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
                {!isTrackerReadOnly && (
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
              <Typography variant="body2" sx={{ fontWeight: 700, color: C.text }}>
                {t('totalLbl')}: {foodTotals.kcal} kcal
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: C.purple }}>
                {fmt1(foodTotals.protein)}{t('gUnit')} {t('proteinShortLbl')}
              </Typography>
            </Box>
          </>
        )}
      </Paper>

    </>
  )
}
