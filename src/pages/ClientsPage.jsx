import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"
import { Users, Search, Plus, Phone, Mail, AlertTriangle, Filter, Globe, ChevronDown, ChevronRight, List, GitBranch, ArrowRight } from "lucide-react"
import { differenceInDays } from "date-fns"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, MissingDot } from "../components/UI"

const EMPTY = {
  first_name:"", last_name:"", email:"", phone:"", date_of_birth:"",
  address_street:"", address_city:"", address_state:"", address_zip:"",
  passport_number:"", passport_expiry:"", nationality:"", preferences:"",
  emergency_contact_name:"", emergency_contact_phone:"", notes:"",
  preferred_airline:"", preferred_cruise_line:"", preferred_seat:"",
  preferred_cabin:"", preferred_hotel_tier:"", preferred_transport:"",
  preferred_rental_car:"", home_airport:"", typical_budget:"",
  dietary_restrictions:"", special_needs:"", referral_source:"",
  is_minor: false
}

const SEATS      = ["","Window","Aisle","Middle","No preference"]
const CABINS     = ["","Economy","Premium Economy","Business","First"]
const HOTELS     = ["","Budget","Mid-range","Luxury","Boutique","No preference"]
const TRANSPORTS = ["","Uber/Lyft","Taxi","Rental Car","Public Transit","No preference"]
const CARS       = ["","Economy","Compact","Midsize","SUV","Luxury","No preference"]
const BUDGETS    = ["","Under $1,000","$1,000 – $3,000","$3,000 – $5,000","$5,000 – $10,000","$10,000+"]

function getMissingFields(client) {
  const m = []
  if (!client.email)                  m.push("email")
  if (!client.phone)                  m.push("phone")
  if (!client.passport_number)        m.push("passport #")
  if (!client.passport_expiry)        m.push("passport expiry")
  if (!client.date_of_birth)          m.push("DOB")
  if (!client.emergency_contact_name) m.push("emergency contact")
  return m
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients]     = useState([])
  const [trips, setTrips]         = useState([])
  const [travelers, setTravelers] = useState([])
  const [groups, setGroups]       = useState([])
  const [members, setMembers]     = useState([])
  const [search, setSearch]       = useState("")
  const [destFilter, setDest]     = useState("")
  const [depFilter, setDep]       = useState("")
  const [showFilters, setFilters] = useState(false)
  const [viewMode, setViewMode]   = useState("list") // "list" | "tree"
  const [expandedGroups, setExpanded] = useState({})
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [tab, setTab]             = useState("basic")

  const load = async () => {
    const [{ data: c }, { data: t }, { data: tv }, { data: g }, { data: gm }] = await Promise.all([
      supabase.from("clients").select("*").order("last_name").order("first_name"),
      supabase.from("trips").select("client_id,destination,departure_date,status,id,group_id,group_name").neq("status","Cancelled"),
      supabase.from("travelers").select("*").order("full_name"),
      supabase.from("groups").select("*, trips(destination,departure_date)").eq("status","Active"),
      supabase.from("group_members").select("*, clients(id,first_name,last_name)").eq("removed",false),
    ])
    setClients(c || [])
    setTrips(t || [])
    setTravelers(tv || [])
    setGroups(g || [])
    setMembers(gm || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(EMPTY); setTab("basic"); setModal(true) }
  const openEdit = (e, c) => { e.stopPropagation(); setEditing(c); setForm({ ...EMPTY, ...c }); setTab("basic"); setModal(true) }

  const save = async () => {
    setSaving(true)
    // Clean empty strings to null for optional fields
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === "" ? null : v])
    )
    // Keep required fields
    payload.first_name = form.first_name
    payload.last_name  = form.last_name
    payload.is_minor   = form.is_minor || false

    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload)

    if (error) {
      alert("Error saving client: " + error.message)
      setSaving(false)
      return
    }
    setSaving(false); setModal(false); load()
  }

  const deleteClient = async (e, id) => {
    e.stopPropagation()
    if (!confirm("Delete this client and all their data?")) return
    await supabase.from("clients").delete().eq("id", id)
    load()
  }

  const field = (k) => ({ value: form[k] === undefined || form[k] === null ? "" : form[k], onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const clientTripsMap = {}
  trips.forEach(t => {
    if (!clientTripsMap[t.client_id]) clientTripsMap[t.client_id] = []
    clientTripsMap[t.client_id].push(t)
  })

  const destinations = [...new Set(trips.map(t => t.destination).filter(Boolean))].sort()

  const filtered = clients.filter(c => {
    const ms = `${c.first_name} ${c.last_name} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(search.toLowerCase())
    const cTrips = clientTripsMap[c.id] || []
    const matchDest = !destFilter || cTrips.some(t => t.destination?.toLowerCase().includes(destFilter.toLowerCase()))
    let matchDep = true
    if (depFilter === "30")      matchDep = cTrips.some(t => t.departure_date && differenceInDays(new Date(t.departure_date), new Date()) <= 30  && differenceInDays(new Date(t.departure_date), new Date()) >= 0)
    else if (depFilter === "90") matchDep = cTrips.some(t => t.departure_date && differenceInDays(new Date(t.departure_date), new Date()) <= 90  && differenceInDays(new Date(t.departure_date), new Date()) >= 0)
    else if (depFilter === "past")   matchDep = cTrips.some(t => t.departure_date && new Date(t.departure_date) < new Date())
    else if (depFilter === "future") matchDep = cTrips.some(t => t.departure_date && new Date(t.departure_date) >= new Date())
    return ms && matchDest && matchDep
  }).sort((a, b) => {
    const la = (a.last_name || "").toLowerCase()
    const lb = (b.last_name || "").toLowerCase()
    if (la !== lb) return la.localeCompare(lb)
    return (a.first_name || "").toLowerCase().localeCompare((b.first_name || "").toLowerCase())
  })

  // Build group tree
  const groupTree = groups.map(g => {
    const leadClient = clients.find(c => c.id === g.lead_client_id)
    const groupMembers = members
      .filter(m => m.group_id === g.id)
      .map(m => m.clients)
      .filter(Boolean)
    return { ...g, leadClient, groupMembers }
  })

  // Also include clients with travelers but no formal group
  const clientsWithTravelers = clients.filter(c => {
    const hasTravelers = travelers.filter(t => t.client_id === c.id).length > 1
    const inGroup = groups.some(g => g.lead_client_id === c.id)
    return hasTravelers && !inGroup
  }).map(c => ({
    id: `traveler_${c.id}`,
    name: `${c.first_name} ${c.last_name}`,
    leadClient: c,
    groupMembers: [],
    travelers: travelers.filter(t => t.client_id === c.id && t.relationship !== 'Self'),
    trips: { destination: clientTripsMap[c.id]?.[0]?.destination }
  }))

  const totalMissing = clients.filter(c => getMissingFields(c).length > 0).length
  const withTrips    = Object.keys(clientTripsMap).length
  const activeTrips  = trips.filter(t => ["Confirmed","Paid","Departed"].includes(t.status)).length

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} total clients — sorted A–Z`}
        action={<Button onClick={openNew} size="lg"><Plus size={16}/>Add client</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label:"Total clients",       value: clients.length, color:"bg-brand-50 text-brand-600 border-brand-100", action: () => { setSearch(""); setDest(""); setDep("") } },
          { label:"With active trips",   value: withTrips,      color:"bg-green-50 text-green-600 border-green-100",  action: () => { setDep("future"); setSearch("") } },
          { label:"Active bookings",     value: activeTrips,    color:"bg-blue-50 text-blue-600 border-blue-100",     action: () => navigate("/trips") },
          { label:"Incomplete profiles", value: totalMissing,   color:"bg-amber-50 text-amber-600 border-amber-100",  action: () => { setSearch(""); setDep(""); setDest(""); setFilters(true) } },
        ].map(({ label, value, color, action }) => (
          <div key={label} onClick={action}
            className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-all group ${color}`}>
            <div className="flex-1">
              <p className="text-2xl font-bold leading-tight">{value}</p>
              <p className="text-xs opacity-80 mt-0.5">{label}</p>
            </div>
            <ArrowRight size={13} className="opacity-30 group-hover:opacity-80 transition-opacity mt-1 flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* Search + filters + view toggle */}
      <div className="space-y-2 mb-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
          </div>
          <Button variant="secondary" onClick={() => setFilters(f => !f)}>
            <Filter size={14}/>Filters {(destFilter||depFilter) ? "•" : ""}
          </Button>
          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            <button onClick={() => setViewMode("list")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${viewMode==="list"?"text-white":"text-slate-500 hover:bg-brand-50"}`}
              style={viewMode==="list"?{background:"#8B1A4A"}:{}}>
              <List size={14}/>List
            </button>
            <button onClick={() => setViewMode("tree")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${viewMode==="tree"?"text-white":"text-slate-500 hover:bg-brand-50"}`}
              style={viewMode==="tree"?{background:"#8B1A4A"}:{}}>
              <GitBranch size={14}/>Groups
            </button>
          </div>
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

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && (
        filtered.length === 0
          ? <EmptyState icon={Users} title="No clients found"
              action={<Button onClick={openNew} size="lg"><Plus size={16}/>Add first client</Button>} />
          : (
            <Card>
              <div className="divide-y divide-slate-50">
                {filtered.map(c => {
                  const missing  = getMissingFields(c)
                  const cTrips   = clientTripsMap[c.id] || []
                  const nextTrip = cTrips.find(t => t.departure_date && new Date(t.departure_date) >= new Date())
                  const passWarn = c.passport_expiry ? differenceInDays(new Date(c.passport_expiry), new Date()) : null

                  return (
                    <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-brand-50 transition-colors cursor-pointer group">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">
                            {c.first_name} {c.last_name}
                          </p>
                          {missing.length > 0 && <MissingDot tooltip={`Missing: ${missing.join(", ")}`} />}
                          {c.is_minor && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Minor</span>}
                          {c.referral_source === "Vacation Package" && <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">Vacation Pkg</span>}
                          {passWarn !== null && passWarn < 180 && (
                            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle size={9}/>{passWarn < 0 ? "Passport expired" : `Passport expires ${passWarn}d`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          {c.email && (
                            <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors">
                              <Mail size={13}/>{c.email}
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors">
                              <Phone size={13}/>{c.phone}
                            </a>
                          )}
                          {c.home_airport && <span className="text-xs text-brand-400 font-medium bg-brand-50 px-2 py-0.5 rounded-full">{c.home_airport}</span>}
                          {nextTrip && <span className="text-xs text-green-600 font-medium">Next: {nextTrip.destination}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-slate-400">{cTrips.length} trip{cTrips.length!==1?"s":""}</span>
                        <Button variant="ghost" size="sm" onClick={e => openEdit(e, c)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-50" onClick={e => deleteClient(e, c.id)}>Delete</Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
      )}

      {/* ── TREE / GROUP VIEW ── */}
      {viewMode === "tree" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
            Showing {groupTree.length + clientsWithTravelers.length} groups and travel families. A client may appear in multiple groups.
          </p>

          {/* Formal groups (from trips) */}
          {groupTree.map(g => {
            const isOpen = expandedGroups[g.id] !== false // default open
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-brand-50 transition-colors"
                  onClick={() => setExpanded(e => ({ ...e, [g.id]: !isOpen }))}>
                  <button className="text-brand-400 flex-shrink-0">
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Globe size={13} className="text-brand-400"/>
                      <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                      <span className="text-xs bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full">
                        {g.groupMembers.length + 1} travelers
                      </span>
                    </div>
                    {g.trips && <p className="text-xs text-slate-400 ml-5">{g.trips.destination}</p>}
                  </div>
                  {g.leadClient && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      Lead: {g.leadClient.first_name} {g.leadClient.last_name}
                    </span>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Lead client */}
                    {g.leadClient && (
                      <div onClick={() => navigate(`/clients/${g.leadClient.id}`)}
                        className="flex items-center gap-3 px-6 py-2.5 hover:bg-brand-50 transition-colors cursor-pointer border-b border-slate-50">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                          {g.leadClient.first_name?.[0]}{g.leadClient.last_name?.[0]}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{g.leadClient.first_name} {g.leadClient.last_name}</p>
                          {g.leadClient.email && <p className="text-xs text-slate-400">{g.leadClient.email}</p>}
                        </div>
                        <span className="text-xs bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full font-medium">Lead</span>
                      </div>
                    )}
                    {/* Group members */}
                    {g.groupMembers.map((m, i) => m && (
                      <div key={i} onClick={() => navigate(`/clients/${m.id}`)}
                        className="flex items-center gap-3 px-6 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold flex-shrink-0">
                          {m.first_name?.[0]}{m.last_name?.[0]}
                        </div>
                        <p className="text-sm text-slate-700 flex-1">{m.first_name} {m.last_name}</p>
                        <span className="text-xs text-slate-400">Member</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}

          {/* Client-traveler families (no formal group yet) */}
          {clientsWithTravelers.map(g => {
            const isOpen = expandedGroups[g.id] !== false
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-brand-50 transition-colors"
                  onClick={() => setExpanded(e => ({ ...e, [g.id]: !isOpen }))}>
                  <button className="text-brand-400 flex-shrink-0">
                    {isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-brand-400"/>
                      <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {g.travelers.length + 1} travelers
                      </span>
                    </div>
                    {g.trips?.destination && <p className="text-xs text-slate-400 ml-5">{g.trips.destination}</p>}
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-100">
                    <div onClick={() => navigate(`/clients/${g.leadClient.id}`)}
                      className="flex items-center gap-3 px-6 py-2.5 hover:bg-brand-50 transition-colors cursor-pointer border-b border-slate-50">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                        {g.leadClient.first_name?.[0]}{g.leadClient.last_name?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{g.leadClient.first_name} {g.leadClient.last_name}</p>
                        {g.leadClient.email && <p className="text-xs text-slate-400">{g.leadClient.email}</p>}
                      </div>
                      <span className="text-xs bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full font-medium">Lead</span>
                    </div>
                    {g.travelers.map((tv, i) => (
                      <div key={i} className="flex items-center gap-3 px-6 py-2.5 border-b border-slate-50 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold flex-shrink-0">
                          {tv.full_name?.[0]}
                        </div>
                        <p className="text-sm text-slate-700 flex-1">{tv.full_name}</p>
                        <span className="text-xs text-slate-400">{tv.relationship}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? `Edit — ${editing.first_name} ${editing.last_name}` : "Add new client"} wide
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.first_name || !form.last_name}>
            {saving ? "Saving..." : "Save client"}
          </Button>
        </>}>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm -mt-1">
          {[["basic","Basic info"],["travel","Travel preferences"],["passport","Passport & emergency"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 transition-colors text-xs font-medium ${tab===key?"text-white":"text-slate-500 hover:bg-brand-50"}`}
              style={tab===key?{background:"#8B1A4A"}:{}}>
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
            <Input label="Street address" {...field("address_street")} placeholder="123 Main St" />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City"  {...field("address_city")}  placeholder="Macon" />
              <Input label="State" {...field("address_state")} placeholder="GA" />
              <Input label="Zip"   {...field("address_zip")}   placeholder="31201" />
            </div>
            <Input label="Referral source" {...field("referral_source")} placeholder="How did they find ASA?" />
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <input type="checkbox" id="is_minor" checked={form.is_minor||false}
                onChange={e => setForm(f => ({ ...f, is_minor: e.target.checked }))}
                className="w-4 h-4 accent-amber-500" />
              <label htmlFor="is_minor" className="text-sm text-amber-700 font-medium cursor-pointer">
                This client is a minor (under 18)
              </label>
            </div>
            <Textarea label="Notes" {...field("notes")} />
          </>
        )}
        {tab === "travel" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Preferred airline"     {...field("preferred_airline")}     placeholder="Delta, Southwest..." />
              <Input label="Preferred cruise line" {...field("preferred_cruise_line")} placeholder="Carnival, Royal Caribbean..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Preferred seat"  {...field("preferred_seat")}>{SEATS.map(s=><option key={s}>{s}</option>)}</Select>
              <Select label="Cabin class"     {...field("preferred_cabin")}>{CABINS.map(c=><option key={c}>{c}</option>)}</Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Hotel preference"  {...field("preferred_hotel_tier")}>{HOTELS.map(h=><option key={h}>{h}</option>)}</Select>
              <Select label="Ground transport"  {...field("preferred_transport")}>{TRANSPORTS.map(t=><option key={t}>{t}</option>)}</Select>
            </div>
            <Select label="Rental car preference" {...field("preferred_rental_car")}>{CARS.map(c=><option key={c}>{c}</option>)}</Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Dietary restrictions" {...field("dietary_restrictions")} placeholder="Vegetarian, Gluten-free..." />
              <Input label="Special needs"        {...field("special_needs")}        placeholder="Wheelchair, mobility..." />
            </div>
            <Textarea label="General travel preferences" {...field("preferences")} placeholder="Window seat, prefers boutique hotels..." />
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
