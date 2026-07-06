import { useMemo, useState, useEffect, useRef } from 'react'
import { Box, Typography, TextField, Button, Paper, Collapse } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import StatCard from '../components/StatCard'
import RankingHint from '../components/RankingHint'
import { last30Days, parseDate, inputToDate } from '../lib/utils'

// Water-blue accent — self-contained to this page (theme is green/purple).
const WATER      = '#6EC6E8'
const WATER_SOFT = 'rgba(110,198,232,0.12)'
const QUICK_ADDS = [250, 330, 500]

function last7Days() {
  const arr = [], now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    arr.push(`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`)
  }
  return arr
}

// Circular progress ring (SVG). pct 0..1.
function Ring({ pct, ml, target, t }) {
  const size = 200, stroke = 14, r = (size - stroke) / 2, circ = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  const litres = (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2)
  const done = ml >= target && target > 0
  return (
    <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={WATER} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped)}
          style={{ transition: `stroke-dashoffset 0.5s ${EASE.standard}` }}
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontWeight: 800, fontSize: '34px', fontFamily: "'MontBlanc', sans-serif", letterSpacing: '-0.5px', lineHeight: 1, color: done ? WATER : C.text }}>
          {litres}<span style={{ fontSize: '16px', fontWeight: 600 }}> л</span>
        </Typography>
        <Typography variant="body2" sx={{ color: C.muted, mt: 0.75 }}>
          {ml.toLocaleString()} / {target.toLocaleString()} {t('waterUnit')}
        </Typography>
      </Box>
    </Box>
  )
}

export default function WaterTracker() {
  const {
    auth, client, t,
    waterDate, setWaterDate,
    sortedWaterLogs,
    saveWaterLog, deleteWaterLog, updateWaterTarget,
    showSnackbar,
    isTrackerReadOnly,
  } = useApp()

  const target = client.waterTargetMl || 2500
  const targetDate = inputToDate(waterDate)

  // Saved total from state for the selected date
  const savedMl = useMemo(() => {
    const l = sortedWaterLogs.find(x => x.date === targetDate)
    return l ? l.ml : 0
  }, [sortedWaterLogs, targetDate])

  // Optimistic local total — instant UI + safe accumulation on rapid taps.
  // null = show saved value; a number = user has interacted since last date change.
  const [optimisticMl, setOptimisticMl] = useState(null)
  const displayMl = optimisticMl != null ? optimisticMl : savedMl
  const writeTimer = useRef(null)

  // Reset optimistic when the target date changes
  useEffect(() => { setOptimisticMl(null) }, [targetDate])

  // Debounced write of the absolute daily total (last-write-wins)
  useEffect(() => {
    if (optimisticMl == null) return
    clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(() => {
      saveWaterLog(client.id, targetDate, optimisticMl)
    }, 600)
    return () => clearTimeout(writeTimer.current)
  }, [optimisticMl]) // eslint-disable-line react-hooks/exhaustive-deps

  function addWater(delta) {
    if (isTrackerReadOnly) return
    setOptimisticMl(prev => {
      const base = prev != null ? prev : savedMl
      return Math.max(0, base + delta)
    })
  }

  function resetDay() {
    if (isTrackerReadOnly) return
    clearTimeout(writeTimer.current)
    setOptimisticMl(0)
    saveWaterLog(client.id, targetDate, 0)
  }

  // ── Target editing ────────────────────────────────────────────
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')
  function openTargetEdit() {
    setTargetInput((target / 1000).toString())
    setEditingTarget(true)
  }
  async function saveTarget() {
    const litres = parseFloat(String(targetInput).replace(',', '.'))
    if (!isFinite(litres) || litres <= 0) return
    await updateWaterTarget(client.id, Math.round(litres * 1000))
    setEditingTarget(false)
    showSnackbar(t('waterTargetSaved'))
  }

  // ── Averages ──────────────────────────────────────────────────
  const days7Set  = useMemo(() => new Set(last7Days()),  [])
  const days30Set = useMemo(() => new Set(last30Days()), [])
  const weeklyAvg = useMemo(() => {
    const last7 = sortedWaterLogs.filter(s => days7Set.has(s.date))
    return last7.length ? Math.round(last7.reduce((sum, s) => sum + s.ml, 0) / last7.length) : null
  }, [sortedWaterLogs, days7Set])
  const monthlyAvg = useMemo(() => {
    const last30 = sortedWaterLogs.filter(s => days30Set.has(s.date))
    return last30.length ? Math.round(last30.reduce((sum, s) => sum + s.ml, 0) / last30.length) : null
  }, [sortedWaterLogs, days30Set])

  const pct = target > 0 ? displayMl / target : 0
  const goalReached = displayMl >= target && target > 0

  return (
    <>
      {/* ── Header ─────────────────────────────────── */}
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h2">{t('waterTrackerTitle')}</Typography>
        <Typography variant="body2" sx={{ color: C.muted, mt: 0.5 }}>{client.name}</Typography>
      </Box>

      {!isTrackerReadOnly && <RankingHint />}

      {/* ── Today ring + quick add ──────────────────── */}
      <Paper sx={{ p: 3, mb: 2.5, textAlign: 'center' }}>
        {auth.role !== 'client' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
            <TextField type="date" value={waterDate} onChange={e => setWaterDate(e.target.value)} sx={{ width: '170px' }} />
          </Box>
        )}

        <Ring pct={pct} ml={displayMl} target={target} t={t} />

        {goalReached && (
          <Typography variant="body2" sx={{ color: WATER, mt: 1.5, fontWeight: 600 }}>
            {t('waterGoalReached')}
          </Typography>
        )}

        {!isTrackerReadOnly && (
          <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'center', flexWrap: 'wrap', mt: 2.75 }}>
            {QUICK_ADDS.map(ml => (
              <Button
                key={ml}
                onClick={() => addWater(ml)}
                sx={{
                  minWidth: '84px',
                  background: WATER_SOFT, color: WATER,
                  border: `1px solid rgba(110,198,232,0.3)`,
                  borderRadius: '14px', px: 2, py: 1.1, fontWeight: 700, fontSize: '15px',
                  '&:hover': { background: 'rgba(110,198,232,0.22)' },
                }}
              >
                +{ml}
              </Button>
            ))}
          </Box>
        )}

        {!isTrackerReadOnly && (
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 1.75 }}>
            <Button size="small" onClick={() => addWater(-250)} disabled={displayMl <= 0}
              sx={{ color: C.muted, fontSize: '13px', minWidth: 'auto' }}>
              −250
            </Button>
            <Button size="small" onClick={resetDay} disabled={displayMl <= 0}
              sx={{ color: C.muted, fontSize: '13px', minWidth: 'auto' }}>
              {t('resetDayLbl')}
            </Button>
          </Box>
        )}
      </Paper>

      {/* ── Daily goal (editable) ───────────────────── */}
      {!isTrackerReadOnly && (
        <Paper sx={{ p: 2.5, mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" sx={{ color: C.muted }}>{t('waterTargetLbl')}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '18px', fontFamily: "'MontBlanc', sans-serif" }}>
                {(target / 1000).toString()} л <span style={{ color: C.muted, fontSize: '13px', fontWeight: 500 }}>({target.toLocaleString()} {t('waterUnit')})</span>
              </Typography>
            </Box>
            {!editingTarget && (
              <Button size="small" onClick={openTargetEdit} sx={{ color: WATER, fontSize: '13px' }}>
                {t('changeTargetLbl')}
              </Button>
            )}
          </Box>
          <Collapse in={editingTarget}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
              <TextField
                autoFocus
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveTarget()}
                placeholder={t('waterTargetHint')}
                sx={{ width: '180px' }}
                inputProps={{ inputMode: 'decimal' }}
              />
              <Button variant="contained" color="primary" onClick={saveTarget}>{t('saveLbl')}</Button>
              <Button size="small" onClick={() => setEditingTarget(false)} sx={{ color: C.muted }}>✕</Button>
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* ── Stat cards ──────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2.5 }}>
        <StatCard label={t('weeklyAvgLbl')}  value={weeklyAvg  !== null ? `${weeklyAvg.toLocaleString()} ${t('waterUnit')}`  : '—'} />
        <StatCard label={t('monthlyAvgLbl')} value={monthlyAvg !== null ? `${monthlyAvg.toLocaleString()} ${t('waterUnit')}` : '—'} />
      </Box>

      {/* ── History list ────────────────────────────── */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('waterHistoryLbl')}</Typography>

        {sortedWaterLogs.length === 0 ? (
          <Typography variant="body2" sx={{ color: C.muted, py: 1 }}>{t('noWaterLogs')}</Typography>
        ) : (
          [...sortedWaterLogs].reverse().map((item, i) => {
            const hit = item.ml >= target && target > 0
            return (
              <Box
                key={item.id || i}
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  py: 1.25, px: 1, mx: -1,
                  borderBottom: `1px solid ${C.border}`, borderRadius: '8px',
                  transition: `background-color 0.12s ${EASE.standard}`,
                  '&:hover': { background: 'rgba(255,255,255,0.025)' },
                  animation: `fadeIn 0.2s ${EASE.standard} both`,
                  animationDelay: `${i * 0.03}s`,
                }}
              >
                <Typography variant="body2" sx={{ color: C.muted, fontWeight: 500 }}>{item.date}</Typography>
                <Typography sx={{
                  fontWeight: 700, fontSize: '16px',
                  fontFamily: "'MontBlanc', sans-serif", letterSpacing: '-0.2px',
                  color: hit ? WATER : C.text,
                }}>
                  {item.ml.toLocaleString()} {t('waterUnit')}
                </Typography>
                {!isTrackerReadOnly ? (
                  <Button
                    size="small"
                    onClick={() => deleteWaterLog(client.id, item.id)}
                    sx={{
                      minWidth: 'auto', background: C.dangerSoft, color: C.danger,
                      border: '1px solid rgba(255,107,157,0.2)', borderRadius: '10px',
                      px: 1.25, py: '4px', fontSize: '12px',
                      '&:hover': { background: 'rgba(255,107,157,0.18)' },
                    }}
                  >
                    {t('deleteLbl')}
                  </Button>
                ) : <Box sx={{ width: 8 }} />}
              </Box>
            )
          })
        )}
      </Paper>
    </>
  )
}
