import { useEffect, useState } from 'react'
import {
  AppBar, Toolbar, Box, Typography, IconButton, Button, Badge, Dialog,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider,
  CircularProgress, TextField,
} from '@mui/material'
import MenuIcon             from '@mui/icons-material/Menu'
import CloseIcon            from '@mui/icons-material/Close'
import LogoutIcon           from '@mui/icons-material/Logout'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import FitnessCenterIcon    from '@mui/icons-material/FitnessCenter'
import DirectionsRunIcon    from '@mui/icons-material/DirectionsRun'
import HomeIcon             from '@mui/icons-material/Home'
import StorefrontIcon       from '@mui/icons-material/Storefront'
import OndemandVideoIcon    from '@mui/icons-material/OndemandVideo'
import AttachMoneyIcon      from '@mui/icons-material/AttachMoney'
import { useApp } from '../context/AppContext'
import { useBooking } from '../context/BookingContext'
import { DB } from '../lib/db'
import { hasModule } from '../lib/modules'
import { creditsRemaining, daysUntilExpiry, fmtValidTo, isAdmin as isAdminUser } from '../lib/bookingUtils'
import { C, EASE } from '../theme'
import SynrgLogo from './SynrgLogo'

// Relative links from /synrg-website/app/ back to /synrg-website/
const SITE_BASE = '../'

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches

function getSiteLinks(t) {
  return [
    { href: `${SITE_BASE}index.html`,      label: t('siteHome'),      Icon: HomeIcon },
    { href: `${SITE_BASE}studio.html`,      label: t('siteStudio'),    Icon: StorefrontIcon },
    { href: `${SITE_BASE}remote.html`,      label: t('sitePrograms'),  Icon: OndemandVideoIcon },
    { href: `${SITE_BASE}pricing.html`,     label: t('sitePricing'),   Icon: AttachMoneyIcon },
  ]
}

export default function MobileHeader() {
  const { auth, logout, client, lang, setLang, setView, coachClientMode, setCoachClientMode, setViewingCoach, unreadNotifCount, unreadCoachMsgCount, t, saveWorkoutDraft } = useApp()
  const hasCoachChat = auth.role === 'client' && hasModule(auth.modules, 'synrg_method')
  // Non-admin coach (e.g. Ицко) gets a shortcut icon to the messages tab
  const isNonAdminCoach = auth.role === 'coach' && !isAdminUser(auth)
  const { myPlan } = useBooking()
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  // Online program purchase (Stripe). Loaded only when the profile dialog opens
  // so we avoid unnecessary network roundtrips for users who never tap it.
  const [onlineProgram, setOnlineProgram] = useState(null)
  useEffect(() => {
    if (!showProfile || !auth?.id || auth.role !== 'client') return
    let cancelled = false
    DB.findWhere('program_purchases', 'client_id', auth.id)
      .then(rows => {
        if (cancelled) return
        const active = (rows || [])
          .filter(p => p.status === 'active')
          .sort((a, b) => (b.purchased_at || '').localeCompare(a.purchased_at || ''))[0]
        setOnlineProgram(active || null)
      })
      .catch(() => { if (!cancelled) setOnlineProgram(null) })
    return () => { cancelled = true }
  }, [showProfile, auth?.id, auth?.role])

  const siteLinks = getSiteLinks(t)

  return (
    <>
      <AppBar position="sticky" sx={{ top: 0, zIndex: 40 }}>
        <Toolbar sx={{ paddingTop: 'env(safe-area-inset-top)', gap: 1 }}>

          {/* ── Hamburger: site navigation (hidden in standalone PWA) ── */}
          {!isStandalone && (
            <IconButton
              onClick={() => setSiteMenuOpen(true)}
              size="small"
              aria-label={t('siteMenu')}
              sx={{
                color:      C.muted,
                flexShrink: 0,
                mr:         0.5,
                transition: `color 0.18s ${EASE.standard}`,
                '&:hover':  { color: C.text },
              }}
            >
              <MenuIcon sx={{ fontSize: 22 }} />
            </IconButton>
          )}

          {/* ── Leading: avatar + name ──────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            {/* Role avatar — clickable for clients */}
            <Box
              onClick={auth.role === 'client' ? () => setShowProfile(true) : undefined}
              sx={{
                width:          40,
                height:         40,
                borderRadius:   '12px',
                background:     auth.role === 'coach' ? C.primaryContainer : C.purpleSoft,
                border:         `1px solid ${auth.role === 'coach' ? 'rgba(170,169,205,0.2)' : 'rgba(200,197,255,0.2)'}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
                cursor:         auth.role === 'client' ? 'pointer' : 'default',
              }}>
              {auth.role === 'coach'
                ? <FitnessCenterIcon sx={{ fontSize: '20px', color: C.purple }} />
                : <DirectionsRunIcon sx={{ fontSize: '20px', color: C.purple }} />
              }
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '15px', lineHeight: 1.2, color: C.text }}>
                {auth.name}
              </Typography>
              {auth.role === 'coach' && client?.name ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="overline" sx={{ color: C.text, lineHeight: 1 }}>
                    {t('coachRole')}
                  </Typography>
                  <Typography variant="overline" sx={{ color: C.muted, lineHeight: 1 }}>·</Typography>
                  <Typography variant="overline" sx={{ color: C.muted, lineHeight: 1 }}>
                    {client.name}
                  </Typography>
                </Box>
              ) : (
                <Typography variant="overline" sx={{
                  color:      C.purple,
                  lineHeight: 1,
                }}>
                  {auth.role === 'coach' ? t('coachRole') : t('clientRole')}
                </Typography>
              )}
            </Box>
          </Box>

          {/* ── Coach chat (SYNRG Метод clients + non-admin coaches) ──────── */}
          {(hasCoachChat || isNonAdminCoach) && (
            <IconButton
              onClick={() => setView(hasCoachChat ? 'coach_chat' : 'coach_chat_admin')}
              size="small"
              aria-label={hasCoachChat ? 'Треньор' : 'Съобщения'}
              sx={{
                color:      unreadCoachMsgCount > 0 ? C.purple : C.muted,
                flexShrink: 0,
                transition: `color 0.18s ${EASE.standard}`,
                '&:hover':  { color: C.purple },
              }}
            >
              <Badge badgeContent={unreadCoachMsgCount} color="error" max={9}>
                <ChatBubbleOutlineIcon sx={{ fontSize: 22 }} />
              </Badge>
            </IconButton>
          )}

          {/* ── Notifications (coach only) ──────────────────── */}
          {auth.role === 'coach' && (
            <IconButton
              onClick={() => { if (coachClientMode && client?.id) saveWorkoutDraft(client.id); setView('notifications'); setCoachClientMode(false); setViewingCoach(null) }}
              size="small"
              aria-label={t('navNotifications')}
              sx={{
                color:      unreadNotifCount > 0 ? C.purple : C.muted,
                flexShrink: 0,
                transition: `color 0.18s ${EASE.standard}`,
                '&:hover':  { color: C.purple },
              }}
            >
              <Badge badgeContent={unreadNotifCount} color="error" max={9}>
                <NotificationsNoneIcon sx={{ fontSize: 22 }} />
              </Badge>
            </IconButton>
          )}

          {/* ── Language toggle ───────────────────────────────── */}
          <Button
            onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
            size="small"
            sx={{
              minWidth:     '36px',
              py:           '5px',
              px:           1,
              fontSize:     '11px',
              fontWeight:   700,
              letterSpacing:'0.5px',
              borderRadius: '8px',
              color:        C.muted,
              border:       `1px solid ${C.border}`,
              flexShrink:   0,
              transition:   `all 0.18s ${EASE.standard}`,
              '&:hover':    { color: C.purple, borderColor: 'rgba(200,197,255,0.3)' },
            }}
          >
            {lang === 'bg' ? 'EN' : 'BG'}
          </Button>

          {/* ── Trailing: logout icon button ────────────────── */}
          <IconButton
            onClick={logout}
            size="medium"
            aria-label={t('navLogout')}
            sx={{
              color:   C.muted,
              flexShrink: 0,
              '&:hover': { color: C.danger, bgcolor: 'rgba(255,107,157,0.08)' },
            }}
          >
            <LogoutIcon sx={{ fontSize: 22 }} />
          </IconButton>

        </Toolbar>
      </AppBar>

      {/* ── Site navigation drawer ──────────────────────────── */}
      {!isStandalone && (
        <Drawer
          anchor="left"
          open={siteMenuOpen}
          onClose={() => setSiteMenuOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width:       '280px',
              background:  C.sidebar,
              borderRight: `1px solid ${C.border}`,
            },
          }}
        >
          <Box sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Header: logo + close */}
            <Box sx={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              mb:             3,
            }}>
              <Box component="a" href={`${SITE_BASE}index.html`} sx={{ display: 'flex', alignItems: 'center' }}>
                <SynrgLogo width={120} />
              </Box>
              <IconButton
                onClick={() => setSiteMenuOpen(false)}
                size="small"
                sx={{ color: C.muted, '&:hover': { color: C.text } }}
              >
                <CloseIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Box>

            {/* Site links */}
            <List sx={{ flex: 1 }}>
              {siteLinks.map(link => (
                <ListItemButton
                  key={link.href}
                  component="a"
                  href={link.href}
                  sx={{ borderRadius: '12px', mb: 0.5, py: 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: C.muted }}>
                    <link.Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={link.label}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontStyle:  'italic',
                        fontWeight: 700,
                        fontSize:   '15px',
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>

          </Box>
        </Drawer>
      )}

      {/* ── Client profile dialog ─────────────────────────── */}
      {auth.role === 'client' && (
        <Dialog
          open={showProfile}
          onClose={() => setShowProfile(false)}
          PaperProps={{ sx: { borderRadius: '20px', maxWidth: '380px', width: '100%', p: 3 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px',
              background: C.purpleSoft, border: '1px solid rgba(200,197,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DirectionsRunIcon sx={{ fontSize: '22px', color: C.purple }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '17px', color: C.text }}>{auth.name}</Typography>
              <Typography sx={{ fontSize: '12px', color: C.muted }}>{t('clientRole')}</Typography>
            </Box>
          </Box>

          {client?.email && (
            <ProfileRow label={t('emailLbl')} value={client.email} />
          )}

          {myPlan ? (
            <>
              <ProfileRow label={t('planLbl')}
                value={myPlan.plan_type === 'unlimited' ? 'Unlimited' : `${myPlan.plan_type} ${t('remainingSessionsLbl') || 'sessions'}`}
                color={C.purple} />
              {myPlan.plan_type !== 'unlimited' && (
                <ProfileRow label={t('creditsLbl')}
                  value={`${creditsRemaining(myPlan)} / ${myPlan.credits_total}`}
                  color={creditsRemaining(myPlan) <= 2 ? '#F87171' : C.purple} />
              )}
              <ProfileRow label={t('validToLbl')}
                value={fmtValidTo(myPlan)}
                color={daysUntilExpiry(myPlan) <= 3 ? '#F87171' : daysUntilExpiry(myPlan) <= 7 ? '#FB923C' : C.text} />
            </>
          ) : onlineProgram ? (
            <>
              <ProfileRow label={t('planLbl')} value="SYNRG Метод · Онлайн" color="#c4e9bf" />
              {onlineProgram.valid_until && (
                <ProfileRow label={t('validToLbl')} value={onlineProgram.valid_until} color={C.text} />
              )}
            </>
          ) : (
            <ProfileRow label={t('planLbl')} value={t('noPlanLbl')} color="#F87171" />
          )}

          {auth.modules?.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted, mb: 0.5, letterSpacing: '0.08em' }}>
                {t('modulesLbl')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {auth.modules.map(m => (
                  <Box key={m} sx={{
                    px: 1, py: '3px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                    background: C.accentSoft, color: C.text, border: `1px solid ${C.primaryA20}`,
                  }}>
                    {m.replace(/_/g, ' ')}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Help & legal links — visible to every logged-in user. Refund / privacy /
              terms must be reachable from inside the app per consumer-protection rules. */}
          <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${C.border}` }}>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted, mb: 1, letterSpacing: '0.08em' }}>
              {lang === 'en' ? 'HELP & POLICIES' : 'ПОМОЩ И УСЛОВИЯ'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[
                onlineProgram && {
                  href: `${SITE_BASE}refund.html`,
                  label: lang === 'en' ? 'Request refund' : 'Заяви възстановяване на сума',
                  highlight: true,
                },
                {
                  href: `${SITE_BASE}refund.html`,
                  label: lang === 'en' ? 'Refund policy' : 'Политика за връщане',
                  hideIf: !!onlineProgram, // already shown as "Request refund" above
                },
                { href: `${SITE_BASE}terms.html`,   label: lang === 'en' ? 'Terms of service' : 'Общи условия' },
                { href: `${SITE_BASE}privacy.html`, label: lang === 'en' ? 'Privacy policy'   : 'Политика за поверителност' },
                { href: 'mailto:info@synrg-beyondfitness.com', label: lang === 'en' ? 'Contact support' : 'Свържи се с нас' },
              ]
                .filter(item => item && !item.hideIf)
                .map((item, i) => (
                  <Box
                    key={i}
                    component="a"
                    href={item.href}
                    target={item.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel="noopener"
                    sx={{
                      fontSize: '13px',
                      fontWeight: item.highlight ? 700 : 500,
                      color: item.highlight ? '#c4e9bf' : C.text,
                      textDecoration: 'none',
                      py: 0.5,
                      '&:hover': { color: '#c4e9bf' },
                    }}
                  >
                    {item.label} →
                  </Box>
                ))}
            </Box>
          </Box>

          {/* GDPR right to erasure — every user can delete their account */}
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${C.border}` }}>
            <Button fullWidth onClick={() => { setShowProfile(false); setDeletePassword(''); setDeleteError(''); setConfirmDelete(true) }}
              sx={{
                color: '#F87171', fontSize: '13px', fontWeight: 700,
                border: '1px solid rgba(248,113,113,0.35)', borderRadius: '12px', py: 1,
                '&:hover': { background: 'rgba(248,113,113,0.08)', borderColor: '#F87171' },
              }}>
              {t('deleteMyAccount')}
            </Button>
          </Box>

          <Button fullWidth onClick={() => setShowProfile(false)}
            sx={{ mt: 1.5, color: C.muted, fontSize: '13px', fontWeight: 600 }}>
            {t('closeBtn')}
          </Button>
        </Dialog>
      )}

      {/* ── Delete account confirmation — GDPR Art. 17 (Right to be Forgotten) ── */}
      <Dialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        PaperProps={{ sx: { borderRadius: '20px', maxWidth: '380px', width: '100%', p: 3 } }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '17px', color: C.text, mb: 1 }}>
          {t('deleteAccountTitle')}
        </Typography>
        <Typography sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.5, mb: 2 }}>
          {t('deleteAccountConfirm')}
        </Typography>
        <Typography sx={{ fontSize: '12px', color: C.muted, mb: 1 }}>
          {t('enterPasswordToConfirm')}
        </Typography>
        <TextField
          type="password"
          fullWidth
          size="small"
          value={deletePassword}
          onChange={e => setDeletePassword(e.target.value)}
          placeholder={t('passPlaceholder')}
          disabled={deleting}
          autoComplete="current-password"
        />
        {deleteError && (
          <Typography sx={{ fontSize: '12px', color: '#F87171', mt: 1 }}>
            {deleteError}
          </Typography>
        )}
        <Button
          fullWidth
          disabled={deleting || !deletePassword}
          onClick={async () => {
            if (!deletePassword) { setDeleteError(t('enterPasswordErr')); return }
            setDeleting(true)
            setDeleteError('')
            try {
              const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
              const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
              const res = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: auth.id, password: deletePassword }),
              })
              const data = await res.json()
              if (!res.ok || !data.ok) {
                setDeleteError(data.error === 'Invalid password' ? t('wrongPasswordErr') : t('deleteFailedErr'))
                setDeleting(false)
                return
              }
              logout()
            } catch {
              setDeleteError(t('networkErr'))
              setDeleting(false)
            }
          }}
          sx={{
            mt: 2,
            background: '#F87171', color: '#1a0a0a', fontWeight: 800, fontSize: '14px',
            borderRadius: '12px', py: 1.25,
            '&:hover': { background: '#EF4444' },
            '&.Mui-disabled': { background: 'rgba(248,113,113,0.4)', color: 'rgba(0,0,0,0.4)' },
          }}>
          {deleting ? <CircularProgress size={18} sx={{ color: '#1a0a0a' }} /> : t('deleteAccountBtn')}
        </Button>
        <Button fullWidth disabled={deleting} onClick={() => { setConfirmDelete(false); setDeletePassword(''); setDeleteError('') }}
          sx={{ mt: 1, color: C.muted, fontSize: '13px', fontWeight: 600 }}>
          {t('cancelLbl')}
        </Button>
      </Dialog>
    </>
  )
}

function ProfileRow({ label, value, color }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1,
      borderBottom: `1px solid ${C.border}` }}>
      <Typography sx={{ fontSize: '13px', color: C.muted, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: color || C.text }}>{value}</Typography>
    </Box>
  )
}
