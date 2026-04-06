import { useState } from "react"
import { callClaude } from "../lib/claude"
import { Sparkles, X, RefreshCw, Phone } from "lucide-react"
import { Button } from "./UI"

export default function AIClientBriefing({ client, trips, tasks, travelers, loyalty, open, onClose }) {
  const [briefing, setBriefing] = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")

  // Guard — don't render at all if not open
  if (!open) return null

  const generate = async () => {
    setLoading(true); setError(""); setBriefing("")

    const upcoming = (trips || []).filter(t => t.departure_date && new Date(t.departure_date) >= new Date() && t.status !== "Cancelled")
    const past     = (trips || []).filter(t => !upcoming.includes(t))
    const openTasks = (tasks || []).filter(t => !t.completed)
    const balance  = upcoming.reduce((s, t) => s + Math.max(0, parseFloat(t.total_price||0) - parseFloat(t.amount_paid||0)), 0)

    const clientData = {
      name:          `${client.first_name} ${client.last_name}`,
      email:         client.email,
      phone:         client.phone,
      homeAirport:   client.home_airport,
      budget:        client.typical_budget,
      preferredAirline: client.preferred_airline,
      preferredSeat: client.preferred_seat,
      preferredCabin: client.preferred_cabin,
      hotel:         client.preferred_hotel_tier,
      dietary:       client.dietary_restrictions,
      specialNeeds:  client.special_needs,
      preferences:   client.preferences,
      notes:         client.notes,
      passportExpiry: client.passport_expiry,
      upcomingTrips: upcoming.map(t => ({
        destination: t.destination,
        departure:   t.departure_date,
        return:      t.return_date,
        status:      t.status,
        occasion:    t.occasion,
        balance:     Math.max(0, parseFloat(t.total_price||0) - parseFloat(t.amount_paid||0)),
        confirmation: t.confirmation_number,
        groupName:   t.group_name,
      })),
      pastTrips: past.slice(0,5).map(t => ({ destination: t.destination, departure: t.departure_date, occasion: t.occasion })),
      openTasks: openTasks.map(t => t.title),
      travelers: (travelers||[]).map(t => `${t.full_name} (${t.relationship})`),
      loyaltyNumbers: (loyalty||[]).map(l => `${l.airline_or_cruise}: ${l.number}`),
      totalOutstandingBalance: balance,
    }

    const system = `You are a travel agent assistant. Generate a concise pre-call briefing for a travel agent about to speak with a client.
Format the output as clean readable text with clear sections.
Use plain text only — no markdown symbols like ** or ##. Use ALL CAPS for section headers followed by a colon.
Be warm but professional. Highlight anything that needs immediate attention.`

    const prompt = `Generate a pre-call briefing for this client:

${JSON.stringify(clientData, null, 2)}

Include these sections:
1. WHO IS THIS CLIENT (2-3 sentences — personality, travel style, loyalty)
2. UPCOMING TRIPS (details on all upcoming bookings, especially any with outstanding balances)
3. OUTSTANDING BALANCES (any money owed)
4. OPEN TASKS (what needs to get done)
5. TRAVEL HISTORY (quick summary of past trips)
6. PREFERENCES TO REMEMBER (key things to keep in mind)
7. SUGGESTED TALKING POINTS (3-4 bullet points for this call)

Keep it tight and actionable.`

    try {
      const result = await callClaude(system, prompt, 1500)
      setBriefing(result)
    } catch (e) {
      setError("Could not generate briefing. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{background:"#8B1A4A"}}>
          <div>
            <h2 className="text-base font-bold text-white" style={{fontFamily:"Georgia,serif"}}>Pre-call briefing</h2>
            <p className="text-xs text-brand-200 mt-0.5">{client.first_name} {client.last_name}</p>
          </div>
          <div className="flex gap-2">
            {briefing && (
              <button onClick={() => { setBriefing(""); generate() }}
                className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
                <RefreshCw size={13}/>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
              <X size={13}/>
            </button>
          </div>
        </div>

        <div className="p-5">
          {!briefing && !loading && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="bg-brand-50 rounded-full p-4">
                <Phone size={24} className="text-brand-400"/>
              </div>
              <div className="text-center">
                <p className="text-slate-700 font-medium">Ready to prepare for your call?</p>
                <p className="text-sm text-slate-400 mt-1">Claude will analyze everything we know about {client.first_name} and give you a complete briefing — travel history, open balances, preferences, and talking points.</p>
              </div>
              <Button onClick={generate} size="lg">
                <Sparkles size={16}/>Generate briefing
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin"/>
              <p className="text-sm text-slate-400">Preparing your briefing...</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {briefing && (
            <div className="bg-slate-50 rounded-xl p-4">
              <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{briefing}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
