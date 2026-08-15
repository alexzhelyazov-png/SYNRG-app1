import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, TextField,
} from '@mui/material'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'
import { C } from '../theme'

/**
 * Месечен check-in: 3 въпроса, веднъж на календарен месец.
 *
 * Единствената цел е да отсее хората, на които нещо им куца, и да ги покаже в
 * админ секцията „Нужда от внимание“. Нарочно НЯМА статуси, обработване или
 * история — това не е CRM.
 */

const ALL_GOOD = 'Не, всичко е наред'
const OTHER    = 'Друго'

const TOPICS = [
  ALL_GOOD,
  'Тренировките ми',
  'Храненето',
  'Болка / дискомфорт',
  'Мотивация / постоянство',
  'Искам някой от екипа да се свърже с мен',
  OTHER,
]

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// През август 2026 разпратихме голямата анкета. Няма смисъл същите хора да
// отговарят два пъти в един месец, затова check-in-ът тръгва от септември.
const FIRST_MONTH = '2026-09'

/** Оценка 1–5. Същият вид като скалите в анкетата, за да е разпознаваем. */
function Scale({ value, onChange }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.75 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Box key={n} onClick={() => onChange(n)} sx={{
          flex: 1, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '12px', cursor: 'pointer', fontSize: '16px', fontWeight: 800,
          background: value === n ? C.primary : 'rgba(255,255,255,0.03)',
          color:      value === n ? C.primaryOn : C.text,
          border:     `1px solid ${value === n ? C.primary : C.loganBorder}`,
          transition: 'all 0.18s',
          '&:hover':  value === n ? {} : { borderColor: C.logan },
        }}>{n}</Box>
      ))}
    </Box>
  )
}

export default function MonthlyCheckIn() {
  const { auth, lang, showSnackbar } = useApp()
  const [open,     setOpen]     = useState(false)
  const [feeling,  setFeeling]  = useState(null)
  const [progress, setProgress] = useState(null)
  const [topics,   setTopics]   = useState([])
  const [other,    setOther]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const en = lang === 'en'
  const mk = monthKey()
  const clientId = auth?.id

  // Показваме го само ако за този месец още няма запис. Проверката е една
  // заявка и се прави веднъж при зареждане на приложението.
  useEffect(() => {
    let cancelled = false
    if (auth?.role !== 'client' || !clientId) return
    if (mk < FIRST_MONTH) return
    if (sessionStorage.getItem(`synrg_checkin_skip_${mk}`)) return

    ;(async () => {
      try {
        const rows = await DB.selectAll(
          'client_checkins',
          `?select=id&client_id=eq.${clientId}&month_key=eq.${mk}&limit=1`,
        )
        if (!cancelled && (!rows || rows.length === 0)) setOpen(true)
      } catch { /* мълчим: check-in-ът никога не бива да чупи влизането */ }
    })()

    return () => { cancelled = true }
  }, [clientId, auth?.role, mk])

  function toggleTopic(topic) {
    setTopics(prev => {
      // „Всичко е наред“ изключва останалите и обратното — иначе сигналът
      // би бил противоречив.
      if (topic === ALL_GOOD) return prev.includes(ALL_GOOD) ? [] : [ALL_GOOD]
      const next = prev.includes(topic) ? prev.filter(x => x !== topic) : [...prev, topic]
      return next.filter(x => x !== ALL_GOOD)
    })
  }

  function dismiss() {
    // Затварянето важи само за текущата сесия — при следващо влизане пак ще
    // се появи, докато не го попълни.
    sessionStorage.setItem(`synrg_checkin_skip_${mk}`, '1')
    setOpen(false)
  }

  async function save() {
    if (!feeling || !progress || topics.length === 0) return
    setSaving(true)
    try {
      await DB.insert('client_checkins', {
        client_id:   clientId,
        month_key:   mk,
        feeling,
        progress,
        help_topics: topics,
        help_other:  topics.includes(OTHER) && other.trim() ? other.trim() : null,
      })
      sessionStorage.setItem(`synrg_checkin_skip_${mk}`, '1')
      setOpen(false)
      showSnackbar(en ? 'Thanks — noted!' : 'Благодарим ти!')
    } catch (e) {
      // Дубликат = вече е попълнен от друго устройство; не е грешка за клиента.
      if (String(e?.message || '').includes('duplicate')) {
        sessionStorage.setItem(`synrg_checkin_skip_${mk}`, '1')
        setOpen(false)
      } else {
        showSnackbar(en ? 'Could not save, try again' : 'Не се записа, опитай пак')
      }
    }
    setSaving(false)
  }

  if (!open) return null

  const ready = feeling && progress && topics.length > 0

  return (
    <Dialog open onClose={dismiss} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800, color: C.text, fontSize: '19px', pb: 0.5 }}>
        {en ? 'How are things this month?' : 'Как вървят нещата този месец?'}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '4px !important' }}>
        <Typography sx={{ color: C.muted, fontSize: '13px', lineHeight: 1.5 }}>
          {en
            ? 'Takes about 20 seconds and helps us make sure everything is on track.'
            : 'Отнема около 20 секунди и ни помага да сме сигурни, че всичко върви добре.'}
        </Typography>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, mb: 1.25 }}>
            {/* Не „как се чувстваш С тренировките“ — това се чете като „как се
                чувстваш ОТ тях“ и умореният човек дава 3, без да е недоволен. */}
            {en ? 'How satisfied are you with your training right now?' : 'Колко си доволен/а от тренировките си в момента?'}
          </Typography>
          <Scale value={feeling} onChange={setFeeling} />
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, mb: 1.25 }}>
            {en
              ? 'Do you feel you are making progress towards what you came to us for?'
              : 'Усещаш ли, че постигаш прогрес спрямо това, за което идваш при нас?'}
          </Typography>
          <Scale value={progress} onChange={setProgress} />
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, mb: 1.25 }}>
            {en ? 'Is there anything you want help with right now?' : 'Има ли нещо, с което искаш да ти помогнем в момента?'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {TOPICS.map(topic => {
              const on = topics.includes(topic)
              return (
                <Box key={topic} onClick={() => toggleTopic(topic)} sx={{
                  px: 1.75, py: 1.25, borderRadius: '12px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: on ? 700 : 400,
                  background: on ? 'rgba(196,233,191,0.10)' : 'rgba(255,255,255,0.03)',
                  color:      on ? C.primary : C.text,
                  border:     `1px solid ${on ? C.primary : C.loganBorder}`,
                  transition: 'all 0.18s',
                  '&:hover':  on ? {} : { borderColor: C.logan },
                }}>{topic}</Box>
              )
            })}
          </Box>

          {topics.includes(OTHER) && (
            <TextField
              fullWidth multiline minRows={2} size="small" sx={{ mt: 1.25 }}
              placeholder={en ? 'Tell us more…' : 'Разкажи ни…'}
              value={other} onChange={e => setOther(e.target.value)}
              inputProps={{ maxLength: 1000 }}
              InputProps={{ sx: { color: C.text, fontSize: '14px' } }}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={dismiss} sx={{ color: C.muted, textTransform: 'none' }}>
          {en ? 'Later' : 'По-късно'}
        </Button>
        <Button onClick={save} disabled={!ready || saving} variant="contained"
          sx={{ background: C.primary, color: C.primaryOn, fontWeight: 700,
                borderRadius: '100px', px: 3, textTransform: 'none' }}>
          {en ? 'Send' : 'Изпрати'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
