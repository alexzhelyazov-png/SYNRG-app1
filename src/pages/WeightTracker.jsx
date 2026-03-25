import { Box, Typography, TextField, Button, Paper } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import WeightChart from '../components/WeightChart'
import { fmt1 } from '../lib/utils'

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
                  size="small" fullWidth sx={{ mb: 1 }} />
              )}
              <TextField placeholder={t('weightInKg')} value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveWeight()}
                size="small" fullWidth sx={{ mb: 1 }} />
              <Button variant="contained" color="primary" size="small" fullWidth onClick={saveWeight}>
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
