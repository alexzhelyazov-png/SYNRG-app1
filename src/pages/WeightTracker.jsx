import { Box, Typography, TextField, Button, Paper } from '@mui/material'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon   from '@mui/icons-material/TrendingUp'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import WeightChart from '../components/WeightChart'
import { fmt1 } from '../lib/utils'

// ── Linear regression forecast ────────────────────────────────
// Fits a line to the last N weight points and projects forward.
// Returns null if too few points, else { slopePerDay, projection28d, projection56d }.
function computeForecast(weightChartData) {
  if (!weightChartData || weightChartData.length < 4) return null
  // Use last 14 points (or all if fewer)
  const pts = weightChartData.slice(-14)
  // x = days since first point in window, y = weight
  const t0 = new Date(pts[0].date).getTime()
  const xs = pts.map(p => (new Date(p.date).getTime() - t0) / 86400000)
  const ys = pts.map(p => Number(p.weight))
  const n = pts.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  const lastDay = xs[xs.length - 1]
  const project = (daysAhead) => intercept + slope * (lastDay + daysAhead)
  return {
    slopePerWeek: slope * 7,
    projection28d: project(28),
    projection56d: project(56),
    currentAvg: pts[pts.length - 1].avg,
  }
}

export default function WeightTracker() {
  const {
    auth, client, t, lang,
    viewingCoach,
    weightInput, setWeightInput,
    weightDate,  setWeightDate,
    saveWeight,
    sortedWeightLogs, weightChartData,
    deleteWeightLog,
    isTrackerReadOnly,
  } = useApp()

  // Compute weight target from quiz answers if available (BMI 22 ≈ healthy middle)
  const heightCm = Number(client?.synrgQuiz?.height) || 0
  const weightTarget = heightCm > 0 ? Math.round(22 * (heightCm / 100) ** 2) : null
  const forecast = computeForecast(weightChartData)

  // Build history rows with weekly rate per row
  const historyRows = [...weightChartData].reverse().map((row, i, arr) => {
    // Weekly rate: compare this row's avg with the avg ~7 entries back
    const origIdx = weightChartData.length - 1 - i
    const prevIdx = origIdx - 7
    let rate = null
    if (prevIdx >= 0) {
      rate = row.avg - weightChartData[prevIdx].avg
    }
    return { ...row, rate, origIdx }
  })

  return (
    <>
      {/* ── Viewing banner (coaches only) ───────────── */}
      {auth.role === 'coach' && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mb: 2, px: 2, py: 1, borderRadius: '10px',
          background: viewingCoach === auth.name
            ? 'linear-gradient(135deg, rgba(170,169,205,0.12) 0%, rgba(170,169,205,0.06) 100%)'
            : 'rgba(200,197,255,0.08)',
          border: `1px solid ${viewingCoach === auth.name ? 'rgba(170,169,205,0.25)' : 'rgba(200,197,255,0.2)'}`,
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: viewingCoach === auth.name ? C.primary : C.purple, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>
            {viewingCoach === auth.name ? t('viewingOwnTracker') : `${t('viewingClient')}: ${client.name}`}
          </Typography>
        </Box>
      )}

      {/* ── 1. Input + Chart side by side ─────────── */}
      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left: input */}
          {!isTrackerReadOnly && (
            <Box sx={{ flex: '1 1 200px', minWidth: 180 }}>
              <Typography variant="h3" sx={{ mb: 1.5 }}>{t('logWeightLbl')}</Typography>
              {auth.role !== 'client' && (
                <TextField type="date" value={weightDate} onChange={e => setWeightDate(e.target.value)}
                  size="small" sx={{ width: '150px', mb: 1, display: 'block' }} />
              )}
              <TextField placeholder={t('weightInKg')} value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveWeight()}
                size="small" sx={{ width: '150px', mb: 1, display: 'block' }} />
              <Button variant="contained" color="primary" size="small" onClick={saveWeight}>
                {t('saveLbl')}
              </Button>
            </Box>
          )}
          {/* Right: chart */}
          {weightChartData.length >= 2 && (
            <Box sx={{ flex: '2 1 250px', minWidth: 200, overflow: 'hidden' }}>
              <WeightChart data={weightChartData} />
            </Box>
          )}
        </Box>
      </Paper>

      {/* ── 2. Forecast card ───────────────────────── */}
      {forecast && (
        <Paper sx={{
          p: 2.5, mb: 2,
          background: 'linear-gradient(135deg, rgba(170,169,205,0.06) 0%, rgba(143,191,144,0.04) 100%)',
          border: `1px solid rgba(170,169,205,0.18)`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            {forecast.slopePerWeek < -0.05
              ? <TrendingDownIcon sx={{ fontSize: 18, color: C.primary }} />
              : forecast.slopePerWeek > 0.05
              ? <TrendingUpIcon sx={{ fontSize: 18, color: '#FB923C' }} />
              : <TrendingFlatIcon sx={{ fontSize: 18, color: C.muted }} />}
            <Typography variant="overline" sx={{ color: C.muted, letterSpacing: 1.4 }}>
              прогноза на база реалния ти темп
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {/* Current trend */}
            <Box>
              <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>
                темп
              </Typography>
              <Typography sx={{
                fontSize: '20px', fontWeight: 800, fontFamily: "'MontBlanc', sans-serif",
                color: forecast.slopePerWeek < -0.05 ? C.primary : forecast.slopePerWeek > 0.05 ? '#FB923C' : C.text,
                lineHeight: 1.1,
              }}>
                {forecast.slopePerWeek > 0 ? '+' : ''}{fmt1(forecast.slopePerWeek)} кг/седм.
              </Typography>
            </Box>

            {/* 4-week projection */}
            <Box>
              <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>
                след 4 седмици
              </Typography>
              <Typography sx={{
                fontSize: '20px', fontWeight: 800, fontFamily: "'MontBlanc', sans-serif",
                color: C.text, lineHeight: 1.1,
              }}>
                ~{fmt1(forecast.projection28d)} кг
              </Typography>
            </Box>

            {/* 8-week projection or distance to target */}
            {weightTarget ? (
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>
                  здравословна цел (BMI 22)
                </Typography>
                <Typography sx={{
                  fontSize: '20px', fontWeight: 800, fontFamily: "'MontBlanc', sans-serif",
                  color: C.purple, lineHeight: 1.1,
                }}>
                  {weightTarget} кг
                </Typography>
                <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.25 }}>
                  {forecast.currentAvg > weightTarget
                    ? `остават ${fmt1(forecast.currentAvg - weightTarget)} кг`
                    : forecast.currentAvg < weightTarget
                    ? `${fmt1(weightTarget - forecast.currentAvg)} кг под целта`
                    : 'на целта'}
                </Typography>
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>
                  след 8 седмици
                </Typography>
                <Typography sx={{
                  fontSize: '20px', fontWeight: 800, fontFamily: "'MontBlanc', sans-serif",
                  color: C.text, lineHeight: 1.1,
                }}>
                  ~{fmt1(forecast.projection56d)} кг
                </Typography>
              </Box>
            )}
          </Box>

          <Typography sx={{ fontSize: '11px', color: C.muted, mt: 1.25, lineHeight: 1.45 }}>
            {Math.abs(forecast.slopePerWeek) < 0.05
              ? 'теглото е стабилно. ако целта ти е промяна, обмисли корекция в калориите или активността.'
              : forecast.slopePerWeek < -0.5
              ? 'темпото е по-бързо от безопасното (0.3–0.5 кг/седм.). увеличи приема ако се чувстваш изтощен/а.'
              : forecast.slopePerWeek < 0
              ? 'устойчив темп на отслабване. слой по слой — без насилване.'
              : forecast.slopePerWeek > 0.3
              ? 'теглото расте. провери калориите и стъпките или обсъди с ментора.'
              : 'леко покачване — нормално при цикъл, стрес или повече въглехидрати.'}
          </Typography>

          {weightChartData.length < 7 && (
            <Typography sx={{ fontSize: '10px', color: C.muted, mt: 0.5, fontStyle: 'italic' }}>
              прогнозата става по-точна при поне 7 записа.
            </Typography>
          )}
        </Paper>
      )}

      {/* ── 3. History table ───────────────────────── */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h3" sx={{ mb: 1.5 }}>{t('historyLbl')}</Typography>

        {historyRows.length === 0 ? (
          <Typography variant="body2" sx={{ color: C.muted, py: 1 }}>{t('noWeightLogs')}</Typography>
        ) : (
          <>
            {/* Header row */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px auto',
              gap: 1, pb: 1, borderBottom: `2px solid ${C.border}`,
            }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>{lang === 'bg' ? 'Дата' : 'Date'}</Typography>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', textAlign: 'right' }}>{t('kgUnit')}</Typography>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', textAlign: 'right' }}>MA</Typography>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', textAlign: 'right' }}>{lang === 'bg' ? '/сед' : '/wk'}</Typography>
              <Box />
            </Box>

            {/* Data rows */}
            {historyRows.map((row, i) => {
              const isLast = i === 0 // first in reversed = most recent
              return (
                <Box key={row.date + i} sx={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px auto',
                  gap: 1, py: 0.75, alignItems: 'center',
                  borderBottom: `1px solid ${C.border}`,
                  '&:last-child': { borderBottom: 'none' },
                  animation: `fadeIn 0.15s ${EASE.standard} both`,
                  animationDelay: `${i * 0.02}s`,
                }}>
                  {/* Date */}
                  <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>{row.date}</Typography>

                  {/* Recorded weight */}
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text, textAlign: 'right', fontFamily: "'MontBlanc', sans-serif" }}>
                    {fmt1(row.weight)}
                  </Typography>

                  {/* Moving average */}
                  <Typography sx={{ fontSize: '12px', fontWeight: 600, color: C.purple, textAlign: 'right' }}>
                    {fmt1(row.avg)}
                  </Typography>

                  {/* Weekly rate */}
                  <Typography sx={{
                    fontSize: '12px', fontWeight: 700, textAlign: 'right',
                    color: row.rate === null ? C.muted : row.rate < 0 ? C.primary : row.rate > 0 ? '#FB923C' : C.muted,
                  }}>
                    {row.rate !== null ? `${row.rate > 0 ? '+' : ''}${fmt1(row.rate)}` : '—'}
                  </Typography>

                  {/* Delete — only last entry */}
                  <Box sx={{ textAlign: 'right', minWidth: 20 }}>
                    {!isTrackerReadOnly && isLast && (
                      <Typography
                        onClick={() => deleteWeightLog(client.id, sortedWeightLogs[sortedWeightLogs.length - 1]?.id)}
                        sx={{ fontSize: '13px', color: 'rgba(255,107,157,0.4)', cursor: 'pointer', '&:hover': { color: C.danger } }}
                      >x</Typography>
                    )}
                  </Box>
                </Box>
              )
            })}
          </>
        )}
      </Paper>
    </>
  )
}
