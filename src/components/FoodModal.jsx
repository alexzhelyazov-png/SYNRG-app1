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
// Returns: { ...result } on success, { quotaExceeded: true, message } on 429, null on other failures
async function recognizeFood(base64, clientId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/food-recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ image: base64, client_id: clientId }),
  })
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    return { quotaExceeded: true, message: data.message || 'Дневният лимит е достигнат.' }
  }
  if (!res.ok) return null
  const data = await res.json()
  if (data.error) return null
  return data
}

export default function FoodModal() {
  const { foodModalOpen, setFoodModalOpen, addFoodFromModal, addBarcodeFood, client, t, lang } = useApp()
  const [search,      setSearch]      = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const [amount,      setAmount]      = useState('')

  // Recent unique meals (last 8 distinct foods the client logged)
  const recentMeals = (() => {
    const meals = client?.meals || []
    const seen = new Set()
    const result = []
    for (let i = meals.length - 1; i >= 0 && result.length < 8; i--) {
      const m = meals[i]
      const key = (m.label || '').toLowerCase().trim()
      if (!key || seen.has(key)) continue
      if (!m.grams || m.grams <= 0) continue
      seen.add(key)
      result.push(m)
    }
    return result
  })()

  // Custom food state (for re-logging barcode/AI/recipe items with editable grams)
  const [customFood, setCustomFood] = useState(null)
  // customFood = { name, kcalPer100, proteinPer100, carbsPer100, fatPer100 }

  // AI photo state
  const [aiFood,     setAiFood]     = useState(null)  // { name, grams, kcal, protein, kcalPer100, proteinPer100 }
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiError,    setAiError]    = useState('')
  const fileInputRef = useRef(null)

  function handleRecentClick(meal) {
    // Try to find the food in foodDB by matching the label (case-insensitive)
    const labelLc = (meal.label || '').toLowerCase().trim()
    const dbEntry = Object.entries(foodDB).find(([k, f]) => {
      return k === labelLc
        || (f.label || '').toLowerCase() === labelLc
        || (f.labelEn || '').toLowerCase() === labelLc
    })

    if (dbEntry) {
      // DB food — use standard DB path so preview + per-piece works
      const [key, food] = dbEntry
      setSelectedKey(key)
      setSearch(foodLabel(food, lang))
      if (food.perPiece) {
        const pieces = Math.max(1, Math.round(meal.grams / (food.gramsPerPiece || 55)))
        setAmount(String(pieces))
      } else {
        setAmount(String(meal.grams))
      }
      setCustomFood(null)
      setAiFood(null)
      setAiError('')
    } else {
      // Custom food (AI / barcode / recipe log) — reverse-engineer per-100g, prefill for edit
      const kcalPer100  = Math.round((meal.kcal    / meal.grams) * 100)
      const protPer100  = Math.round((meal.protein / meal.grams) * 100 * 10) / 10
      const carbsPer100 = meal.carbs ? Math.round((meal.carbs / meal.grams) * 100 * 10) / 10 : 0
      const fatPer100   = meal.fat   ? Math.round((meal.fat   / meal.grams) * 100 * 10) / 10 : 0
      setCustomFood({
        name: meal.label,
        kcalPer100,
        proteinPer100: protPer100,
        carbsPer100,
        fatPer100,
      })
      setSearch(meal.label)
      setAmount(String(meal.grams))
      setSelectedKey(null)
      setAiFood(null)
      setAiError('')
    }
  }

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

  const isAiMode     = !!aiFood
  const isCustomMode = !!customFood && !isAiMode

  function handleSelectSuggestion(key) {
    setSelectedKey(key)
    setSearch(foodLabel(foodDB[key], lang))
    setAmount('')
    setAiFood(null)
    setCustomFood(null)
    setAiError('')
  }

  function handleSearchChange(val) {
    setSearch(val)
    setSelectedKey(null)
    setAmount('')
    setAiFood(null)
    setCustomFood(null)
    setAiError('')
  }

  function handleAdd() {
    if (isAiMode) {
      const grams = Number(String(amount).replace(',', '.')) || aiFood.grams
      addBarcodeFood(aiFood.name, grams, aiFood.kcalPer100, aiFood.proteinPer100)
      resetAndClose()
      return
    }
    if (isCustomMode) {
      const rawNum = Number(String(amount).replace(',', '.'))
      if (!rawNum) return
      addBarcodeFood(
        customFood.name,
        rawNum,
        customFood.kcalPer100,
        customFood.proteinPer100,
        customFood.carbsPer100 || 0,
        customFood.fatPer100   || 0,
      )
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
      const result = await recognizeFood(base64, client?.id)
      if (!result) {
        setAiError(t('aiRecognizeError'))
        setAiLoading(false)
        return
      }
      if (result.quotaExceeded) {
        setAiError(result.message)
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
    setCustomFood(null)
    setAiError('')
    setAiLoading(false)
  }

  const canAdd = isAiMode
    ? true  // AI already estimated grams
    : isCustomMode
      ? amount && Number(String(amount).replace(',', '.')) > 0
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

          {/* Recent meals (shown when search is empty) */}
          {!isAiMode && !aiLoading && !search.trim() && !selectedKey && recentMeals.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.75, fontWeight: 700 }}>
                Последно добавени
              </Typography>
              <Box sx={{
                border:       `1px solid ${C.border}`,
                borderRadius: '12px',
                overflow:     'hidden',
                background:   C.sidebar,
              }}>
                {recentMeals.map((meal, idx) => (
                  <Box
                    key={`${meal.label}-${idx}`}
                    onClick={() => handleRecentClick(meal)}
                    sx={{
                      px: 1.75, py: 1.25,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
                      borderBottom: `1px solid ${C.border}`,
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { background: C.accentSoft },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {meal.label}
                      </Typography>
                      <Typography sx={{ color: C.muted, fontSize: '12px' }}>
                        {meal.grams}{t('gUnit')} · {Math.round(meal.kcal)} kcal · {meal.protein}{t('gUnit')} {t('proteinShortLbl')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '11px', fontWeight: 800, color: C.primary, whiteSpace: 'nowrap' }}>
                      + Добави
                    </Typography>
                  </Box>
                ))}
              </Box>
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

          {/* Preview (Custom re-log mode) */}
          {isCustomMode && (
            <Box sx={{
              background:   'rgba(196,233,191,0.06)',
              border:       '1px solid rgba(196,233,191,0.2)',
              borderRadius: '10px',
              px: 2, py: 1.25,
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: '13px', color: C.primary, mb: 0.5 }}>
                {customFood.name}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: '11px' }}>
                {customFood.kcalPer100} kcal · {customFood.proteinPer100}{t('gUnit')} {t('proteinShortLbl')} / 100{t('gUnit')} — редактирай грамажа по-долу
              </Typography>
              {amount && Number(String(amount).replace(',', '.')) > 0 && (
                <Box sx={{ display: 'flex', gap: 3, mt: 1, pt: 1, borderTop: `1px solid ${C.border}` }}>
                  <Box>
                    <Typography sx={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      {t('caloriesLbl')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: C.text, fontSize: '15px' }}>
                      {Math.round((customFood.kcalPer100 / 100) * Number(String(amount).replace(',', '.')))} kcal
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      {t('proteinLbl')}
                    </Typography>
                    <Typography sx={{ fontWeight: 800, color: C.purple, fontSize: '15px' }}>
                      {Math.round((customFood.proteinPer100 / 100) * Number(String(amount).replace(',', '.')) * 10) / 10}{t('gUnit')}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Preview (DB mode) */}
          {!isAiMode && !isCustomMode && selectedFood && amount && Number(amount) > 0 && (
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
