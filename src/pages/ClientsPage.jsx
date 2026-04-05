import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import { Users, Search, Plus, Phone, Mail, AlertTriangle, Filter } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, StatsBar, MissingDot } from "../components/UI"

const EMPTY = {
  first_name:"", last_name:"", email:"", phone:"", date_of_birth:"",
  passport_number:"", passport_expiry:"", nationality:"", preferences:"",
  emergency_contact_name:"", emergency_contact_phone:"", notes:"",
  preferred_airline:"", preferred_cruise_line:"", preferred_seat:"",
  preferred_cabin:"", preferred_hotel_tier:"", preferred_transport:"",
  preferred_rental_car:"", home_airport:"", typical_budget:"",
  dietary_restrictions:"", special_needs:"", referral_source:""
}

const SEATS    = ["","Window","Aisle","Middle","No preference"]
const CABINS   = ["","Economy","Premium Economy","Business","First"]
const HOTELS   = ["","Budget","Mid-range","Luxury","Boutique","No preference"]
const TRANSPORTS = ["","Uber/Lyft","Taxi","Rental Car","Public Transit","No preference"]
const CARS     = ["","Economy","Compact","Midsize","SUV","Luxury","No preference"]
const BUDGETS  = ["","Under $1,000","$1,000 – $3,000","$3,000 – $5,000","$5,000 – $10,000","$10,000+"]

function getMissingFields(client) {
  const critical = []
  if (!client.email) critical.push("email")
  if (!client.phone) critical.push("phone")
  if (!client.passport_number) critical.push("passport #")
  if (!client.passport_expiry) critical.push("passport expiry")
  if (!client.date_of_birth) critical.push("DOB")
  if (!client.emergency_contact_name) critical.push("emergency contact")
  return critical
}

export default function ClientsPage() {
  const [clients, setClients]     = useState([])
  const [trips, setTrips]         = useState([])
  const [search, setSearch]       = useState("")
  const [destFilter, setDest]     = useState("")
  const [depFilter, setDep]       = useState("")
  const [showFilters, setFilters] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [tab, setTab]             = useState("basic")

  const load = async () => {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("clients").select("*").order("last_name"),
      supabase.from("trips").select("client_id,destination,departure_date,status").neq("status","Cancelled"),
    ])
    setClients(c || [])
    setTrips(t || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(EMPTY); setTab("basic"); setModal(true) }
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY, ...c }); setTab("basic"); setModal(true) }

  const save = async () => {
    setSaving(true)
    if (editing) {
      await supabase.from("clients").update(form).eq("id", editing.id)
    } else {
      await supabase.from("clients").insert(form)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const deleteClient = async (id) => {
    if (!confirm("Delete this client and all their data?")) return
    await supabase.from("clients").delete().eq("id", id)
    load()
  }

  const field = (k) => ({ value: form[k] || "", onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  // Build client → trips map
  const clientTripsMap = {}
  trips.forEach(t => {
    if (!clientTripsMap[t.client_id]) clientTripsMap[t.client_id] = []
    clientTripsMap[t.client_id].push(t)
  })

  // Unique destinations for filter
  const destinations = [...new Set(trips.map(t => t.destination).filter(Boolean))].sort()

  const filtered = clients.filter(c => {
    const matchSearch = `${c.first_name} ${c.last_name} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(search.toLowerCase())
    const cTrips = clientTripsMap[c.id] || []

    const matchDest = !destFilter || cTrips.some(t => t.destination?.toLowerCase().includes(destFilter.toLowerCase()))

    let matchDep = true
    if (depFilter === "30") matchDep = cTrips.some(t => t.departure_date && differenceInDays(new Date(t.departure_date), new Date()) <= 30 && differenceInDays(new Date(t.departure_date), new Date()) >= 0)
    else if (depFilter === "90") matchDep = cTrips.some(t => t.departure_date && differenceInDays(new Date(t.departure_date), new Date()) <= 90 && differenceInDays(new Date(t.departure_date), new Date()) >= 0)
    else if (depFilter === "past") matchDep = cTrips.some(t => t.departure_date && new Date(t.departure_date) < new Date())
    else if (depFilter === "future") matchDep = cTrips.some(t => t.departure_date && new Date(t.departure_date) >= new Date())

    return matchSearch && matchDest && matchDep
  })

  const totalMissing = clients.filter(c => getMissingFields(c).length > 0).length
  const withTrips    = Object.keys(clientTripsMap).length
  const activeTrips  = trips.filter(t => t.status === "Confirmed" || t.status === "Paid" || t.status === "Departed").length

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} total clients`}
        action={
          <Button onClick={openNew} size="lg">
            <Plus size={16} />Add client
          </Button>
        }
      />

      <StatsBar stats={[
        { label: "Total clients",        value: clients.length, color: "pink",  icon: Users },
        { label: "With active trips",    value: withTrips,      color: "green"              },
        { label: "Active bookings",      value: activeTrips,    color: "blue"               },
        { label: "Incomplete profiles",  value: totalMissing,   color: "amber"              },
      ]} />

      {/* Search + filters */}
      <div className="space-y-2 mb-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white hover:border-brand-200 transition-colors" />
          </div>
          <Button variant="secondary" onClick={() => setFilters(f => !f)}>
            <Filter size={14} />Filters {(destFilter || depFilter) ? "•" : ""}
          </Button>
        </div>

        {showFilters && (
          <div className="flex gap-3 p-3 bg-brand-50 rounded-xl border border-brand-100">
            <div className="flex-1">
              <label className="text-xs font-medium text-brand-600 uppercase tracking-wide mb-1 block">Destination</label>
              <select value={destFilter} onChange={e => setDest(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">All destinations</option>
                {destinations.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-brand-600 uppercase tracking-wide mb-1 block">Departure</label>
              <select value={depFilter} onChange={e => setDep(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">Any time</option>
                <option value="30">Next 30 days</option>
                <option value="90">Next 90 days</option>
                <option value="future">Upcoming</option>
                <option value="past">Past travelers</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setDest(""); setDep("") }}>Clear</Button>
            </div>
          </div>
        )}
      </div>

      {/* Client list */}
      {filtered.length === 0
        ? <EmptyState icon={Users} title="No clients found"
            action={<Button onClick={openNew} size="lg"><Plus size={16} />Add first client</Button>} />
        : (
          <Card>
            <div className="divide-y divide-slate-50">
              {filtered.map(c => {
                const missing = getMissingFields(c)
                const cTrips = clientTripsMap[c.id] || []
                const nextTrip = cTrips.find(t => t.departure_date && new Date(t.departure_date) >= new Date())
                const passWarn = c.passport_expiry ? differenceInDays(new Date(c.passport_expiry), new Date()) : null

                return (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-brand-50 transition-colors">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{background:"#8B1A4A"}}>
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/clients/${c.id}`} className="text-sm font-semibold text-slate-800 hover:text-brand-600 transition-colors">
                          {c.first_name} {c.last_name}
                        </Link>
                        {missing.length > 0 && <MissingDot tooltip={`Missing: ${missing.join(", ")}`} />}
                        {passWarn !== null && passWarn < 180 && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle size={9} />{passWarn < 0 ? "Passport expired" : `Passport expires ${passWarn}d`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.email && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail size={10} />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone size={10} />{c.phone}</span>}
                        {c.home_airport && <span className="text-xs text-brand-400 font-medium">{c.home_airport}</span>}
                        {nextTrip && <span className="text-xs text-green-600">Next: {nextTrip.destination} {format(new Date(nextTrip.departure_date), "MMM d")}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-slate-400">{cTrips.length} trip{cTrips.length !== 1 ? "s" : ""}</span>
                      <Link to={`/clients/${c.id}`}><Button variant="secondary" size="sm">View</Button></Link>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-50" onClick={() => deleteClient(c.id)}>Delete</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      }

      {/* Add/Edit Modal with tabs */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? `Edit — ${editing.first_name} ${editing.last_name}` : "Add new client"} wide
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.first_name || !form.last_name}>
            {saving ? "Saving..." : "Save client"}
          </Button>
        </>}>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm -mt-1">
          {[["basic","Basic info"],["travel","Travel preferences"],["passport","Passport & emergency"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 transition-colors text-xs font-medium ${tab===key ? "text-white" : "text-slate-500 hover:bg-brand-50"}`}
              style={tab===key ? {background:"#8B1A4A"} : {}}>
              {label}
            </button>
          ))}
        </div>

        {tab === "basic" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" {...field("first_name")} placeholder="Jane" />
              <Input label="Last name"  {...field("last_name")}  placeholder="Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email"  type="email" {...field("email")} placeholder="jane@email.com" />
              <Input label="Phone"  {...field("phone")} placeholder="+1 555 000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date of birth" type="date" {...field("date_of_birth")} />
              <Input label="Nationality"   {...field("nationality")} placeholder="American" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Home airport" {...field("home_airport")} placeholder="ATL, MCN, SAV..." />
              <Select label="Typical budget" {...field("typical_budget")}>
                {BUDGETS.map(b => <option key={b}>{b}</option>)}
              </Select>
            </div>
            <Input label="Referral source" {...field("referral_source")} placeholder="How did they find ASA?" />
            <Textarea label="Notes" {...field("notes")} />
          </>
        )}

        {tab === "travel" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Preferred airline"      {...field("preferred_airline")}      placeholder="Delta, Southwest..." />
              <Input label="Preferred cruise line"  {...field("preferred_cruise_line")}  placeholder="Carnival, Royal Caribbean..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Preferred seat"   {...field("preferred_seat")}>
                {SEATS.map(s => <option key={s}>{s}</option>)}
              </Select>
              <Select label="Cabin class" {...field("preferred_cabin")}>
                {CABINS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Hotel preference"   {...field("preferred_hotel_tier")}>
                {HOTELS.map(h => <option key={h}>{h}</option>)}
              </Select>
              <Select label="Ground transport" {...field("preferred_transport")}>
                {TRANSPORTS.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <Select label="Rental car preference" {...field("preferred_rental_car")}>
              {CARS.map(c => <option key={c}>{c}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Dietary restrictions" {...field("dietary_restrictions")} placeholder="Vegetarian, Gluten-free..." />
              <Input label="Special needs"        {...field("special_needs")}        placeholder="Wheelchair, mobility..." />
            </div>
            <Textarea label="General travel preferences" {...field("preferences")}
              placeholder="Window seat, prefers boutique hotels, always books travel insurance..." />
          </>
        )}

        {tab === "passport" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Passport number"  {...field("passport_number")}  placeholder="A12345678" />
              <Input label="Passport expiry"  type="date" {...field("passport_expiry")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Emergency contact name"  {...field("emergency_contact_name")}  placeholder="John Smith" />
              <Input label="Emergency contact phone" {...field("emergency_contact_phone")} placeholder="+1 555 000 0001" />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
