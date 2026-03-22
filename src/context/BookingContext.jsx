import { createContext, useContext, useState, useCallback } from 'react'
import { DB } from '../lib/db'
import { isoToday, isoDatePlusDays } from '../lib/bookingUtils'
import { ADMIN_MANAGEABLE_MODULES } from '../lib/modules'
import { useApp } from './AppContext'

const BookingCtx = createContext(null)
export const useBooking = () => useContext(BookingCtx)

export function BookingProvider({ children }) {
  const { auth, showSnackbar, realClients } = useApp()

  // ── State ─────────────────────────────────────────────────
  const [slots,        setSlots]        = useState([])   // enriched with booked_count
  const [slotBookings, setSlotBookings] = useState({})   // { slotId: [booking, ...] }
  const [myBookings,   setMyBookings]   = useState([])   // client's active bookings
  const [myPlan,       setMyPlan]       = useState(null) // client's active plan
  const [allPlans,     setAllPlans]     = useState([])   // admin: all plans
  const [bookingBusy,  setBookingBusy]  = useState(false)

  // ── Load slots (enriched with booked_count) ───────────────
  const loadSlots = useCallback(async (from = isoToday(), to = isoDatePlusDays(14)) => {
    try {
      const raw    = await DB.getSlots(from, to)
      const counts = await DB.getSlotBookingCounts(raw.map(s => s.id))
      const enriched = raw.map(s => ({ ...s, booked_count: counts[s.id] || 0 }))
      setSlots(enriched)
      return enriched
    } catch (e) {
      console.error('loadSlots error:', e)
      return []
    }
  }, [])

  // ── Load full client list per slot (coach/admin) ──────────
  const loadSlotBookings = useCallback(async (slotIds) => {
    if (!slotIds || !slotIds.length) return {}
    const result = {}
    for (const id of slotIds) {
      result[id] = await DB.getSlotBookings(id)
    }
    setSlotBookings(prev => ({ ...prev, ...result }))
    return result
  }, [])

  // ── Load a client's own bookings ──────────────────────────
  const loadMyBookings = useCallback(async (clientId) => {
    if (!clientId) return []
    const data = await DB.getClientBookings(clientId)
    setMyBookings(data)
    return data
  }, [])

  // ── Load a client's active plan ───────────────────────────
  const loadMyPlan = useCallback(async (clientId) => {
    if (!clientId) return null
    const data = await DB.getClientActivePlan(clientId)
    setMyPlan(data)
    return data
  }, [])

  // ── Load all plans (admin) ────────────────────────────────
  const loadAllPlans = useCallback(async () => {
    const data = await DB.getAllClientPlans()
    setAllPlans(data)
    return data
  }, [])

  // ── Refresh everything for client view ───────────────────
  const refreshClientView = useCallback(async (clientId, from, to) => {
    await Promise.all([
      loadSlots(from, to),
      loadMyBookings(clientId),
      loadMyPlan(clientId),
    ])
  }, [loadSlots, loadMyBookings, loadMyPlan])

  // ── Client: book a slot ───────────────────────────────────
  const bookSlot = useCallback(async (slotId) => {
    setBookingBusy(true)
    try {
      const result = await DB.callRpc('book_slot', {
        p_slot_id:     slotId,
        p_client_id:   auth.id,
        p_client_name: auth.name,
      })
      if (result?.error) return { error: result.error }
      await Promise.all([loadSlots(), loadMyBookings(auth.id), loadMyPlan(auth.id)])
      return { ok: true }
    } catch (e) {
      return { error: e.message || 'Грешка при записване' }
    } finally {
      setBookingBusy(false)
    }
  }, [auth, loadSlots, loadMyBookings, loadMyPlan])

  // ── Client: cancel booking ────────────────────────────────
  const cancelBookingForSlot = useCallback(async (slotId) => {
    setBookingBusy(true)
    try {
      const result = await DB.callRpc('cancel_booking', {
        p_slot_id:   slotId,
        p_client_id: auth.id,
      })
      if (result?.error) return { error: result.error }
      await Promise.all([loadSlots(), loadMyBookings(auth.id), loadMyPlan(auth.id)])
      return { ok: true }
    } catch (e) {
      return { error: e.message || 'Грешка при отказ' }
    } finally {
      setBookingBusy(false)
    }
  }, [auth, loadSlots, loadMyBookings, loadMyPlan])

  // Coach/admin cancels a booking on behalf of a specific client
  const cancelBookingForClient = useCallback(async (slotId, clientId) => {
    setBookingBusy(true)
    try {
      const result = await DB.callRpc('cancel_booking', {
        p_slot_id:   slotId,
        p_client_id: clientId,
      })
      if (result?.error) return { error: result.error }
      await loadSlots()
      return { ok: true }
    } catch (e) {
      return { error: e.message || 'Error cancelling' }
    } finally {
      setBookingBusy(false)
    }
  }, [loadSlots])

  // ── Admin: create single slot ─────────────────────────────
  const createSlot = useCallback(async (data) => {
    try {
      const result = await DB.insert('booking_slots', {
        slot_date:  data.slot_date,
        start_time: data.start_time,
        end_time:   data.end_time,
        coach_id:   data.coach_id   || null,
        coach_name: data.coach_name,
        capacity:   data.capacity   || 3,
        notes:      data.notes      || null,
        status:     'active',
        created_by: auth.name,
      })
      await loadSlots()
      return result
    } catch (e) { return { error: e.message } }
  }, [auth, loadSlots])

  // ── Admin: create recurring slots ────────────────────────
  const createRecurringSlots = useCallback(async ({
    startDate, endDate, weekdays, startTime, endTime,
    coachId, coachName, capacity, notes,
  }) => {
    try {
      const d   = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate   + 'T00:00:00')
      let count = 0
      while (d <= end) {
        if (weekdays.includes(d.getDay())) {
          await DB.insert('booking_slots', {
            slot_date:  d.toISOString().slice(0, 10),
            start_time: startTime,
            end_time:   endTime,
            coach_id:   coachId   || null,
            coach_name: coachName,
            capacity:   capacity  || 3,
            notes:      notes     || null,
            status:     'active',
            created_by: auth.name,
          })
          count++
        }
        d.setDate(d.getDate() + 1)
      }
      await loadSlots()
      return { created: count }
    } catch (e) { return { error: e.message, created: 0 } }
  }, [auth, loadSlots])

  // ── Admin: create hourly shift (N slots in one call) ─────────
  const createShiftSlots = useCallback(async ({ date, coachId, coachName, fromHour, toHour, capacity, notes }) => {
    let count = 0
    try {
      for (let h = fromHour; h < toHour; h++) {
        await DB.insert('booking_slots', {
          slot_date:  date,
          start_time: `${String(h).padStart(2, '0')}:00`,
          end_time:   `${String(h + 1).padStart(2, '0')}:00`,
          coach_id:   coachId || null,
          coach_name: coachName,
          capacity:   capacity || 3,
          notes:      notes || null,
          status:     'active',
          created_by: auth.name,
        })
        count++
      }
      return { created: count }
    } catch (e) { return { error: e.message, created: count } }
  }, [auth])

  // ── Admin: update slot ────────────────────────────────────
  const updateSlot = useCallback(async (slotId, patch) => {
    try {
      await DB.update('booking_slots', slotId, patch)
      await loadSlots()
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadSlots])

  // ── Admin: cancel/delete slot ─────────────────────────────
  const deleteSlot = useCallback(async (slotId) => {
    try {
      await DB.update('booking_slots', slotId, { status: 'cancelled' })
      await loadSlots()
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadSlots])

  // ── Admin: activate plan for client ──────────────────────
  const activatePlan = useCallback(async (clientId, planType, validFrom, price = 0, startCredits = null, isPaid = false, validTo = null) => {
    try {
      const creditsTotal = planType === '8' ? 8 : planType === '12' ? 12 : null
      // If startCredits provided (migration), compute credits_used = total - remaining
      const creditsUsed = (creditsTotal !== null && startCredits !== null)
        ? Math.max(0, creditsTotal - Number(startCredits))
        : 0
      const from = validFrom || isoToday()
      let to = validTo
      if (!to) { const toDate = new Date(from + 'T00:00:00'); toDate.setDate(toDate.getDate() + 30); to = toDate.toISOString().slice(0, 10) }
      const existing = await DB.getClientActivePlan(clientId)
      if (existing) {
        await DB.update('client_plans', existing.id, { status: 'expired' })
      }
      const result = await DB.insert('client_plans', {
        client_id:     clientId,
        plan_type:     planType,
        credits_total: creditsTotal,
        credits_used:  creditsUsed,
        valid_from:    from,
        valid_to:      to,
        status:        'active',
        activated_by:  auth.name,
        price:         Number(price) || 0,
        is_paid:       !!isPaid,
      })
      // Auto-enable ALL modules when activating a plan
      const targetClient = realClients.find(c => c.id === clientId)
      if (targetClient) {
        const currentModules = targetClient.modules || []
        const merged = [...new Set([...currentModules, ...ADMIN_MANAGEABLE_MODULES])]
        if (merged.length !== currentModules.length || !merged.every(m => currentModules.includes(m))) {
          await DB.update('clients', clientId, { modules: merged })
        }
        // Send plan activation email
        if (targetClient.email) {
          const planLabel = planType === 'unlimited' ? 'Неограничен' : `${planType} тренировки`
          DB.syncToMailerLite('plan_activated', targetClient.email, targetClient.name, {
            PLAN_TYPE: planType,
            PLAN_EXPIRES: to,
            PLAN_STATUS: 'active',
          })
        }
      }
      await loadAllPlans()
      return result
    } catch (e) { return { error: e.message } }
  }, [auth, loadAllPlans, realClients])

  // ── Admin: extend plan ────────────────────────────────────
  const extendPlan = useCallback(async (planId, extendedTo) => {
    try {
      await DB.update('client_plans', planId, {
        extended_to: extendedTo,
        updated_at:  new Date().toISOString(),
      })
      await loadAllPlans()
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadAllPlans])

  // ── Admin: adjust credits used ────────────────────────────
  const adjustCredits = useCallback(async (planId, newCreditsUsed) => {
    try {
      await DB.update('client_plans', planId, {
        credits_used: Math.max(0, newCreditsUsed),
        updated_at:   new Date().toISOString(),
      })
      await loadAllPlans()
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadAllPlans])

  // ── Admin: deactivate plan ───────────────────────────────
  const deactivatePlan = useCallback(async (planId) => {
    try {
      await DB.update('client_plans', planId, {
        status:     'expired',
        updated_at: new Date().toISOString(),
      })
      await loadAllPlans()
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadAllPlans])

  // ── Admin: manually add client to slot ────────────────────
  const adminAddToSlot = useCallback(async (slotId, clientId, clientName, useCredit = false) => {
    try {
      const result = await DB.callRpc('admin_book_slot', {
        p_slot_id:     slotId,
        p_client_id:   clientId,
        p_client_name: clientName,
        p_use_credit:  useCredit,
      })
      if (result?.error) return { error: result.error }
      await loadSlots()
      await loadSlotBookings([slotId])
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadSlots, loadSlotBookings])

  // ── Admin: manually remove client from slot ───────────────
  const adminRemoveFromSlot = useCallback(async (slotId, clientId, returnCredit = true) => {
    try {
      const result = await DB.callRpc('admin_cancel_booking', {
        p_slot_id:       slotId,
        p_client_id:     clientId,
        p_return_credit: returnCredit,
      })
      if (result?.error) return { error: result.error }
      await loadSlots()
      await loadSlotBookings([slotId])
      return { ok: true }
    } catch (e) { return { error: e.message } }
  }, [loadSlots, loadSlotBookings])

  return (
    <BookingCtx.Provider value={{
      // State
      slots, slotBookings, myBookings, myPlan, allPlans, bookingBusy,
      // Loaders
      loadSlots, loadSlotBookings, loadMyBookings, loadMyPlan, loadAllPlans,
      refreshClientView,
      // Client actions
      bookSlot, cancelBookingForSlot, cancelBookingForClient,
      // Admin slot actions
      createSlot, createRecurringSlots, createShiftSlots, updateSlot, deleteSlot,
      // Admin plan actions
      activatePlan, extendPlan, adjustCredits, deactivatePlan,
      // Admin booking management
      adminAddToSlot, adminRemoveFromSlot,
    }}>
      {children}
    </BookingCtx.Provider>
  )
}
