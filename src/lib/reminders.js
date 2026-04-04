import { parseDate, todayDate } from './utils'

/**
 * Compute active reminders for a client based on their data and current time.
 * Returns an array of reminder objects.
 */
export function computeReminders(client) {
  if (!client || !client.id) return []

  const settings  = client.reminderSettings || {}
  const now       = new Date()
  const hour      = now.getHours()
  const today     = todayDate()
  const reminders = []

  // ── Protein reminder (after 18:00) ──────────────────────────
  if (settings.protein !== false && hour >= 18) {
    const todayProtein = (client.meals || [])
      .filter(m => m.date === today)
      .reduce((s, m) => s + Number(m.protein || 0), 0)
    const target = client.proteinTarget || 130
    const needed = Math.round(target - todayProtein)
    if (needed > 10) {
      reminders.push({
        id:      'protein',
        type:    'protein',
        icon:    '🥩',
        needed,
        current: Math.round(todayProtein),
        target,
      })
    }
  }

  // ── Weight reminder ──────────────────────────────────────────
  if (settings.weight !== false) {
    const sorted = [...(client.weightLogs || [])]
      .sort((a, b) => parseDate(b.date) - parseDate(a.date))
    const last = sorted[0]
    if (!last) {
      reminders.push({ id: 'weight', type: 'weight', daysSince: null })
    } else {
      const days = Math.floor((parseDate(today) - parseDate(last.date)) / 86400000)
      if (days >= 3) {
        reminders.push({ id: 'weight', type: 'weight', daysSince: days })
      }
    }
  }

  // ── Food log reminder (after 20:00) ─────────────────────────
  if (settings.foodLog !== false && hour >= 20) {
    const hasMeals = (client.meals || []).some(m => m.date === today)
    if (!hasMeals) {
      reminders.push({ id: 'foodLog', type: 'foodLog', icon: '🍽️' })
    }
  }

  // ── Coach reactions / messages ───────────────────────────────
  if (settings.coach !== false) {
    const reactions = (client.reactions || [])
      .filter(r => !r.dismissed)
      .slice(-5)
    reactions.forEach(r => {
      reminders.push({
        id:           `coach-${r.id}`,
        type:         'coach',
        reactionId:   r.id,
        trainerName:  r.trainer_name,
        reactionType: r.type,
        message:      r.message,
        date:         r.date,
      })
    })
  }

  return reminders
}
