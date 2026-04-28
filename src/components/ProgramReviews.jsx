// Program Reviews — display approved reviews + submit form for verified buyers
//
// Used inside Programs.jsx for SYNRG Метод detail view.
// Verified buyer = client with row in program_purchases for this program.

import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, TextField, IconButton, CircularProgress } from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function StarRow({ value, onChange = null, size = 20 }) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
      {stars.map(n => {
        const filled = n <= value
        const Icon = filled ? StarIcon : StarBorderIcon
        const props = onChange
          ? { onClick: () => onChange(n), sx: { cursor: 'pointer', color: filled ? '#FFC107' : C.muted, fontSize: size, p: 0.25 } }
          : { sx: { color: filled ? '#FFC107' : C.muted, fontSize: size } }
        return onChange
          ? <IconButton key={n} size="small" onClick={() => onChange(n)} sx={{ p: 0.25 }}><Icon {...props} /></IconButton>
          : <Icon key={n} {...props} />
      })}
    </Box>
  )
}

function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000))
  if (days === 0) return 'днес'
  if (days === 1) return 'вчера'
  if (days < 7) return `преди ${days} дни`
  if (days < 30) return `преди ${Math.floor(days / 7)} седмици`
  return `преди ${Math.floor(days / 30)} месеца`
}

export default function ProgramReviews({ programId }) {
  const { auth, showSnackbar } = useApp()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasPurchase, setHasPurchase] = useState(false)
  const [myReview, setMyReview] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!programId) return
    let cancelled = false
    Promise.all([
      // Approved reviews
      fetch(`${SUPABASE_URL}/rest/v1/program_reviews?select=id,rating,text,client_name,created_at,status&program_id=eq.${programId}&status=eq.approved&order=created_at.desc&limit=50`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.ok ? r.json() : []),
      // My purchase + my review
      auth?.id ? fetch(`${SUPABASE_URL}/rest/v1/program_purchases?select=id&client_id=eq.${auth.id}&program_id=eq.${programId}&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
      auth?.id ? fetch(`${SUPABASE_URL}/rest/v1/program_reviews?select=id,rating,text,status&client_id=eq.${auth.id}&program_id=eq.${programId}&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.ok ? r.json() : []) : Promise.resolve([]),
    ]).then(([approved, purchases, myReviews]) => {
      if (cancelled) return
      setReviews(Array.isArray(approved) ? approved : [])
      setHasPurchase(Array.isArray(purchases) && purchases.length > 0)
      const mine = Array.isArray(myReviews) && myReviews.length > 0 ? myReviews[0] : null
      setMyReview(mine)
      if (mine) { setRating(mine.rating); setText(mine.text || '') }
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [programId, auth?.id])

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  const submitReview = async () => {
    if (!auth?.id || !programId || rating < 1) return
    setSubmitting(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-review`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: auth.id, program_id: programId, rating, text }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        showSnackbar(data.message || data.error || 'Грешка при изпращане', 'error')
        setSubmitting(false)
        return
      }
      setMyReview(data.review)
      setShowForm(false)
      showSnackbar('Благодарим! Ревюто ще се покаже след одобрение от админ.', 'success')
    } catch {
      showSnackbar('Мрежова грешка', 'error')
    }
    setSubmitting(false)
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: C.muted }} /></Box>
  }

  const visibleReviews = showAll ? reviews : reviews.slice(0, 3)

  return (
    <Box sx={{ mt: 3 }}>
      {/* Summary */}
      {reviews.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <StarRow value={Math.round(avgRating)} size={22} />
          <Typography sx={{ fontSize: '15px', fontWeight: 800, color: C.text }}>
            {avgRating}
          </Typography>
          <Typography sx={{ fontSize: '13px', color: C.muted }}>
            ({reviews.length} {reviews.length === 1 ? 'ревю' : 'ревюта'})
          </Typography>
        </Box>
      )}

      {/* Submit / edit form for verified buyers */}
      {hasPurchase && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: '14px', background: C.primaryA3, border: `1px solid ${C.border}` }}>
          {myReview && !showForm ? (
            <Box>
              <Typography sx={{ fontSize: '12px', color: C.muted, mb: 0.5 }}>Твоето ревю:</Typography>
              <StarRow value={myReview.rating} size={18} />
              {myReview.text && <Typography sx={{ fontSize: '13px', color: C.text, mt: 1, lineHeight: 1.5 }}>{myReview.text}</Typography>}
              <Typography sx={{ fontSize: '11px', color: myReview.status === 'approved' ? '#c4e9bf' : C.muted, mt: 1 }}>
                Статус: {myReview.status === 'approved' ? 'Одобрено' : myReview.status === 'pending' ? 'Чака одобрение' : 'Отхвърлено'}
              </Typography>
              <Button size="small" onClick={() => setShowForm(true)} sx={{ mt: 1, color: C.purple, fontSize: '12px', textTransform: 'none' }}>
                Редактирай
              </Button>
            </Box>
          ) : showForm || !myReview ? (
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text, mb: 1 }}>
                Сподели опита си с програмата
              </Typography>
              <StarRow value={rating} onChange={setRating} size={28} />
              <TextField
                fullWidth multiline rows={3}
                value={text}
                onChange={e => setText(e.target.value.slice(0, 1000))}
                placeholder="Какво ти хареса? Какво беше предизвикателство? (опционално)"
                sx={{ mt: 1.5 }}
                inputProps={{ style: { fontSize: '13px' } }}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={submitReview}
                  disabled={submitting || rating < 1}
                  sx={{ background: C.purple, color: '#fff', fontWeight: 700, fontSize: '13px', textTransform: 'none' }}
                >
                  {submitting ? 'Изпращане...' : (myReview ? 'Обнови ревюто' : 'Изпрати ревю')}
                </Button>
                {myReview && (
                  <Button onClick={() => setShowForm(false)} sx={{ color: C.muted, fontSize: '12px', textTransform: 'none' }}>
                    Откажи
                  </Button>
                )}
              </Box>
            </Box>
          ) : null}
        </Paper>
      )}

      {/* Approved reviews list */}
      {reviews.length === 0 ? (
        <Typography sx={{ fontSize: '13px', color: C.muted, fontStyle: 'italic', mt: 1 }}>
          Все още няма ревюта. Бъди първият!
        </Typography>
      ) : (
        <>
          {visibleReviews.map(r => (
            <Paper key={r.id} sx={{ p: 2, mb: 1.25, borderRadius: '14px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StarRow value={r.rating} size={16} />
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.text }}>
                    {r.client_name || 'Клиент'}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '11px', color: C.muted }}>
                  {timeAgo(r.created_at)}
                </Typography>
              </Box>
              {r.text && (
                <Typography sx={{ fontSize: '13px', color: C.text, lineHeight: 1.5 }}>
                  {r.text}
                </Typography>
              )}
            </Paper>
          ))}
          {!showAll && reviews.length > 3 && (
            <Button onClick={() => setShowAll(true)} fullWidth sx={{ color: C.purple, fontSize: '12px', textTransform: 'none', mt: 1 }}>
              Виж всички {reviews.length} ревюта →
            </Button>
          )}
        </>
      )}
    </Box>
  )
}
