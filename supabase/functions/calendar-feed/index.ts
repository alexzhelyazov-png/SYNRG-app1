/**
 * Supabase Edge Function: calendar-feed
 *
 * Returns an ICS calendar feed of the full SYNRG studio schedule
 * (all coaches, all bookings, past 14 days → next 90 days).
 *
 * Subscribe in Google Calendar:
 *   Other calendars → From URL → paste the function URL → Add calendar
 *
 * URL: https://nzrtdqlgljcipfmectwp.supabase.co/functions/v1/calendar-feed
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

// "20260416" + "T" + "090000"
function toICSDateTime(dateStr: string, timeStr: string): string {
  return dateStr.replace(/-/g, "") + "T" + timeStr.slice(0, 5).replace(":", "") + "00"
}

// Escape special ICS characters
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

// RFC 5545 line folding — max 75 octets, continuation lines start with a space
function fold(line: string): string {
  if (line.length <= 75) return line
  let out = line.slice(0, 75)
  line = line.slice(75)
  while (line.length > 0) {
    out += "\r\n " + line.slice(0, 74)
    line = line.slice(74)
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const h = {
      apikey:        serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    }

    // Date range: past 14 days → next 90 days
    const now  = new Date()
    const from = new Date(now); from.setDate(now.getDate() - 14)
    const to   = new Date(now); to.setDate(now.getDate() + 90)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr   = to.toISOString().slice(0, 10)

    // 1. Fetch all active slots in range
    const slotsRes = await fetch(
      `${supabaseUrl}/rest/v1/booking_slots` +
      `?select=id,slot_date,start_time,end_time,coach_name,capacity,notes` +
      `&status=eq.active` +
      `&slot_date=gte.${fromStr}&slot_date=lte.${toStr}` +
      `&order=slot_date.asc,start_time.asc`,
      { headers: h }
    )
    const slots: any[] = await slotsRes.json()

    // 2. Fetch active bookings for those slots (one query, group in-memory)
    const bookingsBySlot: Record<string, string[]> = {}
    if (slots.length > 0) {
      const ids = slots.map((s: any) => s.id).join(",")
      const bRes = await fetch(
        `${supabaseUrl}/rest/v1/slot_bookings` +
        `?select=slot_id,client_name` +
        `&status=eq.active` +
        `&slot_id=in.(${ids})`,
        { headers: h }
      )
      const bookings: any[] = await bRes.json()
      for (const b of bookings) {
        if (!bookingsBySlot[b.slot_id]) bookingsBySlot[b.slot_id] = []
        bookingsBySlot[b.slot_id].push(b.client_name)
      }
    }

    // 3. Build ICS
    const stamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z"

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SYNRG Beyond Fitness//Schedule//BG",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SYNRG График",
      "X-WR-TIMEZONE:Europe/Sofia",
    ]

    for (const s of slots) {
      const clients  = bookingsBySlot[s.id] ?? []
      const filled   = `${clients.length}/${s.capacity}`
      const names    = clients.length ? clients.join(", ") : "—"
      // Summary: "Ицко | Богдан, Мария, Стефан" or "Ицко (0/3)"
      const summary  = clients.length
        ? `${s.coach_name} | ${names}`
        : `${s.coach_name} (${filled})`
      // Description with line breaks
      const descParts = [`Треньор: ${s.coach_name}`, `Записани (${filled}): ${names}`]
      if (s.notes) descParts.push(`Бележки: ${s.notes}`)
      const desc = descParts.join("\\n")

      lines.push(
        "BEGIN:VEVENT",
        fold(`DTSTART;TZID=Europe/Sofia:${toICSDateTime(s.slot_date, s.start_time)}`),
        fold(`DTEND;TZID=Europe/Sofia:${toICSDateTime(s.slot_date, s.end_time)}`),
        fold(`SUMMARY:${esc(summary)}`),
        fold(`DESCRIPTION:${esc(desc)}`),
        `UID:synrg-${s.id}@synrg-beyondfitness.com`,
        `DTSTAMP:${stamp}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
      )
    }

    lines.push("END:VCALENDAR")
    const ics = lines.join("\r\n")

    return new Response(ics, {
      headers: {
        ...CORS,
        "Content-Type":        "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="synrg-schedule.ics"',
        "Cache-Control":       "public, max-age=3600",
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    })
  }
})
