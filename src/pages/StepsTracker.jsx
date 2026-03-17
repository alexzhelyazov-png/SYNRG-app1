import { useMemo } from 'react'
import { Box, Typography, TextField, Button, Paper } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import StatCard from '../components/StatCard'
import { last30Days, parseDate } from '../lib/utils'

function last7Days() {
  const arr = [], now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    arr.push(`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`)
  }
  return arr
}

export default function StepsTracker() {
  const {
    auth, client, t,
    stepsInput, setStepsInput,
    stepsDate, setStepsDate,
    saveSteps,
    sortedStepsLogs,
    deleteStepsLog,
    isTrackerReadOnly,
  } = useApp()

  const isMobile = window.innerWidth < 640

  // ── Averages ──────────────────────────────────────────────────
  const days7Set  = useMemo(() => new Set(last7Days()),  [])
  const days30Set = useMemo(() => new Set(last30Days()), [])

  const weeklyAvg = useMemo(() => {
    const last7 = sortedStepsLogs.filter(s => days7Set.has(s.date))
    return last7.length ? Math.round(last7.reduce((sum, s) => sum + s.steps, 0) / last7.length) : null
  }, [sortedStepsLogs, days7Set])

  const monthlyAvg = useMemo(() => {
    const last30 = sortedStepsLogs.filter(s => days30Set.has(s.date))
    return last30.length ? Math.round(last30.reduce((sum, s) => sum + s.steps, 0) / last30.length) : null
  }, [sortedStepsLogs, days30Set])

  return (
    <>
      {/* ── Header ─────────────────────────────────── */}
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h2">{t('stepsTrackerTitle')}</Typography>
        <Typography variant="body2" sx={{ color: C.muted, mt: 0.5 }}>{client.name}</Typography>
      </Box>

      {/* ── Input form ──────────────────────────────── */}
      {!isTrackerReadOnly && (
        <Paper sx={{ p: 3, mb: 2.5 }}>
          <Typography variant="h3" sx={{ mb: 2.25 }}>{t('logStepsLbl')}</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              type="date"
              value={stepsDate}
              onChange={e => setStepsDate(e.target.value)}
              sx={{ width: '160px' }}
            />
            <TextField
              placeholder={t('stepsPlaceholder')}
              value={stepsInput}
              onChange={e => setStepsInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveSteps()}
              sx={{ width: '160px' }}
              inputProps={{ inputMode: 'numeric' }}
            />
            <Button variant="contained" color="primary" onClick={saveSteps}>
              {t('saveLbl')}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── Stat cards ──────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
        <StatCard
          label={t('weeklyAvgLbl')}
          value={weeklyAvg !== null ? `${weeklyAvg.toLocaleString()}` : '—'}
        />
        <StatCard
          label={t('monthlyAvgLbl')}
          value={monthlyAvg !== null ? `${monthlyAvg.toLocaleString()}` : '—'}
        />
      </Box>

      {/* ── History list ────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('historyLbl')}</Typography>

        {sortedStepsLogs.length === 0 ? (
          <Typography variant="body2" sx={{ color: C.muted, py: 1 }}>{t('noStepsLogs')}</Typography>
        ) : (
          [...sortedStepsLogs].reverse().map((item, i) => (
            <Box
              key={item.id || i}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1.25, px: 1, mx: -1,
                borderBottom: `1px solid ${C.border}`,
                borderRadius: '8px',
                transition: `background-color 0.12s ${EASE.standard}`,
                '&:hover': { background: 'rgba(255,255,255,0.025)' },
                animation: `fadeIn 0.2s ${EASE.standard} both`,
                animationDelay: `${i * 0.03}s`,
              }}
            >
              <Typography variant="body2" sx={{ color: C.muted, fontWeight: 500 }}>{item.date}</Typography>
              <Typography sx={{
                fontWeight: 700,
                fontSize: '16px',
                fontFamily: "'MontBlanc', sans-serif",
                letterSpacing: '-0.2px',
              }}>
                {item.steps.toLocaleString()} {t('stepsUnit')}
              </Typography>
              {auth.role === 'coach' && !isTrackerReadOnly && (
                <Button
                  size="small"
                  onClick={() => deleteStepsLog(client.id, item.id)}
                  sx={{
                    minWidth: 'auto',
                    background: C.dangerSoft, color: C.danger,
                    border: '1px solid rgba(255,107,157,0.2)',
                    borderRadius: '10px', px: 1.25, py: '4px', fontSize: '12px',
                    '&:hover': { background: 'rgba(255,107,157,0.18)' },
                  }}
                >
                  {t('deleteLbl')}
                </Button>
              )}
            </Box>
          ))
        )}
      </Paper>
    </>
  )
}
