import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useApp } from '../context/AppContext'
import { foodDB, foodLabel } from '../lib/constants'
import { C } from '../theme'

export default function FoodModal() {
  const { foodModalOpen, setFoodModalOpen, addFoodFromModal, t, lang } = useApp()
  const [search,      setSearch]      = useState('')
  const [selectedKey, setSelectedKey] = useState(null)  // actual DB key after suggestion click
  const [amount,      setAmount]      = useState('')

  const isEn = lang === 'en'

  const suggestions = (() => {
    const s = search.trim().toLowerCase()
    if (!s) return []
    return Object.entries(foodDB)
      .filter(([k, f]) => {
        const bgMatch = k.includes(s) || f.label.toLowerCase().includes(s)
        const enMatch = isEn && (f.labelEn || '').toLowerCase().includes(s)
        return bgMatch || enMatch
      })
      .slice(0, 8)
  })()

  // Lookup: use selectedKey if set (after clicking suggestion), else try direct match
  const lookupKey  = selectedKey || search.trim().toLowerCase()
  const selectedFood = foodDB[lookupKey] || null
  const isPiece    = !!selectedFood?.perPiece

  const gramsForCalc = isPiece
    ? Number(amount) * (selectedFood?.gramsPerPiece || 55)
    : Number(amount)

  function handleSelectSuggestion(key) {
    setSelectedKey(key)
    setSearch(foodLabel(foodDB[key], lang))  // show localized name in field
    setAmount('')
  }

  function handleSearchChange(val) {
    setSearch(val)
    setSelectedKey(null)  // clear selection when typing again
    setAmount('')
  }

  function handleAdd() {
    if (!selectedFood || !amount) return
    const rawNum = Number(String(amount).replace(',', '.'))
    if (!rawNum) return
    const grams = selectedFood.perPiece ? rawNum * (selectedFood.gramsPerPiece || 55) : rawNum
    addFoodFromModal(lookupKey, grams)
    setSearch('')
    setSelectedKey(null)
    setAmount('')
  }

  function handleClose() {
    setFoodModalOpen(false)
    setSearch('')
    setSelectedKey(null)
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
            onChange={e => handleSearchChange(e.target.value)}
            autoFocus
          />

          {/* Suggestions dropdown */}
          {search.trim() && !selectedKey && suggestions.length > 0 && (
            <Box sx={{
              border:       `1px solid ${C.border}`,
              borderRadius: '12px',
              overflow:     'hidden',
              background:   C.sidebar,
            }}>
              {suggestions.map(([key, food]) => (
                <Box
                  key={key}
                  onClick={() => handleSelectSuggestion(key)}
                  sx={{
                    px: 1.75, py: 1.25,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${C.border}`,
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { background: C.accentSoft },
                  }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>
                    {foodLabel(food, lang)}
                  </Typography>
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
