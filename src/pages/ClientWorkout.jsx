import { useState } from 'react'
import { Box, Typography, TextField, Button, Chip, Paper, IconButton } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import { useApp } from '../context/AppContext'
import { WORKOUT_CATEGORIES } from '../lib/constants'
import { C, EASE } from '../theme'
import { todayDate } from '../lib/utils'

export default function ClientWorkout() {
  const {
    auth, client, t,
    exName, setExName, exScheme, setExScheme, exWeight, setExWeight,
    workoutCategory, setWorkoutCategory,
    currentWorkout, setCurrentWorkout,
    addExercise, saveWorkout, updateWorkout, deleteWorkout,
  } = useApp()

  const [editingWorkout, setEditingWorkout] = useState(null)
  const isCoach = auth.role === 'coach' || auth.role === 'admin'

  const isMobile = window.innerWidth < 640

  return (
    <Box sx={{ animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
      <Paper sx={{
        border: `1px solid rgba(170,169,205,0.25)`,
        borderRadius: '20px',
        p: 3,
        background: 'linear-gradient(145deg, rgba(170,169,205,0.04) 0%, #1C1A19 100%)',
        boxShadow: '0 0 0 1px rgba(170,169,205,0.08), 0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.25 }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '99px',
            background: C.primary, boxShadow: `0 0 10px ${C.primaryGlow}`,
            flexShrink: 0, animation: `pulse 2.5s ${EASE.standard} infinite`,
          }} />
          <Typography variant="h3">{t('workout')} — {todayDate()}</Typography>
        </Box>

        {/* Category chips */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
          {WORKOUT_CATEGORIES.map(({ key }) => {
            const active = workoutCategory === key
            return (
              <Chip
                key={key}
                label={t(key)}
                onClick={() => setWorkoutCategory(key)}
                sx={{
                  background: active ? C.primary : 'rgba(255,255,255,0.04)',
                  color: active ? '#0A2E0F' : C.text,
                  border: `1px solid ${active ? C.primary : C.border}`,
                  fontWeight: active ? 800 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: `all 0.18s ${EASE.spring}`,
                  '&:hover': { background: active ? C.primaryHover : C.accentSoft, transform: 'translateY(-1px)' },
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
            )
          })}
        </Box>

        {/* Exercise name */}
        <Box sx={{ mb: 1.25 }}>
          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {t('exerciseLbl')}
          </Typography>
          <TextField
            fullWidth
            placeholder={t('exPlaceholder')}
            value={exName}
            onChange={e => setExName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExercise()}
            inputProps={{ style: { fontSize: '15px', padding: '12px 14px' } }}
          />
        </Box>

        {/* Scheme quick-select */}
        <Box sx={{ mb: 1.25 }}>
          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {t('setsReps')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
            {['3x6','3x8','3x10','3x12','3x15','3x20','4x6','4x8','4x10','4x12','4x15','4x20'].map(s => (
              <Chip key={s} label={s} size="small" onClick={() => setExScheme(s)}
                sx={{
                  fontWeight: 700, fontSize: '12px',
                  background: exScheme === s ? C.primary : 'rgba(255,255,255,0.06)',
                  color: exScheme === s ? C.primaryOn : C.text,
                  border: `1px solid ${exScheme === s ? C.primary : 'rgba(255,255,255,0.1)'}`,
                  '&:hover': { background: exScheme === s ? C.primaryHover : 'rgba(255,255,255,0.1)' },
                }} />
            ))}
          </Box>
          <TextField
            fullWidth size="small"
            placeholder="4x8"
            value={exScheme}
            onChange={e => setExScheme(e.target.value)}
            inputProps={{ style: { fontSize: '13px', padding: '8px 12px' } }}
          />
        </Box>

        {/* Weight quick-select */}
        <Box sx={{ mb: 1.75 }}>
          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {t('kgLbl')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5, mb: 0.75 }}>
            {[0,'2x2','2x4',10,15,20,25,30,35,40,45,50,55,60,65,70,75,80].map(w => (
              <Chip key={w} label={w === 0 ? '0' : w} size="small" onClick={() => setExWeight(String(w))}
                sx={{
                  fontWeight: 700, fontSize: '11px', justifyContent: 'center',
                  background: exWeight === String(w) ? '#D4AF37' : 'rgba(255,255,255,0.06)',
                  color: exWeight === String(w) ? '#000' : C.text,
                  border: `1px solid ${exWeight === String(w) ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
                  '&:hover': { background: exWeight === String(w) ? '#D4AF37' : 'rgba(255,255,255,0.1)' },
                  '& .MuiChip-label': { px: 0.5 },
                }} />
            ))}
          </Box>
          <TextField
            fullWidth size="small"
            placeholder="80"
            value={exWeight}
            onChange={e => setExWeight(e.target.value)}
            inputProps={{ style: { fontSize: '13px', padding: '8px 12px' } }}
          />
        </Box>

        {/* Add button */}
        <Button
          variant="contained" color="primary" onClick={addExercise} fullWidth
          sx={{ py: 1.5, fontSize: '15px', fontWeight: 700, mb: 0.5 }}
        >+ {t('exerciseLbl')}</Button>

        {/* Current exercises list */}
        {currentWorkout.length > 0 && (
          <Box sx={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`, borderRadius: '14px', p: 1.75, mb: 2 }}>
            <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1.25, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              {t(workoutCategory)} · {currentWorkout.length} {t('exercisesLbl')}
            </Typography>
            {currentWorkout.map((ex, i) => (
              <Box key={i} sx={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 80px auto' : '1fr 110px 80px auto',
                gap: 1, py: 1.1,
                borderBottom: i < currentWorkout.length - 1 ? `1px solid ${C.border}` : 'none',
                alignItems: 'center',
              }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14.5px' }}>{ex.exercise}</Typography>
                <Typography sx={{ color: C.muted, fontSize: '13.5px' }}>{ex.scheme}</Typography>
                <Typography sx={{ color: C.muted, fontSize: '13.5px' }}>{ex.weight} {t('kgUnit')}</Typography>
                <Button
                  size="small"
                  onClick={() => setCurrentWorkout(prev => prev.filter((_, j) => j !== i))}
                  sx={{ minWidth: 'auto', background: C.dangerSoft, color: C.danger, border: '1px solid rgba(255,107,157,0.2)', borderRadius: '10px', px: 1.25, py: '4px', fontSize: '13px' }}
                >x</Button>
              </Box>
            ))}
          </Box>
        )}

        {/* Save button */}
        <Button
          variant="contained" fullWidth disabled={!currentWorkout.length} onClick={saveWorkout}
          sx={{
            py: 1.875, fontSize: '15px', fontWeight: 800, letterSpacing: '0.3px',
            background: currentWorkout.length ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})` : 'rgba(255,255,255,0.06)',
            color: currentWorkout.length ? C.primaryOn : 'rgba(255,255,255,0.3)',
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' },
          }}
        >
          {t('saveWorkout')} ({currentWorkout.length} {t('exercisesLbl')})
        </Button>
      </Paper>

      {/* Workout history */}
      {(client.workouts || []).length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h3" sx={{ mb: 1.5, px: 0.5 }}>{t('workoutHistory')}</Typography>
          {client.workouts.map((w, i) => (
            <Paper key={w.id || i} sx={{ mb: 1.5, p: 2, border: `1px solid ${C.border}`, borderRadius: '14px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '14px', color: i === 0 ? C.purple : C.text }}>{w.date}</Typography>
                  {w.category && (
                    <Chip label={t(w.category)} size="small" sx={{ background: C.purpleSoft, color: C.purple, border: '1px solid rgba(200,197,255,0.2)', fontSize: '11px', fontWeight: 600 }} />
                  )}
                </Box>
                {isCoach && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ color: C.muted, fontSize: '12px' }}>{w.coach || ''}</Typography>
                    <IconButton size="small" onClick={() => setEditingWorkout(editingWorkout?.id === w.id ? null : { id: w.id, date: w.date, category: w.category || '', items: w.items.map(ex => ({ ...ex })) })}
                      sx={{ color: editingWorkout?.id === w.id ? C.primary : C.muted }}><EditIcon sx={{ fontSize: 14 }} /></IconButton>
                    <IconButton size="small" onClick={() => deleteWorkout(w.id)}
                      sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}><DeleteOutlineIcon sx={{ fontSize: 14 }} /></IconButton>
                  </Box>
                )}
              </Box>
              {editingWorkout?.id === w.id ? (
                <>
                  {/* Date & category edit */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField size="small" type="date" value={editingWorkout.date || ''}
                      onChange={e => setEditingWorkout({ ...editingWorkout, date: e.target.value })}
                      inputProps={{ style: { fontSize: '12px', padding: '6px 8px' } }}
                      sx={{ width: 140, '& .MuiInputBase-input::-webkit-calendar-picker-indicator': { filter: 'invert(0.7)' } }} />
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {WORKOUT_CATEGORIES.map(({ key }) => {
                        const active = editingWorkout.category === key
                        return (
                          <Chip key={key} label={t(key)} size="small"
                            onClick={() => setEditingWorkout({ ...editingWorkout, category: key })}
                            sx={{
                              background: active ? C.purpleSoft : 'rgba(255,255,255,0.04)',
                              color: active ? C.purple : C.muted,
                              border: `1px solid ${active ? 'rgba(200,197,255,0.3)' : C.border}`,
                              fontWeight: active ? 700 : 500, fontSize: '11px', cursor: 'pointer',
                              '&:hover': { background: active ? C.purpleSoft : 'rgba(255,255,255,0.08)' },
                            }} />
                        )
                      })}
                    </Box>
                  </Box>
                  {editingWorkout.items.map((ex, j) => (
                    <Box key={j} sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px auto', gap: 0.75, py: 0.5, alignItems: 'center' }}>
                      <TextField size="small" value={ex.exercise} onChange={e => { const items = [...editingWorkout.items]; items[j] = { ...items[j], exercise: e.target.value }; setEditingWorkout({ ...editingWorkout, items }) }}
                        inputProps={{ style: { fontSize: '12px', padding: '6px 8px' } }} />
                      <TextField size="small" value={ex.scheme} onChange={e => { const items = [...editingWorkout.items]; items[j] = { ...items[j], scheme: e.target.value }; setEditingWorkout({ ...editingWorkout, items }) }}
                        inputProps={{ style: { fontSize: '12px', padding: '6px 8px' } }} />
                      <TextField size="small" value={ex.weight} onChange={e => { const items = [...editingWorkout.items]; items[j] = { ...items[j], weight: e.target.value }; setEditingWorkout({ ...editingWorkout, items }) }}
                        inputProps={{ style: { fontSize: '12px', padding: '6px 8px' } }} />
                      <IconButton size="small" onClick={() => { const items = editingWorkout.items.filter((_, k) => k !== j); setEditingWorkout({ ...editingWorkout, items }) }}
                        sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}><DeleteOutlineIcon sx={{ fontSize: 14 }} /></IconButton>
                    </Box>
                  ))}
                  <Button size="small" onClick={() => setEditingWorkout({ ...editingWorkout, items: [...editingWorkout.items, { exercise: '', scheme: '', weight: '' }] })}
                    sx={{ fontSize: '12px', color: C.primary, mt: 0.5 }}>+ {t('addExerciseBtn') || 'Упражнение'}</Button>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Button size="small" variant="contained" onClick={() => { updateWorkout(editingWorkout.id, editingWorkout.items.filter(ex => ex.exercise.trim()), { date: editingWorkout.date, category: editingWorkout.category }); setEditingWorkout(null) }}
                      sx={{ fontSize: '12px', fontWeight: 700, background: C.primary, color: C.primaryOn }}>{t('saveBtn') || 'Запази'}</Button>
                    <Button size="small" onClick={() => setEditingWorkout(null)}
                      sx={{ fontSize: '12px', color: C.muted }}>{t('cancelBtn') || 'Откажи'}</Button>
                  </Box>
                </>
              ) : (
                (w.items || []).map((ex, j) => (
                  <Box key={j} sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', gap: 1, py: 0.6, borderBottom: j < w.items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Typography sx={{ color: C.text, fontWeight: 600, fontSize: '13px' }}>{ex.exercise}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '12.5px' }}>{ex.scheme}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '12.5px', textAlign: 'right' }}>{ex.weight} {t('kgUnit')}</Typography>
                  </Box>
                ))
              )}
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  )
}
