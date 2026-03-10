import { Box, Typography, TextField, Button, Paper } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import StatCard    from '../components/StatCard'
import WeightChart from '../components/WeightChart'
import { fmt1, last30Days } from '../lib/utils'

export default function WeightTracker() {
  const {
    auth, client, t,
    weightInput, setWeightInput,
    weightDate,  setWeightDate,
    saveWeight,
    sortedWeightLogs, weightChartData,
    latestWeight, latestAvg, weeklyRate,
    deleteWeightLog,
  } = useApp()

  const isMobile           = window.innerWidth < 640
  const last30Set          = new Set(last30Days())
  const weightPointsLast30 = (client.weightLogs || []).filter(w => last30Set.has(w.date)).length * 2

  return (
    <>
      {/* ── Header ─────────────────────────────────── */}
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h2">{t('weightTrackerTitle')}</Typography>
        <Typography variant="body2" sx={{ color: C.muted, mt: 0.5 }}>{client.name}</Typography>
      </Box>

      {/* ── Stat cards ──────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 2, mb: 2.5 }}>
        <StatCard label={t('lastWeightLbl')} value={latestWeight !== null ? `${fmt1(latestWeight)} ${t('kgUnit')}` : '—'} />
        <StatCard label={t('sevenDayAvg')}   value={latestAvg    !== null ? `${fmt1(latestAvg)} ${t('kgUnit')}`    : '—'} />
        <StatCard
          label={t('weeklyRateLbl')}
          value={weeklyRate !== null ? `${weeklyRate > 0 ? '+' : ''}${fmt1(weeklyRate)} ${t('kgWeek')}` : '—'}
          accent={weeklyRate !== null && weeklyRate < 0}
        />
      </Box>

      {/* ── Input form ──────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 2.5 }}>
        <Typography variant="h3" sx={{ mb: 2.25 }}>{t('logWeightLbl')}</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            type="date"
            value={weightDate}
            onChange={e => setWeightDate(e.target.value)}
            sx={{ width: '160px' }}
          />
          <TextField
            placeholder={t('weightInKg')}
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveWeight()}
            sx={{ width: '140px' }}
          />
          <Button variant="contained" color="primary" onClick={saveWeight}>
            {t('saveLbl')}
          </Button>
        </Box>
      </Paper>

      {/* ── Chart ───────────────────────────────────── */}
      <Paper sx={{ p: 3, mb: 2.5, overflow: 'hidden' }}>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('chartLbl')}</Typography>
        <WeightChart data={weightChartData} />
      </Paper>

      {/* ── History list ────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h3">{t('historyLbl')}</Typography>
          <Typography variant="caption" sx={{
            color:        C.primary,
            fontWeight:   700,
            background:   C.primaryContainer,
            px:           1.25,
            py:           0.5,
            borderRadius: '99px',
            border:       '1px solid rgba(196,233,191,0.15)',
          }}>
            {weightPointsLast30} {t('ptsper30')}
          </Typography>
        </Box>

        {sortedWeightLogs.length === 0 ? (
          <Typography variant="body2" sx={{ color: C.muted, py: 1 }}>{t('noWeightLogs')}</Typography>
        ) : (
          [...sortedWeightLogs].reverse().map((item, i) => (
            <Box
              key={i}
              sx={{
                display:       'flex',
                justifyContent:'space-between',
                alignItems:    'center',
                py:            1.25,
                px:            1,
                mx:            -1,
                borderBottom:  `1px solid ${C.border}`,
                borderRadius:  '8px',
                transition:    `background-color 0.12s ${EASE.standard}`,
                '&:hover':     { background: 'rgba(255,255,255,0.025)' },
                animation:     `fadeIn 0.2s ${EASE.standard} both`,
                animationDelay:`${i * 0.03}s`,
              }}
            >
              <Typography variant="body2" sx={{ color: C.muted, fontWeight: 500 }}>{item.date}</Typography>
              <Typography sx={{
                fontWeight:    700,
                fontSize:      '16px',
                fontFamily:    "'Space Grotesk', sans-serif",
                letterSpacing: '-0.2px',
              }}>
                {fmt1(item.weight)} {t('kgUnit')}
              </Typography>
              {auth.role === 'coach' && (
                <Button
                  size="small"
                  onClick={() => deleteWeightLog(client.id, item.id)}
                  sx={{
                    minWidth:    'auto',
                    background:  C.dangerSoft,
                    color:       C.danger,
                    border:      '1px solid rgba(255,107,157,0.2)',
                    borderRadius:'10px',
                    px:          1.25,
                    py:          '4px',
                    fontSize:    '12px',
                    '&:hover':   {
                      background: 'rgba(255,107,157,0.18)',
                      boxShadow:  '0 3px 10px rgba(255,107,157,0.2)',
                      transform:  'translateY(-1px)',
                    },
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
