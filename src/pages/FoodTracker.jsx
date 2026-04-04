import { Box, Typography, TextField, Button, Chip, Paper, IconButton, Tooltip } from '@mui/material'
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'
import WarningAmberIcon   from '@mui/icons-material/WarningAmber'
import { useApp } from '../context/AppContext'
import { quickFoods, foodDB, foodLabel } from '../lib/constants'
import { C, EASE } from '../theme'
import ProgressRing from '../components/ProgressRing'
import FoodModal    from '../components/FoodModal'
import { fmt1, todayDate, dateToInput } from '../lib/utils'

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

      {/* ── Header ─────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h2">{t('foodTrackerTitle')}</Typography>
        {auth.role !== 'client' && (
          <TextField
            type="date"
            value={foodDate}
            onChange={e => setFoodDate(e.target.value)}
            sx={{ width: '140px' }}
            size="small"
          />
        )}
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

      {/* ── + Добави храна button ──────────────────── */}
      {!isTrackerReadOnly && (
        <Button variant="contained" color="primary" fullWidth onClick={() => setFoodModalOpen(true)}
          sx={{ py: 1.5, mb: 2, fontSize: '14px', fontWeight: 700, borderRadius: '12px' }}>
          {t('addFoodBtn')}
        </Button>
      )}

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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1.5 }}>
          <IconButton size="small" onClick={() => {
            const [y, m, d] = foodDate.split('-').map(Number)
            const prev = new Date(y, m - 1, d - 1)
            setFoodDate(`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`)
          }} sx={{ color: C.muted }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h3" sx={{ minWidth: 160, textAlign: 'center' }}>
            {t('foodForLbl')} {selFoodDate}
          </Typography>
          <IconButton size="small" onClick={() => {
            const [y, m, d] = foodDate.split('-').map(Number)
            const next = new Date(y, m - 1, d + 1)
            setFoodDate(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`)
          }} disabled={foodDate >= `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`} sx={{ color: C.muted }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

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
                    ? `1fr 56px${!isTrackerReadOnly ? ' auto' : ''}`
                    : `1fr 72px 100px 104px${!isTrackerReadOnly ? ' auto' : ''}`,
                  gap:          1.5,
                  py:           1.25,
                  borderBottom: `1px solid ${C.border}`,
                  alignItems:   'center',
                  transition:   `background-color 0.12s ${EASE.standard}`,
                  borderRadius: '8px',
                  px:           1,
                  mx:           -1,
                  background:   item._failed ? 'rgba(255,100,80,0.08)' : undefined,
                  outline:      item._failed ? '1px solid rgba(255,100,80,0.3)' : undefined,
                  '&:hover':    { background: item._failed ? 'rgba(255,100,80,0.12)' : 'rgba(255,255,255,0.025)' },
                  animation:    `fadeIn 0.2s ${EASE.standard} both`,
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {item._failed && (
                    <Tooltip title="Не е запазено — провери интернет" placement="top">
                      <WarningAmberIcon sx={{ fontSize: 15, color: 'rgba(255,160,60,0.85)', flexShrink: 0 }} />
                    </Tooltip>
                  )}
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', color: item._failed ? 'rgba(255,180,120,0.9)' : undefined }}>
                    {lang === 'en' ? (foodDB[item.key]?.labelEn || item.label) : item.label}
                  </Typography>
                </Box>
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
                  <Typography
                    onClick={() => deleteMealFromClient(client.id, item.id)}
                    sx={{
                      fontSize: '14px', color: 'rgba(255,107,157,0.4)', cursor: 'pointer',
                      lineHeight: 1, userSelect: 'none', textAlign: 'center',
                      '&:hover': { color: C.danger },
                    }}
                  >x</Typography>
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
              <Typography variant="body2" sx={{ fontWeight: 700, color: C.primary }}>
                {fmt1(foodTotals.protein)}{t('gUnit')} Б
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#FFD070' }}>
                {fmt1(foodTotals.carbs)}{t('gUnit')} В
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: C.purple }}>
                {fmt1(foodTotals.fat)}{t('gUnit')} М
              </Typography>
            </Box>
          </>
        )}
      </Paper>

    </>
  )
}
