import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useApp } from '../context/AppContext'
import { foodDB } from '../lib/constants'
import { C } from '../theme'

export default function FoodModal() {
  const { foodModalOpen, setFoodModalOpen, addFoodFromModal, t } = useApp()
  const [search, setSearch] = useState('')
  const [amount, setAmount] = useState('')  // grams OR count, depending on food

  const suggestions = (() => {
    const s = search.trim().toLowerCase()
    if (!s) return []
    return Object.entries(foodDB)
      .filter(([k, f]) => k.includes(s) || f.label.toLowerCase().includes(s))
      .slice(0, 8)
  })()

  const selectedFood = foodDB[search.trim().toLowerCase()] || null
  const isPiece      = !!selectedFood?.perPiece

  // For calculation: if per-piece, multiply count × gramsPerPiece
  const gramsForCalc = isPiece
    ? Number(amount) * (selectedFood?.gramsPerPiece || 55)
    : Number(amount)

  function handleAdd() {
    const key    = search.trim().toLowerCase()
    const food   = foodDB[key]
    const rawNum = Number(String(amount).replace(',', '.'))
    if (!food || !rawNum) return
    const grams  = food.perPiece ? rawNum * (food.gramsPerPiece || 55) : rawNum
    addFoodFromModal(key, grams)
    setSearch('')
    setAmount('')
  }

  function handleClose() {
    setFoodModalOpen(false)
    setSearch('')
    setAmount('')
  }

  return (
    <Dialog open={foodModalOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        {t('addFoodTitle')}
        <IconButton onClick={handleClose} size="small" sx={{ color: C.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <TextField
            fullWidth
            placeholder={t('foodSearchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setAmount('') }}
            autoFocus
          />

          {/* Suggestions dropdown */}
          {search.trim() && suggestions.length > 0 && (
            <Box sx={{
              border:       `1px solid ${C.border}`,
              borderRadius: '12px',
              overflow:     'hidden',
              background:   C.sidebar,
            }}>
              {suggestions.map(([key, food]) => (
                <Box
                  key={key}
                  onClick={() => setSearch(key)}
                  sx={{
                    px: 1.75, py: 1.25,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${C.border}`,
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { background: C.accentSoft },
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{food.label}</Typography>
                  <Typography sx={{ color: C.muted, fontSize: '12px' }}>
                    {food.perPiece
                      ? `${Math.round(food.kcal / 100 * food.gramsPerPiece)} kcal · ${Math.round(food.protein / 100 * food.gramsPerPiece * 10) / 10}${t('gUnit')} ${t('proteinShortLbl')} / ${t('pieceUnit')}`
                      : `${food.kcal} kcal · ${food.protein}${t('gUnit')} / 100${t('gUnit')}`
                    }
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Preview */}
          {selectedFood && amount && Number(amount) > 0 && (
            <Box sx={{
              background:   C.accentSoft,
              border:       '1px solid rgba(196,233,191,0.25)',
              borderRadius: '10px',
              px: 2, py: 1.5,
              display:      'flex',
              gap: 3,
            }}>
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('caloriesLbl')}
                </Typography>
                <Typography sx={{ fontWeight: 800, color: C.primary }}>
                  {Math.round((selectedFood.kcal / 100) * gramsForCalc)} kcal
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('proteinLbl')}
                </Typography>
                <Typography sx={{ fontWeight: 800, color: C.purple }}>
                  {Math.round((selectedFood.protein / 100) * gramsForCalc * 10) / 10}{t('gUnit')}
                </Typography>
              </Box>
              {isPiece && (
                <Box>
                  <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {t('gramsLbl')}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, color: C.muted }}>
                    {gramsForCalc}{t('gUnit')}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <TextField
            fullWidth
            placeholder={isPiece ? t('countLbl') : t('amountPlaceholder')}
            label={isPiece ? t('countLbl') : undefined}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            type="number"
            inputProps={{ min: 1 }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined" fullWidth>{t('cancelLbl')}</Button>
        <Button onClick={handleAdd} variant="contained" color="primary" fullWidth>
          {t('addBtn')} →
        </Button>
      </DialogActions>
    </Dialog>
  )
}
