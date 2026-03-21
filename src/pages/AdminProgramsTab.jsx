import { useEffect, useState, useRef } from 'react'
import {
  Box, Typography, Paper, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, Checkbox, FormControlLabel,
  LinearProgress,
} from '@mui/material'
import AddIcon           from '@mui/icons-material/Add'
import EditIcon          from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PlayCircleIcon    from '@mui/icons-material/PlayCircle'
// Inline SVG to avoid Vite dep optimization issues
const UploadSvg = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
)
import { C }             from '../theme'
import { DB, isUsingSupabase } from '../lib/db'
import { useApp }        from '../context/AppContext'
import { parseVideoUrl, getVideoThumbnail } from '../lib/videoUtils'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const inputSx = {
  '& .MuiInputBase-input': { color: C.text },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
  '& .MuiInputLabel-root': { color: C.muted },
}

function StatusChip({ status, t }) {
  const map = {
    active:   { label: t('statusActive'),   bg: 'rgba(170,169,205,0.15)', color: '#C8C5FF' },
    draft:    { label: t('statusDraft'),     bg: 'rgba(251,146,60,0.15)',  color: '#FB923C' },
    archived: { label: t('statusArchived'),  bg: 'rgba(138,135,133,0.15)', color: '#8A8785' },
  }
  const m = map[status] || map.active
  return <Chip label={m.label} size="small" sx={{ background: m.bg, color: m.color, fontWeight: 700, fontSize: '11px', height: '24px' }} />
}

// ══════════════════════════════════════════════════════════════
// PROGRAMS SUB-TAB
// ══════════════════════════════════════════════════════════════
function ProgramsSubTab({ t, onSelectProgram, selectedProgramId }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg]     = useState(null)

  const load = async () => { setItems(await DB.getPrograms()) }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    if (dlg?.id) await DB.update('programs', dlg.id, { ...data, updated_at: new Date().toISOString() })
    else await DB.insert('programs', data)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('programs', id); showSnackbar(t('deletedMsg')); load() }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('adminPrograms')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addProgram')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noPrograms')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((p, i) => (
          <Box key={p.id} onClick={() => onSelectProgram(p)} sx={{
            px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
            background: selectedProgramId === p.id ? C.primaryContainer : 'transparent',
            '&:hover': { background: C.listHover },
          }}>
            {p.cover_url && (
              <Box component="img" src={p.cover_url} sx={{ width: 48, height: 32, borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{p.name_bg}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>{p.name_en}</Typography>
            </Box>
            {p.price_cents > 0 && (
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.text }}>
                {(p.price_cents / 100).toFixed(2)} {p.currency || 'BGN'}
              </Typography>
            )}
            <StatusChip status={p.status} t={t} />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDlg(p) }}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); del(p.id) }}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
      </Paper>
      {dlg !== null && <ProgramDialog t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function ProgramDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name_bg: '', name_en: '', description_bg: '', description_en: '',
    cover_url: '', status: 'active', display_order: 0,
    price_cents: 0, currency: 'BGN', stripe_price_id: '',
    ...item,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editProgram') : t('addProgram')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('descEn')} value={f.description_en} onChange={e => set('description_en', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('coverUrl')} value={f.cover_url} onChange={e => set('cover_url', e.target.value)} fullWidth size="small" sx={inputSx} />
        {f.cover_url && <Box component="img" src={f.cover_url} sx={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: '12px' }} />}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('priceLbl')} type="number" value={f.price_cents} onChange={e => set('price_cents', +e.target.value)} fullWidth size="small" sx={inputSx}
            helperText={t('priceCentsHint')} />
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('currencyLbl')}</InputLabel>
            <Select value={f.currency || 'BGN'} label={t('currencyLbl')} onChange={e => set('currency', e.target.value)}>
              <MenuItem value="BGN">BGN (лв)</MenuItem>
              <MenuItem value="EUR">EUR (€)</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <TextField label="Stripe Price ID" value={f.stripe_price_id || ''} onChange={e => set('stripe_price_id', e.target.value)} fullWidth size="small" sx={inputSx}
          helperText={t('stripePriceHint')} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('statusLbl')}</InputLabel>
            <Select value={f.status} label={t('statusLbl')} onChange={e => set('status', e.target.value)}>
              <MenuItem value="active">{t('statusActive')}</MenuItem>
              <MenuItem value="draft">{t('statusDraft')}</MenuItem>
              <MenuItem value="archived">{t('statusArchived')}</MenuItem>
            </Select>
          </FormControl>
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => { const { id, created_at, updated_at, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULES SUB-TAB
// ══════════════════════════════════════════════════════════════
function ModulesSubTab({ t, programId }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg]     = useState(null)

  const load = async () => {
    if (!programId) { setItems([]); return }
    setItems(await DB.getProgramModules(programId))
  }
  useEffect(() => { load() }, [programId])

  const save = async (data) => {
    if (dlg?.id) await DB.update('program_modules', dlg.id, data)
    else await DB.insert('program_modules', { ...data, program_id: programId })
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('program_modules', id); showSnackbar(t('deletedMsg')); load() }

  if (!programId) {
    return <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('selectProgram')}</Typography>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('programModules')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addModule')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noModules')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((m, i) => (
          <Box key={m.id} sx={{
            px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 700, width: 24 }}>{String((m.display_order || 0) + 1).padStart(2, '0')}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{m.name_bg}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>{m.name_en}</Typography>
            </Box>
            <IconButton size="small" onClick={() => setDlg(m)}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
            <IconButton size="small" onClick={() => del(m.id)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
      </Paper>
      {dlg !== null && <ModuleDialog t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function ModuleDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name_bg: '', name_en: '', description_bg: '', description_en: '', display_order: 0,
    ...item,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editModule') : t('addModule')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('descEn')} value={f.description_en} onChange={e => set('description_en', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => { const { id, created_at, program_id, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// LESSONS SUB-TAB
// ══════════════════════════════════════════════════════════════
function LessonsSubTab({ t, programId, modules }) {
  const { showSnackbar } = useApp()
  const [items, setItems]       = useState([])
  const [dlg, setDlg]           = useState(null)
  const [filterMod, setFilterMod] = useState('')

  const load = async () => {
    if (!programId) { setItems([]); return }
    setItems(await DB.getProgramLessons(programId))
  }
  useEffect(() => { load() }, [programId])

  const save = async (data) => {
    if (dlg?.id) await DB.update('program_lessons', dlg.id, data)
    else await DB.insert('program_lessons', { ...data, program_id: programId })
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('program_lessons', id); showSnackbar(t('deletedMsg')); load() }

  const filtered = filterMod ? items.filter(l => l.module_id === filterMod) : items

  if (!programId) {
    return <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('selectProgram')}</Typography>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('programLessons')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addLesson')}</Button>
      </Box>

      {/* Module filter */}
      {modules.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
          <Box onClick={() => setFilterMod('')} sx={{
            px: 1.5, py: 0.5, borderRadius: '100px', cursor: 'pointer', fontSize: '12px',
            fontWeight: 700,
            background: !filterMod ? C.primary : 'transparent',
            color: !filterMod ? C.primaryOn : C.text,
            border: `1px solid ${!filterMod ? C.primary : C.loganBorder}`,
            transition: 'all 0.22s',
            '&:hover': !filterMod ? {} : { borderColor: C.logan, background: C.loganDeep },
          }}>{t('allLabel')}</Box>
          {modules.map(m => (
            <Box key={m.id} onClick={() => setFilterMod(m.id)} sx={{
              px: 1.5, py: 0.5, borderRadius: '100px', cursor: 'pointer', fontSize: '12px',
              fontWeight: 700,
              background: filterMod === m.id ? C.primary : 'transparent',
              color: filterMod === m.id ? C.primaryOn : C.text,
              border: `1px solid ${filterMod === m.id ? C.primary : C.loganBorder}`,
              transition: 'all 0.22s',
              '&:hover': filterMod === m.id ? {} : { borderColor: C.logan, background: C.loganDeep },
            }}>{m.name_bg}</Box>
          ))}
        </Box>
      )}

      {filtered.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noLessons')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {filtered.map((l, i) => {
          const mod = modules.find(m => m.id === l.module_id)
          return (
            <Box key={l.id} sx={{
              px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
              borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <PlayCircleIcon sx={{ fontSize: 20, color: l.video_url ? C.purple : C.muted, flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{l.name_bg}</Typography>
                <Typography sx={{ fontSize: '11px', color: C.muted }}>
                  {mod?.name_bg || '–'} · {l.duration_min || 0} {t('minutesShort')}
                  {l.video_url && ' · ✓ видео'}
                </Typography>
              </Box>
              {l.is_free_preview && (
                <Chip label={t('freePreview')} size="small"
                  sx={{ height: 20, fontSize: '10px', fontWeight: 700, background: 'rgba(200,197,255,0.12)', color: '#C8C5FF' }} />
              )}
              <IconButton size="small" onClick={() => setDlg(l)}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
              <IconButton size="small" onClick={() => del(l.id)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
            </Box>
          )
        })}
      </Paper>
      {dlg !== null && <LessonDialog t={t} item={dlg} modules={modules} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function LessonDialog({ t, item, modules, onClose, onSave }) {
  const [f, setF] = useState({
    module_id: modules[0]?.id || '', name_bg: '', name_en: '',
    description_bg: '', description_en: '', video_url: '', thumbnail_url: '',
    duration_min: 0, is_free_preview: false, display_order: 0,
    ...item,
  })
  const set = (k, v) => {
    setF(p => {
      const next = { ...p, [k]: v }
      if (k === 'video_url' && !p.thumbnail_url) {
        const thumb = getVideoThumbnail(v)
        if (thumb) next.thumbnail_url = thumb
      }
      return next
    })
  }
  const parsed = parseVideoUrl(f.video_url)

  // Bunny upload state
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  async function handleBunnyUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadPct(0)
    setUploadError('')

    try {
      // 1. Create video entry in Bunny via Edge Function
      const title = f.name_bg || f.name_en || file.name.replace(/\.[^.]+$/, '')
      const createRes = await fetch(`${SUPABASE_URL}/functions/v1/bunny-upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title }),
      })
      if (!createRes.ok) throw new Error('Failed to create video')
      const { uploadUrl, embedUrl, thumbnailUrl, apiKey } = await createRes.json()

      // 2. Upload file directly to Bunny with progress
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('AccessKey', apiKey)
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Upload error'))
        xhr.send(file)
      })

      // 3. Auto-fill video URL and thumbnail
      setF(prev => ({ ...prev, video_url: embedUrl, thumbnail_url: thumbnailUrl }))
    } catch (err) {
      console.error('Bunny upload error:', err)
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editLesson') : t('addLesson')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <FormControl size="small" fullWidth sx={inputSx}>
          <InputLabel>{t('selectModule')}</InputLabel>
          <Select value={f.module_id} label={t('selectModule')} onChange={e => set('module_id', e.target.value)}>
            {modules.map(m => <MenuItem key={m.id} value={m.id}>{m.name_bg}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('descEn')} value={f.description_en} onChange={e => set('description_en', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />

        {/* Video: Upload or paste URL */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField label={t('videoUrl')} value={f.video_url} onChange={e => set('video_url', e.target.value)} fullWidth size="small" sx={inputSx}
            helperText={parsed ? `${parsed.type} ✓` : t('videoUrlHint')} />
          <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleBunnyUpload} />
          <Button
            variant="outlined"
            size="small"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            startIcon={<UploadSvg />}
            sx={{
              mt: 0.5, minWidth: 'auto', whiteSpace: 'nowrap',
              borderColor: C.border, color: C.muted, px: 1.5,
              '&:hover': { borderColor: C.purple, color: C.purple },
            }}
          >
            {t('uploadVideoBtn')}
          </Button>
        </Box>

        {/* Upload progress */}
        {uploading && (
          <Box>
            <LinearProgress variant="determinate" value={uploadPct}
              sx={{ height: 6, borderRadius: 3, background: C.border,
                '& .MuiLinearProgress-bar': { background: C.primary, borderRadius: 3 } }} />
            <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.5 }}>
              {t('uploadingVideo')} {uploadPct}%
            </Typography>
          </Box>
        )}
        {uploadError && (
          <Typography sx={{ fontSize: '12px', color: C.danger }}>{uploadError}</Typography>
        )}

        {/* Video preview */}
        {parsed && parsed.type !== 'direct' && (
          <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe src={parsed.embedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; fullscreen" allowFullScreen />
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('durationMin')} type="number" value={f.duration_min} onChange={e => set('duration_min', +e.target.value)} sx={{ ...inputSx, width: 140 }} size="small" />
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
        </Box>
        <FormControlLabel
          control={<Checkbox checked={!!f.is_free_preview} onChange={e => set('is_free_preview', e.target.checked)} sx={{ color: C.primary, '&.Mui-checked': { color: C.primary } }} />}
          label={t('freePreviewLbl')} sx={{ '& .MuiTypography-root': { fontSize: '13px', color: C.text } }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" disabled={uploading} onClick={() => { const { id, created_at, program_id, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// RESOURCES SUB-TAB
// ══════════════════════════════════════════════════════════════
function ResourcesSubTab({ t, onSelectResource }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg]     = useState(null)

  const load = async () => { setItems(await DB.getResources()) }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    if (dlg?.id) await DB.update('resources', dlg.id, data)
    else await DB.insert('resources', data)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('resources', id); showSnackbar(t('deletedMsg')); load() }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('adminResources')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addResource')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noResources')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((r, i) => (
          <Box key={r.id} onClick={() => onSelectResource && onSelectResource(r)} sx={{
            px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
            cursor: 'pointer', '&:hover': { background: C.listHover },
          }}>
            <PlayCircleIcon sx={{ fontSize: 20, color: r.video_url ? C.purple : C.muted, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{r.name_bg}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>
                {r.category_bg || '–'} · {r.duration_min || 0} {t('minutesShort')}
              </Typography>
            </Box>
            <StatusChip status={r.status} t={t} />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDlg(r) }}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); del(r.id) }}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
      </Paper>
      {dlg !== null && <ResourceDialog t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function ResourceDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name_bg: '', name_en: '', description_bg: '', description_en: '',
    video_url: '', thumbnail_url: '', category_bg: '', category_en: '',
    duration_min: 0, display_order: 0, status: 'active',
    ...item,
  })
  const set = (k, v) => {
    setF(p => {
      const next = { ...p, [k]: v }
      // Auto-fill thumbnail when video URL changes and no thumbnail set
      if (k === 'video_url' && !p.thumbnail_url) {
        const thumb = getVideoThumbnail(v)
        if (thumb) next.thumbnail_url = thumb
      }
      return next
    })
  }
  const parsed = parseVideoUrl(f.video_url)

  // Bunny upload state
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  async function handleBunnyUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadPct(0); setUploadError('')
    try {
      const title = f.name_bg || f.name_en || file.name.replace(/\.[^.]+$/, '')
      const createRes = await fetch(`${SUPABASE_URL}/functions/v1/bunny-upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title }),
      })
      if (!createRes.ok) throw new Error('Failed to create video')
      const { uploadUrl, embedUrl, thumbnailUrl, apiKey } = await createRes.json()
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('AccessKey', apiKey)
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)) }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Upload error'))
        xhr.send(file)
      })
      setF(prev => ({ ...prev, video_url: embedUrl, thumbnail_url: thumbnailUrl }))
    } catch (err) { setUploadError(err.message || 'Upload failed') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editResource') : t('addResource')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('descEn')} value={f.description_en} onChange={e => set('description_en', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={`${t('categoryLbl')} BG`} value={f.category_bg} onChange={e => set('category_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={`${t('categoryLbl')} EN`} value={f.category_en} onChange={e => set('category_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField label={t('videoUrl')} value={f.video_url} onChange={e => set('video_url', e.target.value)} fullWidth size="small" sx={inputSx}
            helperText={parsed ? `${parsed.type} ✓` : t('videoUrlHint')} />
          <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleBunnyUpload} />
          <Button variant="outlined" size="small" disabled={uploading} onClick={() => fileRef.current?.click()} startIcon={<UploadSvg />}
            sx={{ mt: 0.5, minWidth: 'auto', whiteSpace: 'nowrap', borderColor: C.border, color: C.muted, px: 1.5, '&:hover': { borderColor: C.purple, color: C.purple } }}>
            {t('uploadVideoBtn')}
          </Button>
        </Box>
        {uploading && (
          <Box>
            <LinearProgress variant="determinate" value={uploadPct} sx={{ height: 6, borderRadius: 3, background: C.border, '& .MuiLinearProgress-bar': { background: C.primary, borderRadius: 3 } }} />
            <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.5 }}>{t('uploadingVideo')} {uploadPct}%</Typography>
          </Box>
        )}
        {uploadError && <Typography sx={{ fontSize: '12px', color: C.danger }}>{uploadError}</Typography>}
        {parsed && parsed.type !== 'direct' && (
          <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe src={parsed.embedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen" allowFullScreen />
          </Box>
        )}
        {/* Thumbnail URL (auto-generated or manual) */}
        <TextField label="Thumbnail URL" value={f.thumbnail_url || ''} onChange={e => set('thumbnail_url', e.target.value)} fullWidth size="small" sx={inputSx}
          helperText={f.thumbnail_url ? '' : 'Auto-generated from video URL'} />
        {f.thumbnail_url && (
          <Box component="img" src={f.thumbnail_url} sx={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: '10px' }}
            onError={(e) => { e.target.style.display = 'none' }} />
        )}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('durationMin')} type="number" value={f.duration_min} onChange={e => set('duration_min', +e.target.value)} sx={{ ...inputSx, width: 140 }} size="small" />
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('statusLbl')}</InputLabel>
            <Select value={f.status} label={t('statusLbl')} onChange={e => set('status', e.target.value)}>
              <MenuItem value="active">{t('statusActive')}</MenuItem>
              <MenuItem value="draft">{t('statusDraft')}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" disabled={uploading} onClick={() => { const { id, created_at, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// RESOURCE STEPS SUB-TAB
// ══════════════════════════════════════════════════════════════
function ResourceStepsSubTab({ t, resourceId }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg]     = useState(null)

  const load = async () => {
    if (!resourceId) { setItems([]); return }
    setItems(await DB.getResourceSteps(resourceId))
  }
  useEffect(() => { load() }, [resourceId])

  const save = async (data) => {
    if (dlg?.id) await DB.update('resource_steps', dlg.id, data)
    else await DB.insert('resource_steps', { ...data, resource_id: resourceId })
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('resource_steps', id); showSnackbar(t('deletedMsg')); load() }

  if (!resourceId) return <Typography sx={{ fontSize: '13px', color: C.muted }}>Избери ресурс</Typography>

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>Стъпки</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({ display_order: items.length })} sx={{ color: C.purple, fontSize: '12px' }}>Нова стъпка</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>Няма стъпки</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((s, i) => (
          <Box key={s.id} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <PlayCircleIcon sx={{ fontSize: 20, color: s.video_url ? C.purple : C.muted, flexShrink: 0 }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{s.name_bg}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>{s.duration_min || 0} {t('minutesShort')} {s.video_url && '· video'}</Typography>
            </Box>
            <IconButton size="small" onClick={() => setDlg(s)}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
            <IconButton size="small" onClick={() => del(s.id)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
      </Paper>
      {dlg !== null && <StepDialog t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function StepDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name_bg: '', name_en: '', description_bg: '', description_en: '',
    video_url: '', thumbnail_url: '', duration_min: 0, display_order: 0,
    ...item,
  })
  const set = (k, v) => {
    setF(p => {
      const next = { ...p, [k]: v }
      if (k === 'video_url' && !p.thumbnail_url) {
        const thumb = getVideoThumbnail(v)
        if (thumb) next.thumbnail_url = thumb
      }
      return next
    })
  }
  const parsed = parseVideoUrl(f.video_url)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef(null)

  async function handleBunnyUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadPct(0); setUploadError('')
    try {
      const title = f.name_bg || f.name_en || file.name.replace(/\.[^.]+$/, '')
      const createRes = await fetch(`${SUPABASE_URL}/functions/v1/bunny-upload`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title }),
      })
      if (!createRes.ok) throw new Error('Failed')
      const { uploadUrl, embedUrl, thumbnailUrl, apiKey } = await createRes.json()
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('AccessKey', apiKey)
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100)) }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'))
        xhr.onerror = () => reject(new Error('Error'))
        xhr.send(file)
      })
      setF(prev => ({ ...prev, video_url: embedUrl, thumbnail_url: thumbnailUrl }))
    } catch (err) { setUploadError(err.message) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? 'Редактирай стъпка' : 'Нова стъпка'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField label={t('videoUrl')} value={f.video_url} onChange={e => set('video_url', e.target.value)} fullWidth size="small" sx={inputSx}
            helperText={parsed ? `${parsed.type} ✓` : t('videoUrlHint')} />
          <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleBunnyUpload} />
          <Button variant="outlined" size="small" disabled={uploading} onClick={() => fileRef.current?.click()} startIcon={<UploadSvg />}
            sx={{ mt: 0.5, minWidth: 'auto', whiteSpace: 'nowrap', borderColor: C.border, color: C.muted, px: 1.5 }}>
            {t('uploadVideoBtn')}
          </Button>
        </Box>
        {uploading && (
          <Box>
            <LinearProgress variant="determinate" value={uploadPct} sx={{ height: 6, borderRadius: 3, background: C.border, '& .MuiLinearProgress-bar': { background: C.primary } }} />
            <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.5 }}>{t('uploadingVideo')} {uploadPct}%</Typography>
          </Box>
        )}
        {uploadError && <Typography sx={{ fontSize: '12px', color: C.danger }}>{uploadError}</Typography>}
        {parsed && parsed.type !== 'direct' && (
          <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe src={parsed.embedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="autoplay; fullscreen" allowFullScreen />
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('durationMin')} type="number" value={f.duration_min} onChange={e => set('duration_min', +e.target.value)} sx={{ ...inputSx, width: 140 }} size="small" />
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" disabled={uploading} onClick={() => { const { id, created_at, resource_id, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN ADMIN PROGRAMS TAB
// ══════════════════════════════════════════════════════════════
export default function AdminProgramsTab() {
  const { t } = useApp()
  const [sub, setSub] = useState('programs')
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedResource, setSelectedResource] = useState(null)
  const [modules, setModules] = useState([])

  useEffect(() => {
    if (!selectedProgram) { setModules([]); return }
    DB.getProgramModules(selectedProgram.id).then(setModules)
  }, [selectedProgram])

  const SUBS = [
    { label: t('adminPrograms'),  key: 'programs' },
    { label: t('programModules'), key: 'modules' },
    { label: t('programLessons'), key: 'lessons' },
    { label: t('adminResources'), key: 'resources' },
    { label: 'Стъпки',           key: 'steps' },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {SUBS.map(({ label, key }) => (
          <Box key={key} onClick={() => setSub(key)} sx={{
            px: 1.75, py: 0.75, borderRadius: '100px', cursor: 'pointer',
            fontSize: '12px', fontWeight: 700,
            background: sub === key ? C.primary : 'transparent',
            color: sub === key ? C.primaryOn : C.text,
            border: `1px solid ${sub === key ? C.primary : C.loganBorder}`,
            transition: 'all 0.22s',
            '&:hover': sub === key ? {} : { borderColor: C.logan, background: C.loganDeep },
          }}>
            {label}
          </Box>
        ))}

        {selectedProgram && (
          <Chip label={selectedProgram.name_bg} size="small" onDelete={() => setSelectedProgram(null)}
            sx={{ ml: 1, background: C.primaryContainer, color: C.text, fontWeight: 700 }} />
        )}
        {selectedResource && (
          <Chip label={selectedResource.name_bg} size="small" onDelete={() => setSelectedResource(null)}
            sx={{ ml: 0.5, background: 'rgba(200,197,255,0.12)', color: '#C8C5FF', fontWeight: 700 }} />
        )}
      </Box>

      {sub === 'programs' && (
        <ProgramsSubTab t={t}
          onSelectProgram={(p) => { setSelectedProgram(p); setSub('modules') }}
          selectedProgramId={selectedProgram?.id} />
      )}
      {sub === 'modules' && <ModulesSubTab t={t} programId={selectedProgram?.id} />}
      {sub === 'lessons' && <LessonsSubTab t={t} programId={selectedProgram?.id} modules={modules} />}
      {sub === 'resources' && (
        <ResourcesSubTab t={t} onSelectResource={(r) => { setSelectedResource(r); setSub('steps') }} />
      )}
      {sub === 'steps' && <ResourceStepsSubTab t={t} resourceId={selectedResource?.id} />}
    </Box>
  )
}
