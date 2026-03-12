import { createTheme } from '@mui/material/styles'

// ── Actual color values (dark / light) ───────────────────────────
const DARK = {
  bg:               '#151413',
  sidebar:          '#111010',
  card:             '#1C1A19',
  cardHigh:         '#232120',
  cardDeep:         'rgba(25,23,22,0.97)',
  text:             '#F2F2F0',
  muted:            '#8A8785',
  mutedHover:       '#A8A5A2',
  primary:          '#C4E9BF',
  primaryHover:     '#D4F2CF',
  primaryOn:        '#0A2E0F',
  primaryContainer: 'rgba(196,233,191,0.12)',
  primaryGlow:      'rgba(196,233,191,0.18)',
  primaryDeep:      '#9ED99A',
  primaryA5:        'rgba(196,233,191,0.05)',
  primaryA3:        'rgba(196,233,191,0.03)',
  primaryA13:       'rgba(196,233,191,0.13)',
  primaryA20:       'rgba(196,233,191,0.20)',
  border:           'rgba(255,255,255,0.06)',
  borderHover:      'rgba(255,255,255,0.11)',
  danger:           '#FF6B9D',
  dangerSoft:       'rgba(255,107,157,0.1)',
  dangerHover:      '#FF85B1',
  dangerGlow:       'rgba(255,107,157,0.3)',
  accentSoft:       'rgba(196,233,191,0.12)',
  purple:           '#C8C5FF',
  purpleSoft:       'rgba(200,197,255,0.12)',
  purpleLight:      '#A8A5FF',
  purpleLighter:    '#D4D2FF',
  purpleGlow:       'rgba(200,197,255,0.25)',
  purpleA5:         'rgba(200,197,255,0.05)',
  purpleA3:         'rgba(200,197,255,0.03)',
  purpleA13:        'rgba(200,197,255,0.13)',
  purpleA20:        'rgba(200,197,255,0.20)',
  orange:           '#FFB87A',
  shadow:           'rgba(0,0,0,0.5)',
  shadowSm:         'rgba(0,0,0,0.3)',
  listHover:        'rgba(255,255,255,0.055)',
  listSelHover:     'rgba(196,233,191,0.16)',
  tooltipBg:        'rgba(30,28,27,0.97)',
  appBarBg:         'rgba(17,16,16,0.92)',
  mobileNavBg:      'rgba(17,16,16,0.97)',
  optionBg:         '#1E1C1B',
  scrollThumb:      'rgba(255,255,255,0.12)',
  scrollThumbHover: 'rgba(255,255,255,0.22)',
  inputBg:          '#111010',
}

const LIGHT = {
  bg:               '#F5F4F2',
  sidebar:          '#EFEFED',
  card:             '#FFFFFF',
  cardHigh:         '#F8F8F6',
  cardDeep:         'rgba(255,255,255,0.97)',
  text:             '#18181A',
  muted:            '#6E6C6A',
  mutedHover:       '#4A4846',
  primary:          '#2A7D38',
  primaryHover:     '#23672F',
  primaryOn:        '#FFFFFF',
  primaryContainer: 'rgba(42,125,56,0.1)',
  primaryGlow:      'rgba(42,125,56,0.15)',
  primaryDeep:      '#1D5E2A',
  primaryA5:        'rgba(42,125,56,0.05)',
  primaryA3:        'rgba(42,125,56,0.03)',
  primaryA13:       'rgba(42,125,56,0.13)',
  primaryA20:       'rgba(42,125,56,0.20)',
  border:           'rgba(0,0,0,0.08)',
  borderHover:      'rgba(0,0,0,0.14)',
  danger:           '#D42860',
  dangerSoft:       'rgba(212,40,96,0.1)',
  dangerHover:      '#E85288',
  dangerGlow:       'rgba(212,40,96,0.25)',
  accentSoft:       'rgba(42,125,56,0.08)',
  purple:           '#4D4AC8',
  purpleSoft:       'rgba(77,74,200,0.1)',
  purpleLight:      '#6764E8',
  purpleLighter:    '#8E8BF0',
  purpleGlow:       'rgba(77,74,200,0.2)',
  purpleA5:         'rgba(77,74,200,0.05)',
  purpleA3:         'rgba(77,74,200,0.03)',
  purpleA13:        'rgba(77,74,200,0.13)',
  purpleA20:        'rgba(77,74,200,0.20)',
  orange:           '#B35B00',
  shadow:           'rgba(0,0,0,0.12)',
  shadowSm:         'rgba(0,0,0,0.06)',
  listHover:        'rgba(0,0,0,0.04)',
  listSelHover:     'rgba(42,125,56,0.12)',
  tooltipBg:        'rgba(245,244,242,0.98)',
  appBarBg:         'rgba(239,239,237,0.92)',
  mobileNavBg:      'rgba(239,239,237,0.97)',
  optionBg:         '#F0F0EE',
  scrollThumb:      'rgba(0,0,0,0.15)',
  scrollThumbHover: 'rgba(0,0,0,0.25)',
  inputBg:          '#FFFFFF',
}

// ── C — CSS variable references (used by all components) ─────────
export const C = {
  bg:               'var(--c-bg)',
  sidebar:          'var(--c-sidebar)',
  card:             'var(--c-card)',
  cardHigh:         'var(--c-cardHigh)',
  cardDeep:         'var(--c-cardDeep)',
  text:             'var(--c-text)',
  muted:            'var(--c-muted)',
  mutedHover:       'var(--c-mutedHover)',
  primary:          'var(--c-primary)',
  primaryHover:     'var(--c-primaryHover)',
  primaryOn:        'var(--c-primaryOn)',
  primaryContainer: 'var(--c-primaryContainer)',
  primaryGlow:      'var(--c-primaryGlow)',
  primaryDeep:      'var(--c-primaryDeep)',
  primaryA5:        'var(--c-primaryA5)',
  primaryA3:        'var(--c-primaryA3)',
  primaryA13:       'var(--c-primaryA13)',
  primaryA20:       'var(--c-primaryA20)',
  border:           'var(--c-border)',
  borderHover:      'var(--c-borderHover)',
  danger:           'var(--c-danger)',
  dangerSoft:       'var(--c-dangerSoft)',
  dangerHover:      'var(--c-dangerHover)',
  dangerGlow:       'var(--c-dangerGlow)',
  accentSoft:       'var(--c-accentSoft)',
  purple:           'var(--c-purple)',
  purpleSoft:       'var(--c-purpleSoft)',
  purpleLight:      'var(--c-purpleLight)',
  purpleLighter:    'var(--c-purpleLighter)',
  purpleGlow:       'var(--c-purpleGlow)',
  purpleA5:         'var(--c-purpleA5)',
  purpleA3:         'var(--c-purpleA3)',
  purpleA13:        'var(--c-purpleA13)',
  purpleA20:        'var(--c-purpleA20)',
  orange:           'var(--c-orange)',
  shadow:           'var(--c-shadow)',
  shadowSm:         'var(--c-shadowSm)',
  listHover:        'var(--c-listHover)',
  listSelHover:     'var(--c-listSelHover)',
  tooltipBg:        'var(--c-tooltipBg)',
  appBarBg:         'var(--c-appBarBg)',
  mobileNavBg:      'var(--c-mobileNavBg)',
  optionBg:         'var(--c-optionBg)',
  scrollThumb:      'var(--c-scrollThumb)',
  scrollThumbHover: 'var(--c-scrollThumbHover)',
  inputBg:          'var(--c-inputBg)',
}

// ── Apply CSS variables to :root ─────────────────────────────────
export function applyColors(isDark) {
  const vals = isDark ? DARK : LIGHT
  const root = document.documentElement
  Object.entries(vals).forEach(([key, val]) => {
    root.style.setProperty(`--c-${key}`, val)
  })
}

// ── Easing ───────────────────────────────────────────────────────
export const EASE = {
  standard:  'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate:'cubic-bezier(0, 0, 0.2, 1)',
  accelerate:'cubic-bezier(0.4, 0, 1, 1)',
  spring:    'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

// ── Dynamic MUI theme ────────────────────────────────────────────
export function makeTheme(isDark) {
  const vals = isDark ? DARK : LIGHT
  return createTheme({
    palette: {
      mode:       isDark ? 'dark' : 'light',
      primary:    { main: vals.primary,  contrastText: vals.primaryOn },
      secondary:  { main: vals.purple,   contrastText: vals.primaryOn },
      error:      { main: vals.danger },
      warning:    { main: vals.orange },
      background: { default: vals.bg, paper: vals.card },
      text:       { primary: vals.text, secondary: vals.muted },
      divider:    vals.border,
    },

    typography: {
      fontFamily: "'MontBlanc', sans-serif",
      h1: { fontFamily: "'MontBlanc', sans-serif", fontWeight: 800, fontSize: '2.25rem', letterSpacing: '-0.5px', lineHeight: 1.15 },
      h2: { fontFamily: "'MontBlanc', sans-serif", fontWeight: 800, fontSize: '1.625rem', letterSpacing: '-0.3px', lineHeight: 1.2 },
      h3: { fontFamily: "'MontBlanc', sans-serif", fontWeight: 700, fontSize: '1.25rem',  letterSpacing: '-0.1px', lineHeight: 1.3 },
      h4: { fontFamily: "'MontBlanc', sans-serif", fontWeight: 700, fontSize: '1.0625rem', letterSpacing: '-0.1px' },
      h5: { fontFamily: "'MontBlanc', sans-serif", fontWeight: 700, fontSize: '0.9375rem' },
      h6: { fontFamily: "'MontBlanc', sans-serif", fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '0.05px' },
      body1:   { fontFamily: "'MontBlanc', sans-serif", fontSize: '0.9375rem', letterSpacing: '0.1px', lineHeight: 1.55 },
      body2:   { fontFamily: "'MontBlanc', sans-serif", fontSize: '0.875rem',  letterSpacing: '0.1px', lineHeight: 1.5 },
      caption: { fontFamily: "'MontBlanc', sans-serif", fontSize: '0.75rem',   letterSpacing: '0.3px', lineHeight: 1.4 },
      overline:{ fontFamily: "'MontBlanc', sans-serif", fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', lineHeight: 1.5 },
      button:  { fontFamily: "'MontBlanc', sans-serif", fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.1px', textTransform: 'none' },
    },

    shape: { borderRadius: 12 },

    components: {
      MuiCssBaseline: {
        styleOverrides: `
          *, *::before, *::after {
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-6px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.97); }
            to   { opacity: 1; transform: scale(1); }
          }
          @keyframes shimmer {
            0%   { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.5; }
          }
          html, body {
            background: var(--c-bg);
            color: var(--c-text);
            overflow-x: hidden;
            max-width: 100vw;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            transition: background 0.25s ease, color 0.25s ease;
          }
          * { box-sizing: border-box; }
          input[type=date]::-webkit-calendar-picker-indicator {
            filter: var(--c-dateFilter, invert(.55));
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.15s ease;
          }
          input[type=date]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
          option { background: var(--c-optionBg) !important; }
          ::-webkit-scrollbar       { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--c-scrollThumb); border-radius: 99px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--c-scrollThumbHover); }
        `,
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            background:   `linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)`,
            border:       `1px solid var(--c-border)`,
            borderRadius: '16px',
            boxShadow:    `0 1px 3px var(--c-shadowSm)`,
            transition:   `box-shadow 0.25s, transform 0.25s, border-color 0.25s, background 0.25s`,
            '&:hover': {
              boxShadow:   `0 4px 20px var(--c-shadow), 0 1px 6px var(--c-shadowSm)`,
              borderColor: `var(--c-borderHover)`,
              transform:   'translateY(-1px)',
            },
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            background:   `linear-gradient(145deg, var(--c-card) 0%, var(--c-cardDeep) 100%)`,
            border:       `1px solid var(--c-border)`,
            borderRadius: '16px',
            boxShadow:    `0 1px 3px var(--c-shadowSm)`,
            transition:   `box-shadow 0.25s, transform 0.25s, border-color 0.25s, background 0.25s`,
            '&:hover': {
              boxShadow:   `0 4px 20px var(--c-shadow), 0 1px 6px var(--c-shadowSm)`,
              borderColor: `var(--c-borderHover)`,
              transform:   'translateY(-1px)',
            },
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius:  '20px',
            fontWeight:    600,
            fontSize:      '0.875rem',
            letterSpacing: '0.1px',
            textTransform: 'none',
            paddingLeft:   '24px',
            paddingRight:  '24px',
            minHeight:     '40px',
            transition:    `all 0.18s`,
            '&:active': { transform: 'scale(0.97)', transition: 'transform 0.08s ease' },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, var(--c-primary) 0%, var(--c-primaryDeep) 100%)`,
            color:      `var(--c-primaryOn)`,
            boxShadow:  `0 1px 4px var(--c-shadowSm), 0 0 0 1px var(--c-primaryContainer)`,
            '&:hover': {
              background: `linear-gradient(135deg, var(--c-primaryHover) 0%, var(--c-primary) 100%)`,
              boxShadow:  `0 4px 16px var(--c-primaryGlow), 0 1px 4px var(--c-shadowSm)`,
              transform:  'translateY(-1px)',
            },
            '&:active': { transform: 'scale(0.97) translateY(0)', boxShadow: 'none' },
          },
          containedSecondary: {
            background: `linear-gradient(135deg, var(--c-purple) 0%, var(--c-purpleLight) 100%)`,
            color:      `var(--c-primaryOn)`,
            boxShadow:  `0 1px 4px var(--c-shadowSm)`,
            '&:hover': {
              background: `linear-gradient(135deg, var(--c-purpleLighter) 0%, var(--c-purple) 100%)`,
              boxShadow:  `0 4px 16px var(--c-purpleGlow), 0 1px 4px var(--c-shadowSm)`,
              transform:  'translateY(-1px)',
            },
          },
          containedError: {
            background: `var(--c-danger)`,
            color:      '#fff',
            boxShadow:  `0 1px 4px var(--c-shadowSm)`,
            '&:hover': {
              background: `var(--c-dangerHover)`,
              boxShadow:  `0 4px 16px var(--c-dangerGlow)`,
              transform:  'translateY(-1px)',
            },
          },
          outlined: {
            borderColor: `var(--c-border)`,
            color:       `var(--c-text)`,
            background:  'transparent',
            '&:hover': {
              borderColor:     `var(--c-borderHover)`,
              backgroundColor: `var(--c-listHover)`,
              transform:       'translateY(-1px)',
            },
          },
          text: {
            '&:hover': { backgroundColor: `var(--c-listHover)` },
          },
          sizeSmall: {
            borderRadius: '16px',
            paddingLeft:  '16px',
            paddingRight: '16px',
            minHeight:    '32px',
            fontSize:     '0.8125rem',
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: '50%',
            transition:   `all 0.15s`,
            '&:hover': {
              backgroundColor: `var(--c-listHover)`,
              transform:       'scale(1.07)',
            },
            '&:active': { transform: 'scale(0.93)' },
          },
        },
      },

      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: `var(--c-inputBg)`,
            color:           `var(--c-text)`,
            borderRadius:    '12px',
            transition:      `box-shadow 0.18s, border-color 0.18s`,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: `var(--c-border)`, transition: `border-color 0.18s` },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: `var(--c-borderHover)` },
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px var(--c-primaryGlow)`,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: `var(--c-primaryA20)` },
            },
          },
          input: {
            color: `var(--c-text)`,
            '&::placeholder': { color: `var(--c-muted)`, opacity: 1 },
            '&:-webkit-autofill': {
              WebkitBoxShadow:     `0 0 0 1000px var(--c-inputBg) inset`,
              WebkitTextFillColor: `var(--c-text)`,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: `var(--c-muted)`,
            transition: `color 0.18s`,
            '&.Mui-focused': { color: `var(--c-primary)` },
          },
        },
      },
      MuiSelect: {
        styleOverrides: { icon: { color: `var(--c-muted)` } },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            margin:       '2px 8px',
            transition:   `background-color 0.12s`,
            '&:hover':        { backgroundColor: `var(--c-primaryContainer)` },
            '&.Mui-selected': { backgroundColor: `var(--c-primaryContainer)`, color: `var(--c-primary)` },
          },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            background:   `var(--c-cardHigh)`,
            border:       `1px solid var(--c-border)`,
            borderRadius: '24px',
            boxShadow:    `0 24px 64px var(--c-shadow), 0 0 0 1px var(--c-border)`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.1px', paddingBottom: 8 } },
      },
      MuiDialogActions: {
        styleOverrides: { root: { padding: '16px 24px 24px', gap: 8 } },
      },

      MuiSnackbar: {
        defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } },
      },
      MuiAlert: {
        styleOverrides: {
          filled: {
            borderRadius: '20px',
            fontWeight:   600,
            boxShadow:    `0 8px 24px var(--c-shadow)`,
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius:  '8px',
            fontWeight:    600,
            fontSize:      '0.75rem',
            letterSpacing: '0.3px',
            height:        '32px',
            transition:    `all 0.15s`,
            cursor:        'pointer',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: `0 3px 10px var(--c-shadowSm)`,
            },
            '&:active': { transform: 'scale(0.96)' },
          },
          filled: {
            backgroundColor: `var(--c-primaryContainer)`,
            color:           `var(--c-primary)`,
            border:          `1px solid var(--c-primaryA20)`,
            '&:hover': { backgroundColor: `var(--c-primaryA20)` },
          },
        },
      },

      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            background:     `linear-gradient(180deg, var(--c-mobileNavBg) 0%, var(--c-sidebar) 100%)`,
            borderTop:      `1px solid var(--c-border)`,
            height:         '80px',
            backdropFilter: 'blur(12px)',
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            color:      `var(--c-muted)`,
            minWidth:   0,
            padding:    '0 4px',
            paddingTop: '12px',
            transition: `color 0.18s`,
            '&.Mui-selected': { color: `var(--c-primary)` },
            '& .MuiBottomNavigationAction-label': {
              fontSize:     '0.6875rem !important',
              fontWeight:   600,
              letterSpacing:'0.5px',
              marginTop:    '4px',
              transition:   `opacity 0.18s`,
            },
          },
        },
      },

      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            background:     `var(--c-appBarBg)`,
            backdropFilter: 'blur(16px)',
            borderBottom:   `1px solid var(--c-border)`,
            boxShadow:      'none',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: { minHeight: '64px !important' },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            background:  `var(--c-sidebar)`,
            borderRight: `1px solid var(--c-border)`,
            boxShadow:   'none',
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '28px',
            transition:   `background-color 0.18s, color 0.18s, transform 0.15s`,
            '&:hover': {
              backgroundColor: `var(--c-listHover)`,
              transform:       'translateX(2px)',
            },
            '&:active': { transform: 'scale(0.98)' },
            '&.Mui-selected': {
              backgroundColor: `var(--c-primaryContainer)`,
              color:           `var(--c-primary)`,
              boxShadow:       `inset 0 0 0 1px var(--c-primaryA13)`,
              '&:hover':       { backgroundColor: `var(--c-listSelHover)`, transform: 'translateX(2px)' },
            },
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: '40px', color: 'inherit' } },
      },
      MuiListItemText: {
        styleOverrides: { primary: { fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.05px' } },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            background:   `var(--c-tooltipBg)`,
            border:       `1px solid var(--c-border)`,
            borderRadius: '8px',
            fontSize:     '0.75rem',
            fontWeight:   500,
            letterSpacing:'0.2px',
            padding:      '6px 10px',
            boxShadow:    `0 4px 12px var(--c-shadow)`,
            color:        `var(--c-text)`,
          },
          arrow: { color: `var(--c-tooltipBg)` },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: { borderColor: `var(--c-border)` },
        },
      },
    },
  })
}

// Default dark theme export (used as fallback / initial)
export default makeTheme(true)
