// ── Module-based access control for SYNRG Portal ──────────────────

export const MODULE_KEYS = {
  STUDIO_ACCESS:        'studio_access',
  BOOKING_ACCESS:       'booking_access',
  WEIGHT_TRACKING:      'weight_tracking',
  NUTRITION_TRACKING:   'nutrition_tracking',
  TRAINING_PLAN_ACCESS: 'training_plan_access',
  PROGRAM_ACCESS:       'program_access',      // Future
  PLANNER_ACCESS:       'planner_access',       // Future
  SYNRG_METHOD:         'synrg_method',
}

export const MODULE_DEFS = {
  studio_access:        { labelBg: 'Студио достъп',        labelEn: 'Studio Access',        group: 'studio' },
  booking_access:       { labelBg: 'Записване за час',      labelEn: 'Booking Access',       group: 'studio' },
  weight_tracking:      { labelBg: 'Тракер за тегло',       labelEn: 'Weight Tracking',      group: 'tracking' },
  nutrition_tracking:   { labelBg: 'Хранителен тракер',     labelEn: 'Nutrition Tracking',   group: 'tracking' },
  training_plan_access: { labelBg: 'Тренировъчен план',     labelEn: 'Training Plan Access', group: 'studio' },
  program_access:       { labelBg: 'Онлайн с ментор',       labelEn: 'Online with Mentor',   group: 'digital' },
  planner_access:       { labelBg: 'Дигитален планер',      labelEn: 'Digital Planner',      group: 'digital' },
  synrg_method:         { labelBg: 'SYNRG метод',           labelEn: 'SYNRG Method',         group: 'method'  },
}

export const MODULE_PRESETS = {
  studio_client: ['studio_access', 'booking_access', 'weight_tracking', 'nutrition_tracking'],
  full_access:   ['studio_access', 'booking_access', 'weight_tracking', 'nutrition_tracking', 'training_plan_access'],
}

// Freemium baseline — what a client sees when they have no active plan
// (used on registration and when a studio plan expires).
export const FREE_MODULES = ['nutrition_tracking', 'weight_tracking', 'steps_tracking']

// Modules the admin can toggle per client
export const ADMIN_MANAGEABLE_MODULES = [
  'studio_access', 'booking_access', 'weight_tracking', 'nutrition_tracking', 'training_plan_access', 'program_access', 'synrg_method',
]

/** Check if a client (or modules array) has a specific module */
export function hasModule(clientOrModules, moduleKey) {
  const modules = Array.isArray(clientOrModules) ? clientOrModules : (clientOrModules?.modules || [])
  return modules.includes(moduleKey)
}

/** Check if client has ANY module (i.e., is not in "empty state") */
export function hasAnyModule(clientOrModules) {
  const modules = Array.isArray(clientOrModules) ? clientOrModules : (clientOrModules?.modules || [])
  return modules.length > 0
}

/** Determine client type for dashboard layout */
export function getClientType(clientOrModules) {
  const m = Array.isArray(clientOrModules) ? clientOrModules : (clientOrModules?.modules || [])
  const hasStudio  = m.includes('studio_access') || m.includes('booking_access')
  const hasDigital = m.includes('program_access') || m.includes('planner_access')
  if (hasStudio && hasDigital) return 'hybrid'
  if (hasStudio)               return 'studio'
  if (hasDigital)              return 'remote'
  if (m.length > 0)            return 'tracking_only'
  return 'none'
}
