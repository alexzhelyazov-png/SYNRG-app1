import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, Checkbox, FormControlLabel,
} from '@mui/material'
import AddIcon               from '@mui/icons-material/Add'
import EditIcon              from '@mui/icons-material/Edit'
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline'
import StarIcon              from '@mui/icons-material/Star'
import VisibilityOffIcon     from '@mui/icons-material/VisibilityOff'
import { C }                 from '../theme'
import { DB }                from '../lib/db'
import { useApp }            from '../context/AppContext'

// ── Shared input style ───────────────────────────────────────
const inputSx = {
  '& .MuiInputBase-input': { color: C.text },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
  '& .MuiInputLabel-root': { color: C.muted },
}

// ── Status chip ──────────────────────────────────────────────
function StatusChip({ status, t }) {
  const map = {
    active:      { label: t('statusActive'),     bg: 'rgba(170,169,205,0.15)', color: '#C8C5FF' },
    coming_soon: { label: t('statusComingSoon'),  bg: 'rgba(251,146,60,0.15)',  color: '#FB923C' },
    archived:    { label: t('statusArchived'),    bg: 'rgba(138,135,133,0.15)', color: '#8A8785' },
    new:         { label: t('inquiryNew'),        bg: 'rgba(248,113,113,0.15)', color: '#F87171' },
    contacted:   { label: t('inquiryContacted'),  bg: 'rgba(251,146,60,0.15)',  color: '#FB923C' },
    closed:      { label: t('inquiryClosed'),     bg: 'rgba(170,169,205,0.15)', color: '#C8C5FF' },
  }
  const m = map[status] || map.active
  return <Chip label={m.label} size="small" sx={{ background: m.bg, color: m.color, fontWeight: 700, fontSize: '11px', height: '24px' }} />
}

// ══════════════════════════════════════════════════════════════
// PRODUCTS SUB-TAB
// ══════════════════════════════════════════════════════════════
function ProductsTab({ t }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg] = useState(null)    // null | {} for new | product for edit

  const load = async () => { setItems(await DB.getSiteItems('site_products')) }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    if (dlg?.id) await DB.update('site_products', dlg.id, { ...data, updated_at: new Date().toISOString() })
    else await DB.insert('site_products', data)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('site_products', id); showSnackbar(t('deletedMsg')); load() }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('siteProducts')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addProduct')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noProducts')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((p, i) => (
          <Box key={p.id} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 700, width: 24 }}>{String(p.display_order + 1).padStart(2, '0')}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{p.name_bg}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>{p.name_en} · {p.price_cents / 100} {p.currency}</Typography>
            </Box>
            {p.is_featured && <StarIcon sx={{ fontSize: 16, color: '#FBBF24' }} />}
            <StatusChip status={p.status} t={t} />
            <IconButton size="small" onClick={() => setDlg(p)}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
            <IconButton size="small" onClick={() => del(p.id)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
      </Paper>
      {dlg !== null && <ProductDialog open t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function ProductDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name_bg: '', name_en: '', description_bg: '', description_en: '',
    tag_bg: '', tag_en: '', price_cents: 0, currency: 'BGN',
    stripe_price_id: '', status: 'active', is_featured: false, display_order: 0,
    ...item,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editProduct') : t('addProduct')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('descEn')} value={f.description_en} onChange={e => set('description_en', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('tagBg')} value={f.tag_bg} onChange={e => set('tag_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('tagEn')} value={f.tag_en} onChange={e => set('tag_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('priceCents')} type="number" value={f.price_cents} onChange={e => set('price_cents', +e.target.value)} fullWidth size="small" sx={inputSx} />
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('currencyLbl')}</InputLabel>
            <Select value={f.currency} label={t('currencyLbl')} onChange={e => set('currency', e.target.value)}>
              <MenuItem value="BGN">BGN</MenuItem>
              <MenuItem value="EUR">EUR</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <TextField label={t('stripePriceId')} value={f.stripe_price_id || ''} onChange={e => set('stripe_price_id', e.target.value)} fullWidth size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('statusLbl')}</InputLabel>
            <Select value={f.status} label={t('statusLbl')} onChange={e => set('status', e.target.value)}>
              <MenuItem value="active">{t('statusActive')}</MenuItem>
              <MenuItem value="coming_soon">{t('statusComingSoon')}</MenuItem>
              <MenuItem value="archived">{t('statusArchived')}</MenuItem>
            </Select>
          </FormControl>
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <FormControlLabel control={<Checkbox checked={!!f.is_featured} onChange={e => set('is_featured', e.target.checked)} sx={{ color: C.primary, '&.Mui-checked': { color: C.primary } }} />} label={t('featuredLbl')} sx={{ '& .MuiTypography-root': { fontSize: '13px', color: C.text } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => { const { id, created_at, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// PLANS SUB-TAB
// ══════════════════════════════════════════════════════════════
function PlansTab({ t }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg] = useState(null)

  const load = async () => { setItems(await DB.getSiteItems('site_plans')) }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    if (typeof data.features === 'string') try { data.features = JSON.parse(data.features) } catch { data.features = [] }
    if (dlg?.id) await DB.update('site_plans', dlg.id, { ...data, updated_at: new Date().toISOString() })
    else await DB.insert('site_plans', data)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('site_plans', id); showSnackbar(t('deletedMsg')); load() }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('sitePlans')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addPlan')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noPlans')}</Typography>}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {items.map(p => (
          <Paper key={p.id} sx={{ flex: '1 1 200px', maxWidth: 280, p: 2, borderRadius: '16px', border: p.is_featured ? `1px solid rgba(170,169,205,0.3)` : undefined }}>
            {p.badge_bg && <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#FBBF24', mb: 0.5 }}>{p.badge_bg}</Typography>}
            <Typography sx={{ fontWeight: 700, fontSize: '16px', color: C.text, mb: 0.5 }}>{p.name_bg}</Typography>
            <Typography sx={{ fontSize: '28px', fontWeight: 800, color: C.text }}>{p.sessions_count}</Typography>
            <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1 }}>{p.sessions_label_bg}</Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 700, color: C.text }}>€{p.price_eur}</Typography>
            <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1.5 }}>{p.price_bgn_text_bg}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <IconButton size="small" onClick={() => setDlg(p)}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
              <IconButton size="small" onClick={() => del(p.id)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
            </Box>
          </Paper>
        ))}
      </Box>
      {dlg !== null && <PlanDialog open t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function PlanDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    slug: '', name_bg: '', name_en: '', sessions_count: '8',
    sessions_label_bg: 'тренировки / месец', sessions_label_en: 'sessions / month',
    price_eur: 0, price_bgn_text_bg: '', price_bgn_text_en: '',
    badge_bg: '', badge_en: '', is_featured: false, display_order: 0,
    ...item,
    features: (item?.features && Array.isArray(item.features)) ? item.features : [],
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const feats = Array.isArray(f.features) ? f.features : []
  const setFeat = (i, lang, val) => {
    const next = [...feats]; next[i] = { ...next[i], [lang]: val }; set('features', next)
  }
  const addFeat = () => set('features', [...feats, { bg: '', en: '' }])
  const rmFeat = (i) => set('features', feats.filter((_, j) => j !== i))

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editPlan') : t('addPlan')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <TextField label={t('slugLbl')} value={f.slug} onChange={e => set('slug', e.target.value)} fullWidth size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('sessionsCount')} value={f.sessions_count} onChange={e => set('sessions_count', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('priceEur')} type="number" value={f.price_eur} onChange={e => set('price_eur', +e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('sessionsLabel') + ' (BG)'} value={f.sessions_label_bg} onChange={e => set('sessions_label_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('sessionsLabel') + ' (EN)'} value={f.sessions_label_en} onChange={e => set('sessions_label_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('priceBgnText') + ' (BG)'} value={f.price_bgn_text_bg} onChange={e => set('price_bgn_text_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('priceBgnText') + ' (EN)'} value={f.price_bgn_text_en} onChange={e => set('price_bgn_text_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('badgeBg')} value={f.badge_bg || ''} onChange={e => set('badge_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('badgeEn')} value={f.badge_en || ''} onChange={e => set('badge_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
          <FormControlLabel control={<Checkbox checked={!!f.is_featured} onChange={e => set('is_featured', e.target.checked)} sx={{ color: C.primary, '&.Mui-checked': { color: C.primary } }} />} label={t('featuredLbl')} sx={{ '& .MuiTypography-root': { fontSize: '13px', color: C.text } }} />
        </Box>

        {/* Features editor */}
        <Typography sx={{ fontWeight: 700, fontSize: '13px', color: C.text, mt: 1 }}>{t('features')}</Typography>
        {feats.map((feat, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField label={t('featureBg')} value={feat.bg || ''} onChange={e => setFeat(i, 'bg', e.target.value)} fullWidth size="small" sx={inputSx} />
            <TextField label={t('featureEn')} value={feat.en || ''} onChange={e => setFeat(i, 'en', e.target.value)} fullWidth size="small" sx={inputSx} />
            <IconButton size="small" onClick={() => rmFeat(i)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
        <Button size="small" onClick={addFeat} sx={{ color: C.purple, fontSize: '12px', alignSelf: 'flex-start' }}>{t('addFeature')}</Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => { const { id, created_at, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// TEAM SUB-TAB
// ══════════════════════════════════════════════════════════════
function TeamTab({ t }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg] = useState(null)

  const load = async () => { setItems(await DB.getSiteItems('site_team_members')) }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    if (dlg?.id) await DB.update('site_team_members', dlg.id, { ...data, updated_at: new Date().toISOString() })
    else await DB.insert('site_team_members', data)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('site_team_members', id); showSnackbar(t('deletedMsg')); load() }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('siteTeam')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addTeamMember')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noTeamMembers')}</Typography>}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {items.map(m => (
          <Paper key={m.id} sx={{ width: 160, p: 1.5, borderRadius: '14px', textAlign: 'center', position: 'relative' }}>
            {!m.is_visible && <VisibilityOffIcon sx={{ position: 'absolute', top: 8, right: 8, fontSize: 14, color: C.muted }} />}
            {m.photo_url && <Box component="img" src={m.photo_url} sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', mb: 1, border: `2px solid ${C.border}` }} />}
            <Typography sx={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{m.name}</Typography>
            <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>{m.role_bg}</Typography>
            <Chip label={m.badge_text} size="small" sx={{ height: '20px', fontSize: '10px', fontWeight: 700, background: m.badge_style === 'mint' ? 'rgba(170,169,205,0.15)' : 'rgba(255,255,255,0.06)', color: m.badge_style === 'mint' ? C.text : C.muted }} />
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mt: 1 }}>
              <IconButton size="small" onClick={() => setDlg(m)}><EditIcon sx={{ fontSize: 14, color: C.muted }} /></IconButton>
              <IconButton size="small" onClick={() => del(m.id)}><DeleteOutlineIcon sx={{ fontSize: 14, color: C.danger }} /></IconButton>
            </Box>
          </Paper>
        ))}
      </Box>
      {dlg !== null && <TeamDialog open t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function TeamDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name: '', role_bg: '', role_en: '', photo_url: '',
    badge_text: 'Coach', badge_style: 'default', display_order: 0, is_visible: true,
    ...item,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editTeamMember') : t('addTeamMember')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <TextField label={t('nameBg')} value={f.name} onChange={e => set('name', e.target.value)} fullWidth size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('roleBg')} value={f.role_bg} onChange={e => set('role_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('roleEn')} value={f.role_en} onChange={e => set('role_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('photoUrl')} value={f.photo_url} onChange={e => set('photo_url', e.target.value)} fullWidth size="small" sx={inputSx} />
        {f.photo_url && <Box component="img" src={f.photo_url} sx={{ width: 80, height: 80, borderRadius: '12px', objectFit: 'cover' }} />}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('badgeText')} value={f.badge_text} onChange={e => set('badge_text', e.target.value)} fullWidth size="small" sx={inputSx} />
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('badgeStyle')}</InputLabel>
            <Select value={f.badge_style} label={t('badgeStyle')} onChange={e => set('badge_style', e.target.value)}>
              <MenuItem value="default">Default</MenuItem>
              <MenuItem value="mint">Mint</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
          <FormControlLabel control={<Checkbox checked={!!f.is_visible} onChange={e => set('is_visible', e.target.checked)} sx={{ color: C.primary, '&.Mui-checked': { color: C.primary } }} />} label={t('visibleLbl')} sx={{ '& .MuiTypography-root': { fontSize: '13px', color: C.text } }} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => { const { id, created_at, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// SERVICES SUB-TAB
// ══════════════════════════════════════════════════════════════
function ServicesTab({ t }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [dlg, setDlg] = useState(null)

  const load = async () => { setItems(await DB.getSiteItems('site_services')) }
  useEffect(() => { load() }, [])

  const save = async (data) => {
    if (dlg?.id) await DB.update('site_services', dlg.id, { ...data, updated_at: new Date().toISOString() })
    else await DB.insert('site_services', data)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }
  const del = async (id) => { await DB.deleteById('site_services', id); showSnackbar(t('deletedMsg')); load() }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{t('siteServices')}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDlg({})} sx={{ color: C.purple, fontSize: '12px' }}>{t('addService')}</Button>
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noServices')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((s, i) => (
          <Box key={s.id} sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 700, width: 24 }}>{String(s.display_order + 1).padStart(2, '0')}</Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{s.name_bg}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>{s.name_en}</Typography>
            </Box>
            {s.is_featured && <StarIcon sx={{ fontSize: 16, color: '#FBBF24' }} />}
            <StatusChip status={s.status} t={t} />
            <IconButton size="small" onClick={() => setDlg(s)}><EditIcon sx={{ fontSize: 16, color: C.muted }} /></IconButton>
            <IconButton size="small" onClick={() => del(s.id)}><DeleteOutlineIcon sx={{ fontSize: 16, color: C.danger }} /></IconButton>
          </Box>
        ))}
      </Paper>
      {dlg !== null && <ServiceDialog open t={t} item={dlg} onClose={() => setDlg(null)} onSave={save} />}
    </Box>
  )
}

function ServiceDialog({ t, item, onClose, onSave }) {
  const [f, setF] = useState({
    name_bg: '', name_en: '', description_bg: '', description_en: '',
    link_url: '', link_text_bg: '', link_text_en: '',
    status: 'active', is_featured: false, display_order: 0,
    ...item,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item?.id ? t('editService') : t('addService')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('nameBg')} value={f.name_bg} onChange={e => set('name_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('nameEn')} value={f.name_en} onChange={e => set('name_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <TextField label={t('descBg')} value={f.description_bg} onChange={e => set('description_bg', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('descEn')} value={f.description_en} onChange={e => set('description_en', e.target.value)} fullWidth multiline rows={2} size="small" sx={inputSx} />
        <TextField label={t('linkUrl')} value={f.link_url || ''} onChange={e => set('link_url', e.target.value)} fullWidth size="small" sx={inputSx} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('linkTextBg')} value={f.link_text_bg || ''} onChange={e => set('link_text_bg', e.target.value)} fullWidth size="small" sx={inputSx} />
          <TextField label={t('linkTextEn')} value={f.link_text_en || ''} onChange={e => set('link_text_en', e.target.value)} fullWidth size="small" sx={inputSx} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" fullWidth sx={inputSx}>
            <InputLabel>{t('statusLbl')}</InputLabel>
            <Select value={f.status} label={t('statusLbl')} onChange={e => set('status', e.target.value)}>
              <MenuItem value="active">{t('statusActive')}</MenuItem>
              <MenuItem value="coming_soon">{t('statusComingSoon')}</MenuItem>
              <MenuItem value="archived">{t('statusArchived')}</MenuItem>
            </Select>
          </FormControl>
          <TextField label={t('orderLbl')} type="number" value={f.display_order} onChange={e => set('display_order', +e.target.value)} sx={{ ...inputSx, width: 100 }} size="small" />
        </Box>
        <FormControlLabel control={<Checkbox checked={!!f.is_featured} onChange={e => set('is_featured', e.target.checked)} sx={{ color: C.primary, '&.Mui-checked': { color: C.primary } }} />} label={t('featuredLbl')} sx={{ '& .MuiTypography-root': { fontSize: '13px', color: C.text } }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => { const { id, created_at, ...data } = f; onSave(data) }}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// INQUIRIES SUB-TAB
// ══════════════════════════════════════════════════════════════
function InquiriesTab({ t }) {
  const { showSnackbar } = useApp()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState(null)
  const [dlg, setDlg] = useState(null)

  const load = async () => { setItems(await DB.getInquiries(filter)) }
  useEffect(() => { load() }, [filter])

  const updateInquiry = async (id, patch) => {
    await DB.update('inquiries', id, patch)
    showSnackbar(t('savedMsg'))
    setDlg(null); load()
  }

  const filters = [
    { label: t('inquiryAll'), value: null },
    { label: t('inquiryNew'), value: 'new' },
    { label: t('inquiryContacted'), value: 'contacted' },
    { label: t('inquiryClosed'), value: 'closed' },
  ]

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, mb: 1.5 }}>{t('siteInquiries')}</Typography>
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <Box key={f.label} onClick={() => setFilter(f.value)} sx={{
            px: 1.5, py: 0.5, borderRadius: '100px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            background: filter === f.value ? C.primary : 'transparent',
            color: filter === f.value ? C.primaryOn : C.text,
            border: `1px solid ${filter === f.value ? C.primary : C.loganBorder}`,
            transition: 'all 0.22s',
            '&:hover': filter === f.value ? {} : { borderColor: C.logan, background: C.loganDeep },
          }}>{f.label}</Box>
        ))}
      </Box>
      {items.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noInquiries')}</Typography>}
      <Paper sx={{ borderRadius: '14px', overflow: 'hidden' }}>
        {items.map((inq, i) => (
          <Box key={inq.id} onClick={() => setDlg(inq)} sx={{
            px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
            borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none',
            '&:hover': { background: C.listHover },
          }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{inq.name}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>{inq.contact} · {new Date(inq.created_at).toLocaleDateString('bg')}</Typography>
              {inq.message && <Typography sx={{ fontSize: '12px', color: C.muted, mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{inq.message}</Typography>}
            </Box>
            <StatusChip status={inq.status || 'new'} t={t} />
          </Box>
        ))}
      </Paper>
      {dlg && (
        <InquiryDialog t={t} item={dlg} onClose={() => setDlg(null)} onSave={(id, patch) => updateInquiry(id, patch)} />
      )}
    </Box>
  )
}

function InquiryDialog({ t, item, onClose, onSave }) {
  const [status, setStatus] = useState(item.status || 'new')
  const [notes, setNotes] = useState(item.notes || '')
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item.name}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted, mb: 0.3 }}>{t('contactLbl')}</Typography>
          <Typography sx={{ fontSize: '14px', color: C.text }}>{item.contact}</Typography>
        </Box>
        {item.message && (
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted, mb: 0.3 }}>{t('messageLbl')}</Typography>
            <Typography sx={{ fontSize: '14px', color: C.text, whiteSpace: 'pre-wrap' }}>{item.message}</Typography>
          </Box>
        )}
        <Typography sx={{ fontSize: '11px', color: C.muted }}>{new Date(item.created_at).toLocaleString('bg')}</Typography>
        <FormControl size="small" fullWidth sx={inputSx}>
          <InputLabel>{t('statusLbl')}</InputLabel>
          <Select value={status} label={t('statusLbl')} onChange={e => setStatus(e.target.value)}>
            <MenuItem value="new">{t('inquiryNew')}</MenuItem>
            <MenuItem value="contacted">{t('inquiryContacted')}</MenuItem>
            <MenuItem value="closed">{t('inquiryClosed')}</MenuItem>
          </Select>
        </FormControl>
        <TextField label={t('notesLbl')} value={notes} onChange={e => setNotes(e.target.value)} fullWidth multiline rows={3} size="small" sx={inputSx} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={() => onSave(item.id, { status, notes })}>{t('saveBtn')}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ══════════════════════════════════════════════════════════════
// CONTENT BLOCKS SUB-TAB
// ══════════════════════════════════════════════════════════════
function ContentTab({ t }) {
  const { showSnackbar } = useApp()
  const [blocks, setBlocks] = useState([])
  const [edits, setEdits] = useState({})

  const load = async () => {
    const all = await DB.selectAll('site_content_blocks')
    setBlocks(all.sort((a, b) => `${a.page}${a.section}${a.block_key}`.localeCompare(`${b.page}${b.section}${b.block_key}`)))
  }
  useEffect(() => { load() }, [])

  const saveBlock = async (block) => {
    const editKey = block.id
    const bg = edits[editKey]?.bg ?? block.value_bg
    const en = edits[editKey]?.en ?? block.value_en
    await DB.upsertContentBlock(block.page, block.section, block.block_key, bg, en)
    showSnackbar(t('savedMsg'))
    setEdits(prev => { const next = { ...prev }; delete next[editKey]; return next })
    load()
  }

  // Group by page then section
  const grouped = {}
  blocks.forEach(b => {
    if (!grouped[b.page]) grouped[b.page] = {}
    if (!grouped[b.page][b.section]) grouped[b.page][b.section] = []
    grouped[b.page][b.section].push(b)
  })

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, mb: 1.5 }}>{t('siteContent')}</Typography>
      {blocks.length === 0 && <Typography sx={{ fontSize: '13px', color: C.muted }}>No content blocks yet. Seed data will appear after running the migration.</Typography>}
      {Object.entries(grouped).map(([page, sections]) => (
        <Box key={page} sx={{ mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '13px', color: C.text, mb: 1 }}>{page}</Typography>
          {Object.entries(sections).map(([section, items]) => (
            <Paper key={section} sx={{ borderRadius: '14px', p: 2, mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '12px', color: C.muted, mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{section}</Typography>
              {items.map(b => {
                const editKey = b.id
                const bgVal = edits[editKey]?.bg ?? b.value_bg
                const enVal = edits[editKey]?.en ?? b.value_en
                const changed = edits[editKey] !== undefined
                return (
                  <Box key={b.id} sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: C.muted, mb: 0.5 }}>{b.block_key}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField label="BG" value={bgVal} onChange={e => setEdits(prev => ({ ...prev, [editKey]: { ...(prev[editKey] || {}), bg: e.target.value } }))} fullWidth size="small" multiline sx={inputSx} />
                      <TextField label="EN" value={enVal} onChange={e => setEdits(prev => ({ ...prev, [editKey]: { ...(prev[editKey] || {}), en: e.target.value } }))} fullWidth size="small" multiline sx={inputSx} />
                      {changed && <Button size="small" variant="contained" onClick={() => saveBlock(b)} sx={{ minWidth: 60 }}>{t('saveBtn')}</Button>}
                    </Box>
                  </Box>
                )
              })}
            </Paper>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN SITE TAB (exported)
// ══════════════════════════════════════════════════════════════
export default function SiteTab() {
  const { t } = useApp()
  const [sub, setSub] = useState('products')

  const SUBS = [
    { label: t('siteProducts'),  key: 'products' },
    { label: t('sitePlans'),     key: 'plans' },
    { label: t('siteTeam'),      key: 'team' },
    { label: t('siteServices'),  key: 'services' },
    { label: t('siteInquiries'), key: 'inquiries' },
    { label: t('siteContent'),   key: 'content' },
  ]

  return (
    <Box>
      {/* Sub-tab navigation */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2.5, flexWrap: 'wrap' }}>
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
      </Box>

      {/* Sub-tab content */}
      {sub === 'products'  && <ProductsTab t={t} />}
      {sub === 'plans'     && <PlansTab t={t} />}
      {sub === 'team'      && <TeamTab t={t} />}
      {sub === 'services'  && <ServicesTab t={t} />}
      {sub === 'inquiries' && <InquiriesTab t={t} />}
      {sub === 'content'   && <ContentTab t={t} />}
    </Box>
  )
}
