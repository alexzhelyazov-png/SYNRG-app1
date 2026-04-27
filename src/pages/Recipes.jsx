import { useState } from 'react'
import {
  Box, Typography, Chip, Paper, Dialog, DialogContent, DialogActions,
  IconButton, Divider, Button, TextField,
} from '@mui/material'
import CloseIcon             from '@mui/icons-material/Close'
import AccessTimeIcon        from '@mui/icons-material/AccessTime'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import AddIcon               from '@mui/icons-material/Add'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'
import RECIPES, { RECIPE_CATEGORIES, recipePortionGrams } from '../lib/recipes'

const C = {
  bg:       'var(--c-bg)',
  card:     'var(--c-card)',
  border:   'var(--c-border)',
  text:     'var(--c-text)',
  muted:    'var(--c-muted)',
  primary:  'var(--c-primary)',
  purple:   'var(--c-purple)',
}

const EASE = {
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

const CATEGORY_COLORS = {
  breakfast: { bg: 'rgba(255,208,112,0.12)', border: 'rgba(255,208,112,0.3)', text: '#FFD070', label: 'Закуска' },
  main:      { bg: 'rgba(94,198,208,0.12)',  border: 'rgba(94,198,208,0.3)',  text: '#5EC6D0', label: 'Основни' },
  snack:     { bg: 'rgba(196,233,191,0.12)', border: 'rgba(196,233,191,0.3)', text: '#c4e9bf', label: 'Снак' },
  side:      { bg: 'rgba(240,150,100,0.12)', border: 'rgba(240,150,100,0.3)', text: '#F09664', label: 'Гарнитури и супи' },
}

function MacroBadge({ label, value, color }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography sx={{ fontSize: '15px', fontWeight: 800, color: color || C.text, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </Typography>
    </Box>
  )
}

// ─── Quick log dialog ────────────────────────────────────────────────────────
function RecipeLogDialog({ recipe, onClose, onLog }) {
  const [grams, setGrams] = useState('')
  if (!recipe) return null

  const portionG    = recipePortionGrams(recipe)
  const kcalPer100  = portionG > 0 ? (recipe.kcal    / portionG) * 100 : recipe.kcal
  const protPer100  = portionG > 0 ? (recipe.protein / portionG) * 100 : recipe.protein
  const carbsPer100 = portionG > 0 ? (recipe.carbs   / portionG) * 100 : recipe.carbs
  const fatPer100   = portionG > 0 ? (recipe.fat     / portionG) * 100 : recipe.fat

  const g            = parseFloat(grams) || 0
  const previewKcal  = g > 0 ? Math.round(kcalPer100  / 100 * g)            : null
  const previewProt  = g > 0 ? Math.round(protPer100   / 100 * g * 10) / 10 : null
  const previewCarbs = g > 0 ? Math.round(carbsPer100  / 100 * g * 10) / 10 : null
  const previewFat   = g > 0 ? Math.round(fatPer100    / 100 * g * 10) / 10 : null

  function handleLog() {
    if (!g || g <= 0) return
    onLog(recipe.name, g, kcalPer100, protPer100, carbsPer100, fatPer100)
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: 'var(--c-cardDeep, #111c13)',
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          m: 2,
        },
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, pr: 2 }}>
            <Chip
              label={CATEGORY_COLORS[recipe.category].label}
              size="small"
              sx={{
                background:  CATEGORY_COLORS[recipe.category].bg,
                border:      `1px solid ${CATEGORY_COLORS[recipe.category].border}`,
                color:       CATEGORY_COLORS[recipe.category].text,
                fontWeight:  700,
                fontSize:    '10px',
                height:      20,
                mb:          1,
              }}
            />
            <Typography sx={{ fontSize: '16px', fontWeight: 800, color: C.text, lineHeight: 1.3 }}>
              {recipe.name}
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: C.muted, background: 'rgba(255,255,255,0.05)', '&:hover': { background: 'rgba(255,255,255,0.1)' }, flexShrink: 0 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Reference macros */}
        <Box sx={{
          p: 1.5,
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${C.border}`,
          borderRadius: '10px',
          mb: 2.5,
        }}>
          <Typography sx={{ fontSize: '11px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1 }}>
            {portionG > 0 ? `Пълна порция (~${portionG}г)` : `на 100г${recipe.portionNote ? ` (${recipe.portionNote})` : ''}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalFireDepartmentIcon sx={{ fontSize: 13, color: '#F97316' }} />
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#F97316' }}>{recipe.kcal} kcal</Typography>
            </Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.primary }}>{recipe.protein}г Б</Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#FFD070' }}>{recipe.carbs}г В</Typography>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.purple }}>{recipe.fat}г М</Typography>
          </Box>
        </Box>

        {/* Grams input */}
        <TextField
          fullWidth
          label="Изял/а съм (грама)"
          placeholder="напр. 250"
          value={grams}
          onChange={e => setGrams(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLog()}
          type="number"
          inputProps={{ min: 1 }}
          autoFocus
          sx={{ mb: previewKcal !== null ? 2 : 0 }}
        />

        {/* Live preview */}
        {previewKcal !== null && (
          <Box sx={{
            display:      'flex',
            gap:          2.5,
            p:            1.5,
            background:   'rgba(196,233,191,0.07)',
            border:       '1px solid rgba(196,233,191,0.18)',
            borderRadius: '10px',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocalFireDepartmentIcon sx={{ fontSize: 14, color: '#F97316' }} />
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#F97316' }}>{previewKcal}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>kcal</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: C.primary }}>{previewProt}г</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>Б</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#FFD070' }}>{previewCarbs}г</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>В</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: '15px', fontWeight: 800, color: C.purple }}>{previewFat}г</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>М</Typography>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" fullWidth sx={{ borderColor: C.border, color: C.muted }}>
          Откажи
        </Button>
        <Button
          onClick={handleLog}
          variant="contained"
          color="primary"
          fullWidth
          disabled={!g || g <= 0}
        >
          Добави в дневника
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Detail dialog ────────────────────────────────────────────────────────────
function RecipeDetailDialog({ recipe, onClose, onLog }) {
  if (!recipe) return null
  const cat = CATEGORY_COLORS[recipe.category]

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'var(--c-cardDeep, #111c13)',
          border: `1px solid ${C.border}`,
          borderRadius: '20px',
          m: 2,
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Hero image */}
        {recipe.image && (
          <Box
            component="img"
            src={recipe.image}
            alt={recipe.name}
            sx={{ width: '100%', height: 240, objectFit: recipe.imageFit || 'contain', objectPosition: recipe.imagePosition || 'center', background: 'rgba(255,255,255,0.04)', display: 'block', borderRadius: '20px 20px 0 0' }}
          />
        )}

        {/* Header */}
        <Box sx={{ p: 3, pb: 0, position: 'relative' }}>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ position: 'absolute', top: 16, right: 16, color: C.muted, background: 'rgba(255,255,255,0.05)', '&:hover': { background: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Chip
              label={cat.label}
              size="small"
              sx={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text, fontWeight: 700, fontSize: '11px' }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon sx={{ fontSize: 13, color: C.muted }} />
              <Typography sx={{ fontSize: '12px', color: C.muted }}>{recipe.prepTime} мин</Typography>
            </Box>
          </Box>

          <Typography variant="h3" sx={{ mb: 2, pr: 4 }}>{recipe.name}</Typography>

          {/* Batch recipe note */}
          {recipe.servings > 1 && (
            <Box sx={{
              mb: 1.5, px: 1.5, py: 1,
              background: 'rgba(255,208,112,0.07)',
              border: '1px solid rgba(255,208,112,0.22)',
              borderRadius: '8px',
            }}>
              <Typography sx={{ fontSize: '12px', color: '#FFD070', fontWeight: 600 }}>
                Рецептата е за {recipe.servings} порции — продуктите са за цялата тава.
                Макросите по-долу са за 1 порция.
              </Typography>
            </Box>
          )}

          {/* Macros */}
          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.75 }}>
            {recipePortionGrams(recipe) > 0 ? `на порция (~${recipePortionGrams(recipe)}г)` : `на 100г${recipe.portionNote ? ` (${recipe.portionNote})` : ''}`}
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            p: 1.5,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            border: `1px solid ${C.border}`,
            mb: 2,
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.25 }}>
                <LocalFireDepartmentIcon sx={{ fontSize: 13, color: '#F97316' }} />
                <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#F97316', lineHeight: 1 }}>
                  {recipe.kcal}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                kcal
              </Typography>
            </Box>
            <MacroBadge label="Белтък" value={`${recipe.protein}г`} color={C.primary} />
            <MacroBadge label="Въгл." value={`${recipe.carbs}г`} color="#FFD070" />
            <MacroBadge label="Мазн." value={`${recipe.fat}г`} color={C.purple} />
          </Box>
        </Box>

        <Box sx={{ px: 3, pb: 3 }}>
          <Divider sx={{ borderColor: C.border, mb: 2 }} />

          {/* Ingredients */}
          <Typography sx={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, mb: 1.25 }}>
            Продукти
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2.5 }}>
            {recipe.ingredients.map((ing, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography sx={{ fontSize: '14px', color: C.text }}>{ing.name}</Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.primary, flexShrink: 0, ml: 2 }}>
                  {ing.grams ? `${ing.grams} ${ing.unit}` : ing.unit}
                </Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ borderColor: C.border, mb: 2 }} />

          {/* Steps */}
          <Typography sx={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.muted, mb: 1.25 }}>
            Приготвяне
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: onLog ? 2.5 : 0 }}>
            {recipe.steps.map((step, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(196,233,191,0.1)', border: '1px solid rgba(196,233,191,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 800, color: C.primary, lineHeight: 1 }}>{i + 1}</Typography>
                </Box>
                <Typography sx={{ fontSize: '14px', color: C.text, lineHeight: 1.55, pt: '2px' }}>{step}</Typography>
              </Box>
            ))}
          </Box>

          {/* Log button */}
          {onLog && (
            <Button
              onClick={onLog}
              variant="contained"
              color="primary"
              fullWidth
              startIcon={<AddIcon />}
              sx={{ mt: 1 }}
            >
              Добави в дневника
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// ─── High-calorie warning: ≥ 220 kcal per 100g ───────────────────────────────
const isHighCalorie = (r) => {
  const pg = recipePortionGrams(r)
  const k100 = pg > 0 ? (r.kcal / pg) * 100 : r.kcal
  return k100 >= 220
}

// ─── Recipe card ──────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onClick, onLog }) {
  const cat = CATEGORY_COLORS[recipe.category]
  const highCal = isHighCalorie(recipe) || recipe.warn

  return (
    <Paper
      onClick={onClick}
      sx={{
        borderRadius: '16px',
        border: `1px solid ${C.border}`,
        background: 'var(--c-cardDeep, #111c13)',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: `all 0.18s ${EASE.decelerate}`,
        '&:hover': { transform: 'translateY(-2px)', borderColor: 'rgba(196,233,191,0.25)' },
      }}
    >
      {/* Hero image */}
      <Box sx={{ position: 'relative' }}>
        {recipe.image ? (
          <Box
            component="img"
            src={recipe.image}
            alt={recipe.name}
            sx={{ width: '100%', height: 195, objectFit: recipe.imageFit || 'contain', objectPosition: recipe.imagePosition || 'center', background: 'rgba(255,255,255,0.04)', display: 'block' }}
          />
        ) : (
          <Box sx={{
            width: '100%', height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)',
          }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.08)' }} />
          </Box>
        )}
        {highCal && (
          <Box sx={{
            position: 'absolute', top: 8, right: 8,
            background: '#C2410C',
            borderRadius: '6px',
            px: 0.75, py: '3px',
          }}>
            <Typography sx={{ fontSize: '9px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px', lineHeight: 1 }}>
              Висококалорично
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2, pt: 1.5, pb: onLog ? 1.25 : 2 }}>
        {/* Category chip + time */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Chip
            label={cat.label}
            size="small"
            sx={{ background: cat.bg, border: `1px solid ${cat.border}`, color: cat.text, fontWeight: 700, fontSize: '10px', height: 20 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <AccessTimeIcon sx={{ fontSize: 12, color: C.muted }} />
            <Typography sx={{ fontSize: '11px', color: C.muted }}>{recipe.prepTime} мин</Typography>
          </Box>
        </Box>

        {/* Name */}
        <Typography sx={{ fontSize: '14px', fontWeight: 700, color: C.text, mb: 1.25, lineHeight: 1.3 }}>
          {recipe.name}
        </Typography>

        {/* Macros row */}
        <Typography sx={{ fontSize: '10px', color: C.muted, mb: 0.5 }}>
          {recipePortionGrams(recipe) > 0 ? `на порция (~${recipePortionGrams(recipe)}г)` : `на 100г${recipe.portionNote ? ` (${recipe.portionNote})` : ''}`}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', mb: onLog ? 1.25 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 13, color: '#F97316' }} />
            <Typography sx={{ fontSize: '13px', fontWeight: 800, color: '#F97316' }}>{recipe.kcal}</Typography>
          </Box>
          <Typography sx={{ fontSize: '12px', color: C.primary, fontWeight: 700 }}>{recipe.protein}г Б</Typography>
          <Typography sx={{ fontSize: '12px', color: '#FFD070', fontWeight: 700 }}>{recipe.carbs}г В</Typography>
          <Typography sx={{ fontSize: '12px', color: C.purple, fontWeight: 700 }}>{recipe.fat}г М</Typography>
        </Box>

        {/* + Log button */}
        {onLog && (
          <Box
            onClick={e => { e.stopPropagation(); onLog() }}
            sx={{
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          0.5,
              py:           0.75,
              borderRadius: '8px',
              background:   'rgba(196,233,191,0.07)',
              border:       '1px solid rgba(196,233,191,0.15)',
              cursor:       'pointer',
              transition:   `all 0.15s ${EASE.spring}`,
              '&:hover':    { background: 'rgba(196,233,191,0.14)', borderColor: 'rgba(196,233,191,0.3)' },
            }}
          >
            <AddIcon sx={{ fontSize: 14, color: C.primary }} />
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.primary }}>Добави в дневника</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Recipes() {
  const { addBarcodeFood, isTrackerReadOnly, auth } = useApp()

  const [category,   setCategory]   = useState('all')
  const [selected,   setSelected]   = useState(null)
  const [logRecipe,  setLogRecipe]   = useState(null)

  const filtered = category === 'all'
    ? RECIPES
    : RECIPES.filter(r => r.category === category)

  function handleLog(name, grams, kcalPer100, protPer100, carbsPer100, fatPer100) {
    addBarcodeFood(name, grams, kcalPer100, protPer100, carbsPer100, fatPer100)
  }

  const canLog = !isTrackerReadOnly

  return (
    <Box sx={{ animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>

      {/* Header — wraps title + category chips so the tour spotlight
          clearly shows this is the Recipes page (with its filter bar). */}
      <Box data-tour="recipes">
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>Не знаеш какво да хапнеш?</Typography>
        <Typography sx={{ fontSize: '13px', color: C.muted }}>
          Открий рецепта и запиши точно колко си изял/а
        </Typography>
      </Box>

      {/* Category filter */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
        {RECIPE_CATEGORIES.map(cat => {
          const active  = category === cat.key
          const colData = cat.key !== 'all' ? CATEGORY_COLORS[cat.key] : null
          return (
            <Chip
              key={cat.key}
              label={cat.label}
              onClick={() => setCategory(cat.key)}
              sx={{
                background: active
                  ? (colData ? colData.bg : 'rgba(196,233,191,0.15)')
                  : 'rgba(255,255,255,0.04)',
                color:  active ? (colData ? colData.text : C.primary) : C.muted,
                border: `1px solid ${active ? (colData ? colData.border : 'rgba(196,233,191,0.3)') : C.border}`,
                fontWeight: active ? 700 : 500,
                fontSize:   '13px',
                cursor:     'pointer',
                transition: `all 0.15s ${EASE.spring}`,
                '&:hover':  { background: colData ? colData.bg : 'rgba(196,233,191,0.08)' },
                '& .MuiChip-label': { px: 1.5 },
              }}
            />
          )
        })}
      </Box>

      </Box>
      {/* /tour-wrapper ends after header + filter chips */}

      {/* Count */}
      <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {filtered.length} рецепти
      </Typography>

      {/* Grid */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 1.25,
      }}>
        {filtered.map(recipe => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onClick={() => { DB.trackEvent(auth.id, 'recipe_opened', recipe.id); setSelected(recipe) }}
            onLog={canLog ? () => setLogRecipe(recipe) : null}
          />
        ))}
      </Box>

      {/* Detail dialog */}
      <RecipeDetailDialog
        recipe={selected}
        onClose={() => setSelected(null)}
        onLog={canLog ? () => { setLogRecipe(selected); setSelected(null) } : null}
      />

      {/* Log dialog */}
      <RecipeLogDialog
        recipe={logRecipe}
        onClose={() => setLogRecipe(null)}
        onLog={handleLog}
      />
    </Box>
  )
}
