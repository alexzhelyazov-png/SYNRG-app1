import { useState, useEffect } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import AssignmentIcon     from '@mui/icons-material/Assignment'
import MenuBookIcon       from '@mui/icons-material/MenuBook'
import LeaderboardIcon    from '@mui/icons-material/Leaderboard'
import TrendingUpIcon     from '@mui/icons-material/TrendingUp'
import { useApp } from '../context/AppContext'
import Dashboard          from './Dashboard'
import { AllClientsTasks } from './Tasks'
import Recipes            from './Recipes'
import Ranking            from './Ranking'
import { C } from '../theme'

// Coach-only profile page with sub-tabs.
// Tabs: Табло (coach's own tracker) / Задачи / Рецепти / Класация
export default function Profile() {
  const { auth, viewingCoach, setViewingCoach, coachClientMode, setCoachClientMode, client, saveWorkoutDraft, t } = useApp()
  const [tab, setTab] = useState('tracker')

  // When entering the tracker tab, put coach in "viewing themselves" mode
  useEffect(() => {
    if (tab === 'tracker') {
      if (coachClientMode && client?.id) saveWorkoutDraft(client.id)
      setCoachClientMode(false)
      setViewingCoach(auth.name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{
        borderBottom: `1px solid ${C.border}`,
        background: C.bg,
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontSize: 13, fontWeight: 600, color: C.muted },
            '& .MuiTab-root.Mui-selected': { color: C.purple },
            '& .MuiTabs-indicator': { background: C.purple },
          }}
        >
          <Tab value="tracker" label={t('profileTabTracker') || 'Табло'}  icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab value="tasks"   label={t('navTasks')    || 'Задачи'}       icon={<AssignmentIcon  sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab value="recipes" label={t('navRecipes')  || 'Рецепти'}      icon={<MenuBookIcon    sx={{ fontSize: 18 }} />} iconPosition="start" />
          <Tab value="ranking" label={t('navRanking')  || 'Класация'}     icon={<LeaderboardIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'tracker' && <Dashboard />}
        {tab === 'tasks'   && <AllClientsTasks />}
        {tab === 'recipes' && <Recipes />}
        {tab === 'ranking' && <Ranking />}
      </Box>
    </Box>
  )
}
