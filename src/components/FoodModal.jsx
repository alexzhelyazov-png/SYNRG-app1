import { useState, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, IconButton, CircularProgress,
  // Note: IconButton still used for close button
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useApp } from '../context/AppContext'
import { foodDB, foodLabel } from '../lib/constants'
import { C } from '../theme'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

// Send photo to AI Edge Function for food recognition
async function recognizeFood(base64) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/food-recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ image: base64 }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (data.error) return null
  return data
}

export default function FoodModal() {
  const { foodModalOpen, setFoodModalOpen, addFoodFromModal, addBarcodeFood, t, lang } = useApp()
  const [search,      setSearch]      = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const [amount,      setAmount]      = useState('')

  // AI photo state
  const [aiFood,     setAiFood]     = useState(null)  // { name, grams, kcal, protein, kcalPer100, proteinPer100 }
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiError,    setAiError]    = useState('')
  const fileInputRef = useRef(null)

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

  const lookupKey  = selectedKey || search.trim().toLowerCase()
  const selectedFood = foodDB[lookupKey] || null
  const isPiece    = !!selectedFood?.perPiece

  const gramsForCalc = isPiece
    ? Number(amount) * (selectedFood?.gramsPerPiece || 55)
    : Number(amount)

  const isAiMode = !!aiFood

  function handleSelectSuggestion(key) {
    setSelectedKey(key)
    setSearch(foodLabel(foodDB[key], lang))
    setAmount('')
    setAiFood(null)
    setAiError('')
  }

  function handleSearchChange(val) {
    setSearch(val)
    setSelectedKey(null)
    setAmount('')
    setAiFood(null)
    setAiError('')
  }

  function handleAdd() {
    if (isAiMode) {
      const grams = Number(String(amount).replace(',', '.')) || aiFood.grams
      addBarcodeFood(aiFood.name, grams, aiFood.kcalPer100, aiFood.proteinPer100)
      resetAndClose()
      return
    }
    if (!selectedFood || !amount) return
    const rawNum = Number(String(amount).replace(',', '.'))
    if (!rawNum) return
    const grams = selectedFood.perPiece ? rawNum * (selectedFood.gramsPerPiece || 55) : rawNum
    addFoodFromModal(lookupKey, grams)
    resetAndClose()
  }

  async function handlePhotoCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAiLoading(true)
    setAiError('')
    setAiFood(null)

    try {
      // Resize image to save bandwidth (max 800px)
      const base64 = await resizeAndEncode(file, 800)
      const result = await recognizeFood(base64)
      if (!result) {
        setAiError(t('aiRecognizeError'))
        setAiLoading(false)
        return
      }
      setAiFood(result)
      setSearch(isEn ? (result.nameEn || result.name) : result.name)
      setAmount(String(result.grams || ''))
      setSelectedKey(null)
    } catch {
      setAiError(t('aiRecognizeError'))
    }
    setAiLoading(false)
    // Reset file input so same photo can be re-taken
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetAndClose() {
    setFoodModalOpen(false)
    setSearch('')
    setSelectedKey(null)
    setAmount('')
    setAiFood(null)
    setAiError('')
    setAiLoading(false)
  }

  const canAdd = isAiMode
    ? true  // AI already estimated grams
    : selectedFood && amount && Number(amount) > 0

  // Compute preview values for AI mode
  const aiGrams = isAiMode ? (Number(String(amount).replace(',', '.')) || aiFood.grams) : 0
  const aiKcalPreview = isAiMode ? Math.round((aiFood.kcalPer100 / 100) * aiGrams) : 0
  const aiProtPreview = isAiMode ? Math.round((aiFood.proteinPer100 / 100) * aiGrams * 10) / 10 : 0

  return (
    <Dialog open={foodModalOpen} onClose={resetAndClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        {t('addFoodTitle')}
        <IconButton onClick={resetAndClose} size="small" sx={{ color: C.muted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'grid', gap: 1.5 }}>

          {/* Search + camera button */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              placeholder={t('foodSearchPlaceholder')}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              autoFocus
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhotoCapture}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={aiLoading}
              variant="outlined"
              sx={{
                minWidth: 'auto',
                borderRadius: '12px',
                color: C.muted,
                borderColor: C.border,
                px: 1.5, py: 1,
                fontSize: '20px',
                lineHeight: 1,
                '&:hover': { background: C.accentSoft, borderColor: C.purple, color: C.purple },
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
            </Button>
          </Box>

          {/* AI loading */}
          {aiLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <CircularProgress size={20} sx={{ color: C.primary }} />
              <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('aiAnalyzing')}</Typography>
            </Box>
          )}

          {/* AI error */}
          {aiError && (
            <Typography sx={{ color: C.danger, fontSize: '13px', py: 0.5 }}>{aiError}</Typography>
          )}

          {/* AI result info */}
          {isAiMode && !aiLoading && (
            <Box sx={{
              background: 'rgba(200,197,255,0.08)',
              border: '1px solid rgba(200,197,255,0.2)',
              borderRadius: '10px',
              px: 2, py: 1.5,
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: '14px', mb: 0.5 }}>
                {isEn ? (aiFood.nameEn || aiFood.name) : aiFood.name}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: '12px' }}>
                AI: ~{aiFood.grams}{t('gUnit')} · {aiFood.kcalPer100} kcal · {aiFood.proteinPer100}{t('gUnit')} {t('proteinShortLbl')} / 100{t('gUnit')}
              </Typography>

              {/* Cooking method choice */}
              {aiFood.cookingOptions && aiFood.cookingOptions.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  {aiFood.cookingOptions.map((opt, i) => {
                    const isSelected = aiFood.kcalPer100 === opt.kcalPer100
                    return (
                      <Box key={i} onClick={() => {
                        const grams = Number(String(amount).replace(',', '.')) || aiFood.grams
                        setAiFood(prev => ({
                          ...prev,
                          kcalPer100: opt.kcalPer100,
                          proteinPer100: opt.proteinPer100,
                          kcal: Math.round((opt.kcalPer100 / 100) * grams),
                          protein: Math.round((opt.proteinPer100 / 100) * grams * 10) / 10,
                        }))
                      }} sx={{
                        flex: 1, textAlign: 'center',
                        px: 1.5, py: 1, borderRadius: '8px', cursor: 'pointer',
                        background: isSelected ? 'rgba(170,169,205,0.18)' : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${isSelected ? 'rgba(170,169,205,0.5)' : C.border}`,
                        transition: 'all 0.15s',
                        '&:hover': { borderColor: 'rgba(170,169,205,0.4)' },
                      }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: isSelected ? 800 : 600, color: isSelected ? C.purple : C.text }}>
                          {isEn ? opt.labelEn : opt.label}
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.25 }}>
                          {opt.kcalPer100} kcal/100{t('gUnit')}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          )}

          {/* DB Suggestions dropdown */}
          {!isAiMode && search.trim() && !selectedKey && suggestions.length > 0 && (
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

          {/* Preview (DB mode) */}
          {!isAiMode && selectedFood && amount && Number(amount) > 0 && (
            <Box sx={{
              background:   C.accentSoft,
              border:       '1px solid rgba(170,169,205,0.25)',
              borderRadius: '10px',
              px: 2, py: 1.5,
              display:      'flex',
              gap: 3,
            }}>
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('caloriesLbl')}
                </Typography>
                <Typography sx={{ fontWeight: 800, color: C.text }}>
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

          {/* Preview (AI mode) */}
          {isAiMode && aiGrams > 0 && (
            <Box sx={{
              background:   C.accentSoft,
              border:       '1px solid rgba(170,169,205,0.25)',
              borderRadius: '10px',
              px: 2, py: 1.5,
              display:      'flex',
              gap: 3,
            }}>
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('caloriesLbl')}
                </Typography>
                <Typography sx={{ fontWeight: 800, color: C.text }}>
                  {aiKcalPreview} kcal
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('proteinLbl')}
                </Typography>
                <Typography sx={{ fontWeight: 800, color: C.purple }}>
                  {aiProtPreview}{t('gUnit')}
                </Typography>
              </Box>
            </Box>
          )}

          <TextField
            fullWidth
            placeholder={isAiMode ? t('aiGramsHint') : (isPiece ? t('countLbl') : t('amountPlaceholder'))}
            label={!isAiMode && isPiece ? t('countLbl') : undefined}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            type="number"
            inputProps={{ min: 1 }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1 }}>
        <Button onClick={resetAndClose} variant="outlined" fullWidth>{t('cancelLbl')}</Button>
        <Button onClick={handleAdd} variant="contained" color="primary" fullWidth disabled={!canAdd}>
          {t('addBtn')} →
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Resize image to maxDim and return base64
function resizeAndEncode(file, maxDim) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
          else       { w = Math.round(w * maxDim / h); h = maxDim }
        }
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
