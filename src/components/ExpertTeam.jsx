// ── ExpertTeam — medical/coaching legitimacy section ───────────────
// Renders the team of experts behind the SYNRG method. Pulls from the
// `experts` table (slug, name, role, credentials, bio_bg, photo_url).
// Gracefully renders nothing if the table is empty or unavailable.
//
// Design intent: signal medical expertise (doctors) + practical coaching
// authority (Ицко, Елина) above the weekly content, so users see WHO
// stands behind every recommendation.

import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Avatar, Skeleton } from '@mui/material'
import VerifiedIcon from '@mui/icons-material/Verified'
import { DB } from '../lib/db'
import { C } from '../theme'

export default function ExpertTeam() {
  const [experts, setExperts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const rows = await DB.selectAll('experts', '&active=eq.true&order=sort_order.asc')
        if (alive) setExperts(rows || [])
      } catch {
        if (alive) setExperts([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={180} height={20} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" width="100%" height={120} />
      </Box>
    )
  }

  if (!experts || experts.length === 0) return null

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        mb: 3,
        borderRadius: 2.5,
        border: `1px solid ${C.loganBorder}`,
        background: `linear-gradient(135deg, ${C.loganDim} 0%, rgba(255,255,255,0.02) 100%)`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <VerifiedIcon sx={{ fontSize: 16, color: C.logan }} />
        <Typography sx={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.logan }}>
          ЕКИПЪТ ЗАД МЕТОДА
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: C.muted, mb: 1.75, lineHeight: 1.45 }}>
        Всяка препоръка идва от лекари и треньори, които работят с теб.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 1.25,
        }}
      >
        {experts.map(exp => (
          <Box
            key={exp.id}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              p: 1.25,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}`,
            }}
          >
            <Avatar
              src={exp.photo_url || undefined}
              sx={{
                width: 56,
                height: 56,
                mb: 1,
                background: C.primaryContainer,
                color: C.primary,
                fontWeight: 700,
                fontSize: 18,
                border: `2px solid ${C.loganBorder}`,
              }}
            >
              {(exp.name || '?').charAt(0)}
            </Avatar>
            <Typography sx={{
              fontSize: 13,
              fontWeight: 800,
              color: C.text,
              lineHeight: 1.2,
              fontStyle: 'italic',
            }}>
              {exp.name}
            </Typography>
            {exp.credentials && (
              <Typography sx={{
                fontSize: 10,
                color: C.logan,
                fontWeight: 700,
                letterSpacing: 0.4,
                mt: 0.25,
                textTransform: 'uppercase',
              }}>
                {exp.credentials}
              </Typography>
            )}
            {exp.role && (
              <Typography sx={{
                fontSize: 10.5,
                color: C.muted,
                mt: 0.25,
                lineHeight: 1.3,
              }}>
                {exp.role}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Paper>
  )
}
