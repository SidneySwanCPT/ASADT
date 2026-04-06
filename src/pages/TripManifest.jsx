import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { ArrowLeft, Users, Phone, Mail, Globe, CreditCard, CheckSquare, AlertTriangle, Printer } from "lucide-react"
import { Spinner, StatusBadge, OccasionBadge, Badge, Button } from "../components/UI"

function getMissing(client) {
  const m = []
  if (!client.passport_number) m.push("passport")
  if (!client.passport_expiry)  m.push("expiry")
  if (!client.date_of_birth)    m.push("DOB")
  if (!client.email)            m.push("email")
  if (!client.phone)            m.push("phone")
  return m
}

export default function TripManifest() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip]         = useState(null)
  const [members, setMembers]   = useState([])
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from("trips")
        .select("*, clients(id,first_name,last_name,email,phone,date_of_birth,passport_number,passport_expiry,nationality,preferred_airline,preferred_seat,preferred_cabin,dietary_restrictions,special_needs,emergency_contact_name,emergency_contact_phone,home_airport,preferences,notes)")
        .eq("id", id)
        .single()

      setTrip(t)

      // Load group members if group exists
      if (t?.group_id) {
        const { data: gm } = await supabase
          .from("group_members")
          .select("*, clients(id,first_name,last_name,email,phone,date_of_birth,passport_number,passport_expiry,nationality,preferred_airline,preferred_seat,preferred_cabin,dietary_restrictions,special_needs,emergency_contact_name,emergency_contact_phone,home_airport,preferences,notes), travelers(id,full_name,date_of_birth,passport_number,passport_expiry,relationship,notes)")
          .eq("group_id", t.group_id)
          .eq("removed", false)
        setMembers(gm || [])
      }

      // Load tasks for this trip
      const { data: tk } = await supabase
        .from("tasks")
        .select("*, travelers(full_name)")
        .eq("trip_id", id)
        .order("completed")
        .order("priority")
      setTasks(tk || [])

      setLoading(false)
    }
    load()
  }, [id])

  const printManifest = () => {
    window.print()
  }

  if (loading) return <Spinner />
  if (!trip)   return <div className="p-6 text-slate-500">Trip not found.</div>

  const balance = Math.max(0, parseFloat(trip.total_price||0) - parseFloat(trip.amount_paid||0))

  // Build full traveler list: lead client + group members
  const allTravelers = []

  // Lead client
  if (trip.clients) {
    allTravelers.push({
      type: "client",
      role: "Lead",
      data: trip.clients,
      payment_status: "N/A",
      amount_owed: 0,
      confirmation_number: trip.confirmation_number,
    })
  }

  // Group members
  members.forEach(m => {
    if (m.clients && m.clients.id !== trip.clients?.id) {
      allTravelers.push({ type: "client", role: m.role, data: m.clients, payment_status: m.payment_status, amount_owed: m.amount_owed, confirmation_number: m.confirmation_number })
    } else if (m.travelers) {
      allTravelers.push({ type: "traveler", role: m.role, data: m.travelers, payment_status: m.payment_status, amount_owed: m.amount_owed, confirmation_number: m.confirmation_number })
    }
  })

  const paidCount    = members.filter(m => m.payment_status === "Paid in Full").length
  const unpaidCount  = members.filter(m => ["Pending","Overdue"].includes(m.payment_status)).length
  const openTasks    = tasks.filter(t => !t.completed)
  const doneTasks    = tasks.filter(t => t.completed)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 print:p-4 print:max-w-none">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={() => navigate("/trips")} className="text-slate-400 hover:text-brand-500 p-1 rounded-lg hover:bg-brand-50 transition-colors">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800" style={{fontFamily:"Georgia,serif"}}>
            {trip.group_name || trip.destination} — Trip Manifest
          </h1>
          <p className="text-sm text-slate-500">
            {trip.departure_date ? format(new Date(trip.departure_date), "MMMM d, yyyy") : "Date TBD"}
            {trip.return_date ? ` → ${format(new Date(trip.return_date), "MMMM d, yyyy")}` : ""}
            {" · "}{allTravelers.length} traveler{allTravelers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={printManifest} variant="secondary" size="sm">
          <Printer size={14}/>Print manifest
        </Button>
        <Link to="/trips"><Button variant="ghost" size="sm">Back to trips</Button></Link>
      </div>

      {/* Print header */}
      <div className="hidden print:block border-b-2 border-brand-500 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{color:"#8B1A4A",fontFamily:"Georgia,serif"}}>
              {trip.group_name || trip.destination}
            </h1>
            <p className="text-sm text-slate-500">Trip Manifest · ASA Destination Travel</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>{trip.departure_date ? format(new Date(trip.departure_date), "MMMM d, yyyy") : "TBD"}{trip.return_date ? ` → ${format(new Date(trip.return_date), "MMMM d, yyyy")}` : ""}</p>
            <p>Printed {format(new Date(), "MMMM d, yyyy")}</p>
          </div>
        </div>
      </div>

      {/* Trip summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Destination",    value: trip.destination,                                         color: "bg-brand-50 text-brand-700 border-brand-100"  },
          { label: "Total travelers",value: allTravelers.length,                                      color: "bg-slate-50 text-slate-700 border-slate-100"  },
          { label: "Total price",    value: `$${parseFloat(trip.total_price||0).toLocaleString()}`,   color: "bg-green-50 text-green-700 border-green-100"  },
          { label: "Balance due",    value: `$${balance.toLocaleString()}`,                           color: balance > 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100" },
          { label: "Conf #",         value: trip.confirmation_number || "Pending",                   color: "bg-slate-50 text-slate-700 border-slate-100"  },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.color}`}>
            <p className="text-xs opacity-70 uppercase tracking-wide">{s.label}</p>
            <p className="text-sm font-bold mt-0.5 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Payment status summary */}
      {members.length > 0 && (
        <div className="flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment status:</p>
          <span className="text-sm text-green-600 font-semibold">{paidCount} paid in full</span>
          <span className="text-sm text-amber-600 font-semibold">{members.filter(m=>m.payment_status==="Deposit Paid").length} deposit only</span>
          <span className="text-sm text-red-500 font-semibold">{unpaidCount} unpaid</span>
        </div>
      )}

      {/* Traveler cards */}
      <div>
        <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={12}/>All travelers ({allTravelers.length})
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allTravelers.map((t, i) => {
            const isClient  = t.type === "client"
            const d         = t.data
            const name      = isClient ? `${d.first_name} ${d.last_name}` : d.full_name
            const missing   = isClient ? getMissing(d) : []
            const initials  = name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()

            return (
              <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Traveler header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100" style={{background:"#fdf2f7"}}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800">{name}</p>
                      <Badge label={t.role} color="pink" />
                      {isClient && <Badge label="Client" color="blue" />}
                      {missing.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle size={9}/>Missing: {missing.join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {t.payment_status && t.payment_status !== "N/A" && <StatusBadge status={t.payment_status} />}
                      {t.amount_owed > 0 && <span className="text-xs text-red-500">Owes: ${parseFloat(t.amount_owed).toLocaleString()}</span>}
                      {t.confirmation_number && <span className="text-xs text-slate-400">Conf: {t.confirmation_number}</span>}
                    </div>
                  </div>
                  {isClient && (
                    <Link to={`/clients/${d.id}`} className="text-xs text-brand-500 hover:text-brand-700 font-medium flex-shrink-0">View profile →</Link>
                  )}
                </div>

                {/* Traveler details */}
                <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1">
                  {d.date_of_birth && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Date of birth</p>
                      <p className="text-sm text-slate-700 font-medium">{format(new Date(d.date_of_birth), "MMM d, yyyy")}</p>
                    </div>
                  )}
                  {d.passport_number && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Passport #</p>
                      <p className="text-sm text-slate-700 font-medium font-mono">{d.passport_number}</p>
                    </div>
                  )}
                  {d.passport_expiry && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Passport expiry</p>
                      <p className="text-sm text-slate-700 font-medium">{format(new Date(d.passport_expiry), "MMM d, yyyy")}</p>
                    </div>
                  )}
                  {d.nationality && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Nationality</p>
                      <p className="text-sm text-slate-700 font-medium">{d.nationality}</p>
                    </div>
                  )}
                  {isClient && d.email && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Email</p>
                      <a href={`mailto:${d.email}`} className="text-sm text-brand-600 font-medium hover:underline">{d.email}</a>
                    </div>
                  )}
                  {isClient && d.phone && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Phone</p>
                      <a href={`tel:${d.phone}`} className="text-sm text-brand-600 font-medium hover:underline">{d.phone}</a>
                    </div>
                  )}
                  {isClient && d.home_airport && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Home airport</p>
                      <p className="text-sm text-slate-700 font-medium">{d.home_airport}</p>
                    </div>
                  )}
                  {isClient && d.preferred_seat && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Seat pref.</p>
                      <p className="text-sm text-slate-700 font-medium">{d.preferred_seat}</p>
                    </div>
                  )}
                  {isClient && d.preferred_cabin && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Cabin</p>
                      <p className="text-sm text-slate-700 font-medium">{d.preferred_cabin}</p>
                    </div>
                  )}
                  {isClient && d.dietary_restrictions && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Dietary</p>
                      <p className="text-sm text-slate-700 font-medium">{d.dietary_restrictions}</p>
                    </div>
                  )}
                  {isClient && d.special_needs && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Special needs</p>
                      <p className="text-sm text-slate-700 font-medium">{d.special_needs}</p>
                    </div>
                  )}
                  {isClient && d.emergency_contact_name && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Emergency contact</p>
                      <p className="text-sm text-slate-700 font-medium">{d.emergency_contact_name} {d.emergency_contact_phone ? `· ${d.emergency_contact_phone}` : ""}</p>
                    </div>
                  )}
                  {!isClient && d.relationship && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide">Relationship</p>
                      <p className="text-sm text-slate-700 font-medium">{d.relationship}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckSquare size={12}/>Tasks ({openTasks.length} open, {doneTasks.length} done)
          </p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
            {tasks.map(task => (
              <div key={task.id} className={`px-4 py-2.5 flex items-center gap-3 ${task.completed ? "opacity-50" : ""}`}>
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${task.completed ? "border-green-500" : "border-slate-300"}`}
                  style={task.completed ? {background:"#22c55e"} : {}}>
                  {task.completed && <span className="text-white text-xs leading-none">✓</span>}
                </div>
                <p className={`text-sm flex-1 ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>{task.title}</p>
                {task.travelers && <span className="text-xs text-brand-400">{task.travelers.full_name}</span>}
                {task.due_date && <span className="text-xs text-slate-400">{format(new Date(task.due_date),"MMM d")}</span>}
                <StatusBadge status={task.priority} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
