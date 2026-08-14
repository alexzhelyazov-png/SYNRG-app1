import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'
import { C } from '../theme'

/**
 * „Нужда от внимание“ — само клиентите, чийто месечен check-in е вдигнал флаг.
 *
 * Списъкът е нарочно плосък: име, дата, причина. Без статуси, без „обработено“,
 * без кой се е погрижил. Идеята е Studio Manager-ът да отвори, да види кой има
 * нужда от проверка, и да затвори — не да поддържа втора система.
 */

const ALL_GOOD = 'Не, всичко е наред'

/** Едно изречение, което казва защо човекът е в списъка. */
function reasonFor(row) {
  const topics = (row.help_topics || []).filter(t => t !== ALL_GOOD)
  if (topics.length) return topics.join(' · ')
  if (row.progress <= 3 && row.feeling <= 3) return 'Ниски оценки за тренировки и прогрес'
  if (row.progress <= 3) return 'Ниска оценка за прогрес'
  if (row.feeling <= 3)  return 'Ниска оценка за тренировките'
  return 'Сигнал от check-in'
}

function fmtDate(iso) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

/** Оценка като „4/5“, оцветена когато е ниска — окото да я хване веднага. */
function Score({ value }) {
  const low = value <= 3
  return (
    <Typography component="span" sx={{ fontWeight: 800, color: low ? '#FB923C' : C.primary }}>
      {value}/5
    </Typography>
  )
}

export default function AdminAttentionTab() {
  const { realClients, lang } = useApp()
  const [rows,   setRows]   = useState([])
  const [loaded, setLoaded] = useState(false)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const data = await DB.selectAll(
          'client_checkins',
          '?select=*&needs_attention=eq.true&order=created_at.desc',
        )
        setRows(data || [])
      } catch { setRows([]) }
      setLoaded(true)
    })()
  }, [])

  const nameOf = id => realClients.find(c => c.id === id)?.name
    || (lang === 'en' ? 'Unknown client' : 'Непознат клиент')

  if (!loaded) {
    return <Typography sx={{ color: C.muted, fontSize: '13px' }}>
      {lang === 'en' ? 'Loading…' : 'Зареждане…'}
    </Typography>
  }

  return (
    <Box>
      <Typography sx={{ color: C.muted, fontSize: '13px', mb: 1.5 }}>
        {rows.length === 0
          ? (lang === 'en'
              ? 'Nobody needs attention right now.'
              : 'В момента никой няма нужда от внимание.')
          : (lang === 'en'
              ? `${rows.length} client(s) flagged by their monthly check-in.`
              : `${rows.length} клиенти със сигнал от месечния check-in.`)}
      </Typography>

      {rows.length > 0 && (
        <Paper sx={{ borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {rows.map(r => (
            <Box key={r.id} onClick={() => setDetail(r)} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, px: 1.75,
              borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' },
              cursor: 'pointer', transition: 'background 0.15s',
              '&:hover': { background: 'rgba(255,255,255,0.02)' },
            }}>
              <Typography sx={{
                fontWeight: 700, fontSize: '13px', color: C.text,
                flex: 1, minWidth: 0, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {nameOf(r.client_id)}
              </Typography>

              <Typography sx={{ fontSize: '12px', color: C.muted, flexShrink: 0 }}>
                {fmtDate(r.created_at)}
              </Typography>

              <Typography sx={{
                fontSize: '12px', fontWeight: 700, color: C.purple,
                flexShrink: 0, maxWidth: '46%', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {reasonFor(r)}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
        {detail && (
          <>
            <DialogTitle sx={{ fontWeight: 800, color: C.text, pb: 0.5 }}>
              {nameOf(detail.client_id)}
              <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 400, mt: 0.25 }}>
                {fmtDate(detail.created_at)}
              </Typography>
            </DialogTitle>

            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, pt: '4px !important' }}>
              <Typography sx={{ fontSize: '14px', color: C.text }}>
                {lang === 'en' ? 'Feels about training: ' : 'Как се чувства с тренировките: '}
                <Score value={detail.feeling} />
              </Typography>

              <Typography sx={{ fontSize: '14px', color: C.text }}>
                {lang === 'en' ? 'Sense of progress: ' : 'Усещане за прогрес: '}
                <Score value={detail.progress} />
              </Typography>

              <Box>
                <Typography sx={{ fontSize: '12px', color: C.muted, mb: 0.75 }}>
                  {lang === 'en' ? 'Wants help with' : 'С какво иска помощ'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {(detail.help_topics || []).map(topic => (
                    <Box key={topic} sx={{
                      px: 1.25, py: 0.5, borderRadius: '100px', fontSize: '12px', fontWeight: 700,
                      background: topic === ALL_GOOD ? 'rgba(255,255,255,0.05)' : 'rgba(196,233,191,0.12)',
                      color:      topic === ALL_GOOD ? C.muted : C.primary,
                      border: `1px solid ${topic === ALL_GOOD ? C.border : C.primary}`,
                    }}>{topic}</Box>
                  ))}
                </Box>
              </Box>

              {detail.help_other && (
                <Box sx={{
                  p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${C.border}`,
                }}>
                  <Typography sx={{ fontSize: '12px', color: C.muted, mb: 0.5 }}>
                    {lang === 'en' ? 'In their words' : 'Със свои думи'}
                  </Typography>
                  <Typography sx={{ fontSize: '14px', color: C.text, lineHeight: 1.55 }}>
                    {detail.help_other}
                  </Typography>
                </Box>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => setDetail(null)} variant="contained"
                sx={{ background: C.primary, color: C.primaryOn, fontWeight: 700,
                      borderRadius: '100px', px: 3, textTransform: 'none' }}>
                {lang === 'en' ? 'Close' : 'Затвори'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  )
}
