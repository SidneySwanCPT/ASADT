import { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import { format, differenceInDays } from "date-fns"
import { Globe, Plus, Search, Calendar, List, ChevronLeft, ChevronRight, X, Edit2, Trash2, Users, CheckSquare, Upload, FileText, Eye, EyeOff, Sparkles } from "lucide-react"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, StatusBadge, OccasionBadge, Badge, StatsBar, InfoRow } from "../components/UI"
import AITaskSuggestions from "../components/AITaskSuggestions"
import AIEmailComposer from "../components/AIEmailComposer"
import { startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addMonths, subMonths } from "date-fns"

const STATUSES    = ["Quoted","Confirmed","Paid","Departed","Completed","Cancelled"]
const OCCASIONS   = ["","Birthday","Anniversary","Honeymoon","Girls Trip","Business","Family","Group","Other"]
const PAY_STATUSES = ["Pending","Deposit Paid","Paid in Full","Overdue","Cancelled"]
const EMPTY_TRIP  = { client_id:"", destination:"", departure_date:"", return_date:"", status:"Quoted", total_price:"", amount_paid:"0", booking_ref:"", confirmation_number:"", traveler_count:"1", occasion:"", credit_balance:"0", credit_notes:"", group_name:"", notes:"" }

export default function TripsPage() {
  const [trips, setTrips]           = useState([])
  const [clients, setClients]       = useState([])
  const [allTravelers, setAllTravelers] = useState([])
  const [search, setSearch]         = useState("")
  const [statusFilter, setStatus]   = useState("All")
  const [view, setView]             = useState("list")
  const [calMonth, setCalMonth]     = useState(new Date())
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [detailTrip, setDetailTrip] = useState(null)
  const [detailData, setDetailData] = useState({ tasks:[], members:[], docs:[] })
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState(EMPTY_TRIP)
  const [saving, setSaving]         = useState(false)
  const [addMemberModal, setAddMemberModal] = useState(false)
  const [memberForm, setMemberForm] = useState({ client_id:"", traveler_id:"", role:"Member", amount_owed:"", confirmation_number:"", notes:"", _mode:"existing" })
  const [showCompleted, setShowCompleted] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [aiTaskModal, setAiTaskModal] = useState(false)
  const [aiTaskTrip, setAiTaskTrip]   = useState(null)
  const [emailModal, setEmailModal]   = useState(false)
  const [clientSearch, setClientSearch] = useState("")
  const [tripTravelers, setTripTravelers] = useState([])
  const [travelerSearch, setTravelerSearch] = useState("")
  const [showNewTravelerInline, setShowNewTravelerInline] = useState(false)
  const [inlineTravelerForm, setInlineTravelerForm] = useState({ first_name:"", last_name:"", email:"", phone:"", date_of_birth:"", passport_number:"" })
  const fileRef = useRef(null)

  const load = async () => {
    const [{ data: t }, { data: c }, { data: tv }] = await Promise.all([
      supabase.from("trips").select("*, clients(id,first_name,last_name,email,phone)").order("departure_date", { ascending: false }),
      supabase.from("clients").select("id,first_name,last_name").order("last_name"),
      supabase.from("travelers").select("id,full_name,client_id").order("full_name"),
    ])
    setTrips(t || [])
    setClients(c || [])
    setAllTravelers(tv || [])
    setLoading(false)
  }

  const loadDetail = async (trip) => {
    const [{ data: tasks }, { data: members }, { data: docs }] = await Promise.all([
      supabase.from("tasks").select("*, travelers(full_name)").eq("trip_id", trip.id).order("completed").order("due_date"),
      trip.group_id
        ? supabase.from("group_members").select("*, clients(first_name,last_name,email), travelers(full_name)").eq("group_id", trip.group_id).eq("removed", false)
        : Promise.resolve({ data: [] }),
      supabase.from("documents").select("*").eq("trip_id", trip.id).order("uploaded_at", { ascending: false }),
    ])
    setDetailData({ tasks: tasks||[], members: members||[], docs: docs||[] })
  }

  useEffect(() => { load() }, [])

  const openDetail = async (trip) => {
    setDetailTrip(trip)
    await loadDetail(trip)
  }

  const openNew  = () => {
    setEditing(null); setForm(EMPTY_TRIP); setClientSearch("")
    setTripTravelers([]); setTravelerSearch(""); setShowNewTravelerInline(false)
    setInlineTravelerForm({ first_name:"", last_name:"", email:"", phone:"", date_of_birth:"", passport_number:"" })
    setModal(true)
  }
  const openEdit = (t) => { setEditing(t); setForm({ ...EMPTY_TRIP, ...t }); setClientSearch(clients.find(c=>c.id===t.client_id) ? `${clients.find(c=>c.id===t.client_id)?.first_name} ${clients.find(c=>c.id===t.client_id)?.last_name}` : ""); setDetailTrip(null); setModal(true) }

  const save = async () => {
    setSaving(true)
    // Find lead from travelers list (or use form.client_id)
    const leadTraveler = tripTravelers.find(t => t.isLead)
    const leadClientId = leadTraveler?.clientId || form.client_id || null

    const payload = {
      ...form,
      client_id:      leadClientId,
      total_price:    parseFloat(form.total_price)||0,
      amount_paid:    parseFloat(form.amount_paid)||0,
      credit_balance: parseFloat(form.credit_balance)||0,
      occasion:       form.occasion||null,
      traveler_count: tripTravelers.length > 0 ? tripTravelers.length : parseInt(form.traveler_count)||1,
    }

    if (editing) {
      await supabase.from("trips").update(payload).eq("id", editing.id)
      setSaving(false); setModal(false); load()
    } else {
      const { data: newTrip } = await supabase.from("trips").insert(payload).select().single()
      if (!newTrip) { setSaving(false); return }

      // Create group if multiple travelers or group name provided
      if (tripTravelers.length > 1 || form.group_name) {
        const groupName = form.group_name || newTrip.destination
        const { data: grp } = await supabase.from("groups").insert({
          name: groupName, trip_id: newTrip.id, lead_client_id: leadClientId, status: "Active"
        }).select().single()
        if (grp) {
          await supabase.from("trips").update({ group_id: grp.id }).eq("id", newTrip.id)
          await Promise.all(tripTravelers.map(t =>
            supabase.from("group_members").insert({
              group_id: grp.id,
              client_id: t.clientId || null,
              role: t.isLead ? "Lead" : "Member",
              payment_status: "Pending",
              amount_owed: 0,
            })
          ))
        }
      }

      setSaving(false); setModal(false)
      setTripTravelers([]); setTravelerSearch(""); setShowNewTravelerInline(false)
      load()
      setAiTaskTrip(newTrip); setAiTaskModal(true)
    }
  }

  const deleteTrip = async (id) => {
    if (!confirm("Delete this trip?")) return
    await supabase.from("trips").delete().eq("id", id)
    setDetailTrip(null); load()
  }

  const completeTask = async (taskId, isComplete) => {
    await supabase.from("tasks").update({ completed: !isComplete, completed_at: !isComplete ? new Date().toISOString() : null }).eq("id", taskId)
    await loadDetail(detailTrip)
  }

  const uploadDoc = async (file) => {
    if (!file || !detailTrip) return
    setUploading(true)
    const ext  = file.name.split(".").pop()
    const path = `${detailTrip.client_id||"general"}/${detailTrip.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("documents").upload(path, file)
    if (error) { alert("Upload failed: " + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path)
    await supabase.from("documents").insert({ client_id: detailTrip.client_id||null, trip_id: detailTrip.id, name: file.name, file_type: file.type, file_url: publicUrl, category: "confirmation" })
    setUploading(false)
    await loadDetail(detailTrip)
  }

  const saveMember = async () => {
    let clientId   = memberForm.client_id   || null
    let travelerId = memberForm.traveler_id || null

    if (memberForm._mode === "new" && memberForm._new_first) {
      const { data: nc } = await supabase.from("clients").insert({
        first_name: memberForm._new_first, last_name: memberForm._new_last||"",
        email: memberForm._new_email||null, phone: memberForm._new_phone||null,
        date_of_birth: memberForm._new_dob||null, passport_number: memberForm._new_passport||null,
      }).select().single()
      if (nc) { clientId = nc.id; travelerId = null }
    }

    if (!detailTrip?.group_id) {
      const { data: grp } = await supabase.from("groups").insert({ name: detailTrip.group_name||`${detailTrip.destination} Group`, trip_id: detailTrip.id, lead_client_id: detailTrip.client_id||null, status: "Active" }).select().single()
      if (grp) { await supabase.from("trips").update({ group_id: grp.id }).eq("id", detailTrip.id); setDetailTrip(t => ({ ...t, group_id: grp.id })) }
    }

    const groupId = detailTrip.group_id || (await supabase.from("groups").select("id").eq("trip_id", detailTrip.id).single()).data?.id
    if (groupId) {
      await supabase.from("group_members").insert({ group_id: groupId, client_id: clientId, traveler_id: travelerId, role: memberForm.role||"Member", amount_owed: parseFloat(memberForm.amount_owed)||0, confirmation_number: memberForm.confirmation_number||null, notes: memberForm.notes||null, payment_status: "Pending" })
    }
    setAddMemberModal(false)
    setMemberForm({ client_id:"", traveler_id:"", role:"Member", amount_owed:"", confirmation_number:"", notes:"", _mode:"existing" })
    await loadDetail(detailTrip)
    load()
  }

  const removeMember = async (memberId) => {
    await supabase.from("group_members").update({ removed: true, removed_at: new Date().toISOString() }).eq("id", memberId)
    await loadDetail(detailTrip)
  }

  const updateMemberPayment = async (memberId, status) => {
    await supabase.from("group_members").update({ payment_status: status }).eq("id", memberId)
    await loadDetail(detailTrip)
  }

  const field = (k) => ({ value: form[k]??""      , onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })
  const mf    = (k) => ({ value: memberForm[k]||"", onChange: e => setMemberForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = trips.filter(t => {
    const ms = `${t.clients?.first_name||""} ${t.clients?.last_name||""} ${t.destination} ${t.occasion||""}`.toLowerCase().includes(search.toLowerCase())
    return ms && (statusFilter === "All" || t.status === statusFilter)
  })

  const calDays    = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const tripsOnDay = (day) => trips.filter(t => {
    if (!t.departure_date) return false
    const dep = parseISO(t.departure_date)
    const ret = t.return_date ? parseISO(t.return_date) : dep
    return day >= dep && day <= ret
  })

  const confirmed = trips.filter(t => t.status === "Confirmed").length
  const totalRev  = trips.reduce((s, t) => s + parseFloat(t.amount_paid||0), 0)
  const balDue    = trips.reduce((s, t) => s + Math.max(0, parseFloat(t.total_price||0) - parseFloat(t.amount_paid||0)), 0)
  const upcoming  = trips.filter(t => t.departure_date && new Date(t.departure_date) >= new Date() && t.status !== "Cancelled").length

  const openTasks      = detailData.tasks.filter(t => !t.completed)
  const completedTasks = detailData.tasks.filter(t => t.completed)

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader title="Trips" subtitle={`${trips.length} total bookings`}
        action={<Button onClick={openNew} size="lg"><Plus size={16}/>New trip</Button>} />

      <StatsBar stats={[
        { label:"Upcoming trips",    value: upcoming,                                    color:"pink",  icon:Globe },
        { label:"Confirmed",         value: confirmed,                                   color:"green"             },
        { label:"Revenue collected", value:`$${Math.round(totalRev).toLocaleString()}`,  color:"teal"              },
        { label:"Balance due",       value:`$${Math.round(balDue).toLocaleString()}`,    color:"amber"             },
      ]} />

      {/* Filters + view toggle */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trips, clients, occasions..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
          <option>All</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
          {[["list",<List size={14}/>,"List"],["calendar",<Calendar size={14}/>,"Calendar"]].map(([v,icon,label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${view===v?"text-white":"text-slate-500 hover:bg-brand-50"}`}
              style={view===v?{background:"#8B1A4A"}:{}}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* List view */}
      {view === "list" && (
        filtered.length === 0
          ? <EmptyState icon={Globe} title="No trips found" action={<Button onClick={openNew} size="lg"><Plus size={16}/>New trip</Button>} />
          : (
            <Card>
              <div className="divide-y divide-slate-50">
                {filtered.map(trip => {
                  const balance  = (parseFloat(trip.total_price)||0) - (parseFloat(trip.amount_paid)||0)
                  const daysAway = trip.departure_date ? differenceInDays(new Date(trip.departure_date), new Date()) : null
                  return (
                    <div key={trip.id} onClick={() => openDetail(trip)}
                      className="px-4 py-3 flex items-center gap-4 hover:bg-brand-50 transition-colors cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{trip.destination}</p>
                          <StatusBadge status={trip.status} />
                          {trip.occasion && <OccasionBadge occasion={trip.occasion} />}
                          {trip.group_name && <Badge label={trip.group_name} color="purple" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {trip.clients ? `${trip.clients.first_name} ${trip.clients.last_name}` : "—"} ·{" "}
                          {trip.departure_date ? format(new Date(trip.departure_date),"MMM d") : "TBD"}
                          {trip.return_date ? ` → ${format(new Date(trip.return_date),"MMM d, yyyy")}` : ""}
                          {trip.confirmation_number ? ` · ${trip.confirmation_number}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-800">${parseFloat(trip.total_price||0).toLocaleString()}</p>
                        {balance > 0 ? <p className="text-xs text-red-500 font-medium">${balance.toLocaleString()} due</p>
                                     : <p className="text-xs text-green-600 font-medium">Paid in full</p>}
                        {daysAway !== null && daysAway >= 0 && (
                          <p className={`text-xs font-medium ${daysAway<=7?"text-red-500":daysAway<=30?"text-amber-500":"text-slate-400"}`}>{daysAway}d away</p>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            </Card>
          )
      )}

      {/* Calendar view */}
      {view === "calendar" && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-brand-50 rounded-t-xl">
            <button onClick={() => setCalMonth(m => subMonths(m,1))} className="p-1.5 rounded-lg hover:bg-brand-100"><ChevronLeft size={16} className="text-brand-600"/></button>
            <p className="text-sm font-semibold text-brand-700" style={{fontFamily:"Georgia,serif"}}>{format(calMonth,"MMMM yyyy")}</p>
            <button onClick={() => setCalMonth(m => addMonths(m,1))} className="p-1.5 rounded-lg hover:bg-brand-100"><ChevronRight size={16} className="text-brand-600"/></button>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: calDays[0].getDay() }).map((_,i) => <div key={`e${i}`}/>)}
              {calDays.map(day => {
                const dayTrips = tripsOnDay(day)
                return (
                  <div key={day.toISOString()}
                    className={`min-h-16 rounded-lg p-1 border ${isToday(day)?"border-brand-400 bg-brand-50":"border-slate-100 hover:border-brand-200"}`}>
                    <p className={`text-xs font-medium mb-0.5 ${isToday(day)?"text-brand-600":"text-slate-500"}`}>{format(day,"d")}</p>
                    {dayTrips.slice(0,2).map(t => (
                      <div key={t.id} onClick={() => openDetail(t)}
                        className="text-xs px-1 py-0.5 rounded mb-0.5 cursor-pointer truncate font-medium hover:opacity-80"
                        style={{background:"#F8BBD9",color:"#6b1238"}}>
                        {t.clients?.first_name} · {t.destination}
                      </div>
                    ))}
                    {dayTrips.length > 2 && <p className="text-xs text-brand-400">+{dayTrips.length-2}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ── TRIP DETAIL with sidebar navigation ── */}
      {detailTrip && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDetailTrip(null)}>

          {/* Trip list sidebar */}
          <div className="w-60 bg-white flex flex-col border-r border-slate-200 flex-shrink-0 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-brand-700 flex-shrink-0" style={{background:"#8B1A4A"}}>
              <p className="text-xs font-semibold text-white uppercase tracking-wider">All trips</p>
              <p className="text-xs text-brand-200 mt-0.5">{filtered.length} bookings</p>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.map(trip => {
                const isActive = detailTrip.id === trip.id
                return (
                  <div key={trip.id} onClick={() => openDetail(trip)}
                    className={`px-3 py-2.5 cursor-pointer border-b border-slate-50 transition-colors ${isActive ? "bg-brand-50 border-l-4 border-l-brand-500" : "hover:bg-slate-50"}`}>
                    <p className={`text-xs font-semibold truncate ${isActive ? "text-brand-700" : "text-slate-700"}`}>{trip.destination}</p>
                    <p className="text-xs text-slate-400 truncate">{trip.clients?.first_name} {trip.clients?.last_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400">{trip.departure_date ? format(new Date(trip.departure_date),"MMM d, yy") : "TBD"}</span>
                      <StatusBadge status={trip.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex-1 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailTrip(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="px-5 py-4 rounded-t-2xl flex items-start justify-between" style={{background:"#8B1A4A"}}>
                <div>
                  <h2 className="text-lg font-bold text-white" style={{fontFamily:"Georgia,serif"}}>{detailTrip.destination}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge status={detailTrip.status} />
                    {detailTrip.occasion && <OccasionBadge occasion={detailTrip.occasion} />}
                    {detailTrip.group_name && <Badge label={detailTrip.group_name} color="pink" />}
                    {detailTrip.departure_date && (
                      <span className="text-xs text-brand-200">
                        {format(new Date(detailTrip.departure_date),"MMM d, yyyy")}
                        {detailTrip.return_date ? ` → ${format(new Date(detailTrip.return_date),"MMM d, yyyy")}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  <Link to={`/trips/${detailTrip.id}/manifest`}>
                    <button className="px-2.5 py-1.5 rounded-lg bg-white text-brand-700 text-xs font-semibold hover:bg-brand-50 transition-colors flex items-center gap-1">
                      <Users size={11}/>Show details
                    </button>
                  </Link>
                  <button onClick={() => setEmailModal(true)} className="px-2.5 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 text-xs font-medium flex items-center gap-1">
                    <Sparkles size={11}/>Email
                  </button>
                  <button onClick={() => openEdit(detailTrip)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><Edit2 size={13}/></button>
                  <button onClick={() => deleteTrip(detailTrip.id)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-red-500/50"><Trash2 size={13}/></button>
                  <button onClick={() => setDetailTrip(null)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={13}/></button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Lead client */}
                {detailTrip.clients && (
                  <div className="bg-brand-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                      {detailTrip.clients.first_name?.[0]}{detailTrip.clients.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-brand-800">{detailTrip.clients.first_name} {detailTrip.clients.last_name} <span className="text-xs font-normal text-brand-500">— Lead client</span></p>
                      <p className="text-xs text-brand-500">{detailTrip.clients.email} · {detailTrip.clients.phone}</p>
                    </div>
                    <Link to={`/clients/${detailTrip.clients.id}`}>
                      <Button size="sm" variant="secondary">Profile</Button>
                    </Link>
                  </div>
                )}

                {/* Payment summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Total price</p>
                    <p className="text-lg font-bold text-slate-800">${parseFloat(detailTrip.total_price||0).toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-500 uppercase tracking-wide mb-1">Collected</p>
                    <p className="text-lg font-bold text-green-700">${parseFloat(detailTrip.amount_paid||0).toLocaleString()}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${(parseFloat(detailTrip.total_price||0)-parseFloat(detailTrip.amount_paid||0))>0?"bg-red-50":"bg-green-50"}`}>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${(parseFloat(detailTrip.total_price||0)-parseFloat(detailTrip.amount_paid||0))>0?"text-red-400":"text-green-500"}`}>Balance due</p>
                    <p className={`text-lg font-bold ${(parseFloat(detailTrip.total_price||0)-parseFloat(detailTrip.amount_paid||0))>0?"text-red-700":"text-green-700"}`}>
                      ${Math.max(0,parseFloat(detailTrip.total_price||0)-parseFloat(detailTrip.amount_paid||0)).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Trip info */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <InfoRow label="Confirmation #" value={detailTrip.confirmation_number} />
                  <InfoRow label="Booking ref"    value={detailTrip.booking_ref} />
                  <InfoRow label="Travelers"      value={detailTrip.traveler_count ? `${detailTrip.traveler_count} travelers` : null} />
                  <InfoRow label="Credit balance" value={detailTrip.credit_balance > 0 ? `$${parseFloat(detailTrip.credit_balance).toLocaleString()}` : null} />
                  <InfoRow label="Credit notes"   value={detailTrip.credit_notes} />
                  <InfoRow label="Notes"          value={detailTrip.notes} />
                </div>

                {/* Group members */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100">
                    <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5"><Users size={11}/>Group travelers ({detailData.members.length})</p>
                    <Button size="sm" variant="pink" onClick={() => setAddMemberModal(true)}><Plus size={12}/>Add</Button>
                  </div>
                  {detailData.members.length === 0
                    ? <p className="text-sm text-slate-400 px-4 py-3 text-center">No group travelers yet.</p>
                    : (
                      <>
                        <div className="divide-y divide-slate-50">
                          {detailData.members.map(m => (
                            <div key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-800">
                                    {m.clients ? `${m.clients.first_name} ${m.clients.last_name}` : m.travelers?.full_name || "Unknown"}
                                  </p>
                                  <Badge label={m.role} color="gray" />
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {m.clients?.email && <span className="text-xs text-slate-400">{m.clients.email}</span>}
                                  {m.confirmation_number && <span className="text-xs text-slate-400">· {m.confirmation_number}</span>}
                                  {m.amount_owed > 0 && <span className="text-xs text-slate-500">Owes: ${parseFloat(m.amount_owed).toLocaleString()}</span>}
                                </div>
                              </div>
                              <select value={m.payment_status} onChange={e => updateMemberPayment(m.id, e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-300">
                                {PAY_STATUSES.map(s => <option key={s}>{s}</option>)}
                              </select>
                              <button onClick={() => removeMember(m.id)} className="text-slate-300 hover:text-red-400 transition-colors"><X size={14}/></button>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs">
                          <span className="text-green-600 font-medium">{detailData.members.filter(m=>m.payment_status==="Paid in Full").length} paid</span>
                          <span className="text-amber-600 font-medium">{detailData.members.filter(m=>m.payment_status==="Deposit Paid").length} deposit</span>
                          <span className="text-red-500 font-medium">{detailData.members.filter(m=>["Pending","Overdue"].includes(m.payment_status)).length} unpaid</span>
                        </div>
                      </>
                    )
                  }
                </div>

                {/* Tasks */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100">
                    <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare size={11}/>Tasks ({openTasks.length} open{completedTasks.length > 0 ? `, ${completedTasks.length} done` : ""})
                    </p>
                    {completedTasks.length > 0 && (
                      <button onClick={() => setShowCompleted(s => !s)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 transition-colors">
                        {showCompleted ? <EyeOff size={11}/> : <Eye size={11}/>}
                        {showCompleted ? "Hide" : "Show"} completed
                      </button>
                    )}
                  </div>
                  {detailData.tasks.length === 0
                    ? <p className="text-sm text-slate-400 px-4 py-3 text-center">No tasks for this trip.</p>
                    : (
                      <div className="divide-y divide-slate-50">
                        {openTasks.map(task => (
                          <div key={task.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-brand-50 transition-colors">
                            <button onClick={() => completeTask(task.id, false)}
                              className="w-4 h-4 rounded border border-slate-300 hover:border-brand-400 flex-shrink-0 transition-colors" />
                            <div className="flex-1">
                              <p className="text-sm text-slate-800">{task.title}</p>
                              <div className="flex items-center gap-2">
                                {task.travelers && <span className="text-xs text-brand-400">{task.travelers.full_name}</span>}
                                {task.due_date && <span className="text-xs text-slate-400">Due {format(new Date(task.due_date),"MMM d")}</span>}
                              </div>
                            </div>
                            <StatusBadge status={task.priority} />
                          </div>
                        ))}
                        {showCompleted && completedTasks.map(task => (
                          <div key={task.id} className="px-4 py-2.5 flex items-center gap-2.5 bg-slate-50 opacity-60">
                            <button onClick={() => completeTask(task.id, true)}
                              className="w-4 h-4 rounded border border-green-400 bg-green-500 flex-shrink-0 flex items-center justify-center">
                              <span className="text-white text-xs leading-none">✓</span>
                            </button>
                            <div className="flex-1">
                              <p className="text-sm text-slate-500 line-through">{task.title}</p>
                            </div>
                            <StatusBadge status={task.priority} />
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>

                {/* Documents */}
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100">
                    <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5"><FileText size={11}/>Documents ({detailData.docs.length})</p>
                    <div className="flex gap-2">
                      <input ref={fileRef} type="file" className="hidden" onChange={e => uploadDoc(e.target.files[0])} />
                      <Button size="sm" variant="pink" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <Upload size={12}/>{uploading ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                  {detailData.docs.length === 0
                    ? <p className="text-sm text-slate-400 px-4 py-3 text-center">No documents yet. Upload confirmations, insurance, or other files.</p>
                    : (
                      <div className="divide-y divide-slate-50">
                        {detailData.docs.map(doc => (
                          <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-800">{doc.name}</p>
                              <p className="text-xs text-slate-400">{format(new Date(doc.uploaded_at),"MMM d, yyyy")}</p>
                            </div>
                            <a href={doc.file_url} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="secondary">View</Button>
                            </a>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Email for trip */}
      <AIEmailComposer
        client={detailTrip?.clients || {}}
        trip={detailTrip}
        open={emailModal && !!detailTrip}
        onClose={() => setEmailModal(false)}
      />

      {/* Add member modal */}
      <Modal open={addMemberModal} onClose={() => setAddMemberModal(false)} title="Add traveler to trip" wide
        footer={<>
          <Button variant="secondary" onClick={() => setAddMemberModal(false)}>Cancel</Button>
          <Button onClick={saveMember}>Add to trip</Button>
        </>}>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Select an existing client, a known traveler, or create a new client on the spot.</p>
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
          {[["existing","Existing client"],["traveler","Known traveler"],["new","New client"]].map(([val,label]) => (
            <button key={val}
              onClick={() => setMemberForm(f => ({ ...f, _mode: val, client_id:"", traveler_id:"" }))}
              className={`py-2 rounded-lg text-xs font-medium transition-colors ${(memberForm._mode||"existing")===val?"bg-white text-brand-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              {label}
            </button>
          ))}
        </div>
        {(memberForm._mode||"existing") === "existing" && (
          <Select label="Select client" value={memberForm.client_id} onChange={e => setMemberForm(f => ({ ...f, client_id: e.target.value }))}>
            <option value="">Choose a client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </Select>
        )}
        {memberForm._mode === "traveler" && (
          <Select label="Select traveler" value={memberForm.traveler_id} onChange={e => setMemberForm(f => ({ ...f, traveler_id: e.target.value }))}>
            <option value="">Choose a traveler...</option>
            {allTravelers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </Select>
        )}
        {memberForm._mode === "new" && (
          <>
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">A full client record will be created and added to the trip.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={memberForm._new_first||""} onChange={e => setMemberForm(f=>({...f,_new_first:e.target.value}))} placeholder="Jane" />
              <Input label="Last name"  value={memberForm._new_last||""}  onChange={e => setMemberForm(f=>({...f,_new_last:e.target.value}))}  placeholder="Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" value={memberForm._new_email||""} onChange={e => setMemberForm(f=>({...f,_new_email:e.target.value}))} placeholder="jane@email.com" />
              <Input label="Phone" value={memberForm._new_phone||""} onChange={e => setMemberForm(f=>({...f,_new_phone:e.target.value}))} placeholder="+1 555 000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date of birth" type="date" value={memberForm._new_dob||""} onChange={e => setMemberForm(f=>({...f,_new_dob:e.target.value}))} />
              <Input label="Passport #" value={memberForm._new_passport||""} onChange={e => setMemberForm(f=>({...f,_new_passport:e.target.value}))} placeholder="A12345678" />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" {...mf("role")}><option>Member</option><option>Lead</option><option>Guest</option></Select>
          <Input label="Amount owed ($)" type="number" {...mf("amount_owed")} placeholder="0.00" />
        </div>
        <Input label="Confirmation number" {...mf("confirmation_number")} placeholder="Individual conf #" />
        <Textarea label="Notes" {...mf("notes")} />
      </Modal>

      {/* AI Task Suggestions after new trip */}
      <Modal open={aiTaskModal} onClose={() => setAiTaskModal(false)} title="Smart task suggestions" wide
        footer={<Button variant="secondary" onClick={() => setAiTaskModal(false)}>Skip for now</Button>}>
        <p className="text-sm text-slate-500">Trip created! Claude can suggest a tailored task checklist based on this trip's details.</p>
        <AITaskSuggestions
          trip={aiTaskTrip}
          client={clients.find(c => c.id === aiTaskTrip?.client_id)}
          onAddTasks={async (tasks) => {
            if (!aiTaskTrip) return
            const depDate = aiTaskTrip.departure_date ? new Date(aiTaskTrip.departure_date) : null
            await Promise.all(tasks.map(task =>
              supabase.from("tasks").insert({
                trip_id: aiTaskTrip.id, client_id: aiTaskTrip.client_id||null,
                title: task.title, priority: task.priority, category: task.category,
                due_date: depDate && task.days_before ? new Date(depDate.getTime() - task.days_before * 86400000).toISOString().split("T")[0] : null,
                completed: false,
              })
            ))
            setAiTaskModal(false); load()
          }}
          onClose={() => setAiTaskModal(false)}
        />
      </Modal>

      {/* Add/Edit trip modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? "Edit trip" : "New trip"} extraWide
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : `Save trip${!editing && tripTravelers.length > 0 ? ` (${tripTravelers.length + (form.client_id ? 1 : 0)} travelers)` : ""}`}
          </Button>
        </>}>

        <div className="grid grid-cols-2 gap-5">
          {/* Left col — trip details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Trip details</p>

            {/* Searchable lead client */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Lead client</label>
              <div className="relative">
                <input placeholder="Type to search clients..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); if (form.client_id) setForm(f => ({ ...f, client_id: "" })) }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                {clientSearch.length > 0 && !form.client_id && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-44 overflow-y-auto mt-0.5">
                    {clients.filter(c => `${c.first_name} ${c.last_name} ${c.email||""}`.toLowerCase().includes(clientSearch.toLowerCase())).slice(0,8).map(c => (
                      <div key={c.id} onClick={() => { setForm(f => ({ ...f, client_id: c.id })); setClientSearch(`${c.first_name} ${c.last_name}`) }}
                        className="px-3 py-2 hover:bg-brand-50 cursor-pointer flex items-center gap-2 border-b border-slate-50 last:border-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>{c.first_name?.[0]}{c.last_name?.[0]}</div>
                        <div><p className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</p>{c.email && <p className="text-xs text-slate-400">{c.email}</p>}</div>
                      </div>
                    ))}
                    {clients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-sm text-slate-400">No clients found</p>
                    )}
                  </div>
                )}
              </div>
              {form.client_id && (
                <div className="flex items-center justify-between mt-1 px-2 py-1 bg-brand-50 rounded-lg">
                  <p className="text-xs text-brand-700 font-medium">✓ {clients.find(c=>c.id===form.client_id)?.first_name} {clients.find(c=>c.id===form.client_id)?.last_name}</p>
                  <button onClick={() => { setForm(f=>({...f,client_id:""})); setClientSearch("") }} className="text-xs text-brand-400 hover:text-brand-600">Clear</button>
                </div>
              )}
            </div>

            <Input label="Destination" {...field("destination")} placeholder="Montego Bay, Jamaica" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Occasion" {...field("occasion")}>{OCCASIONS.map(o=><option key={o}>{o}</option>)}</Select>
              <Input label="Group name" {...field("group_name")} placeholder="Girls Trip, Church Group..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Departure date" type="date" {...field("departure_date")} />
              <Input label="Return date"    type="date" {...field("return_date")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Total price ($)" type="number" {...field("total_price")} placeholder="0.00" />
              <Input label="Amount paid ($)" type="number" {...field("amount_paid")} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" {...field("status")}>{STATUSES.map(s=><option key={s}>{s}</option>)}</Select>
              <Input label="Confirmation #" {...field("confirmation_number")} placeholder="ABC123" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Booking ref" {...field("booking_ref")} placeholder="REF456" />
              <Input label="Credit balance ($)" type="number" {...field("credit_balance")} placeholder="0.00" />
            </div>
            <Textarea label="Notes" {...field("notes")} />
          </div>

          {/* Right col — traveler picker */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
              Travelers{editing ? " (edit after saving)" : ""}
            </p>

            {!editing && (
              <>
                {/* Selected travelers box */}
                <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden min-h-24 bg-slate-50">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      List of travelers ({tripTravelers.length + (form.client_id ? 1 : 0)})
                    </p>
                  </div>

                  {/* Lead client pill */}
                  {form.client_id && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                        {clients.find(c=>c.id===form.client_id)?.first_name?.[0]}{clients.find(c=>c.id===form.client_id)?.last_name?.[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{clients.find(c=>c.id===form.client_id)?.first_name} {clients.find(c=>c.id===form.client_id)?.last_name}</p>
                        <p className="text-xs text-slate-400">{clients.find(c=>c.id===form.client_id)?.email}</p>
                      </div>
                      <span className="text-xs bg-brand-500 text-white px-2 py-0.5 rounded-full font-medium">Lead</span>
                    </div>
                  )}

                  {/* Added travelers */}
                  {tripTravelers.length === 0 && !form.client_id && (
                    <p className="text-xs text-slate-400 px-3 py-4 text-center">Search and add travelers below</p>
                  )}
                  {tripTravelers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-white transition-colors">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                        {t.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                        {t.email && <p className="text-xs text-slate-400 truncate">{t.email}</p>}
                        {t.isNew && <p className="text-xs text-green-600 font-medium">✓ New client created</p>}
                      </div>
                      <button
                        onClick={() => setTripTravelers(tv => tv.map((x,j) => ({...x, isLead: j===i ? !x.isLead : false})))}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors flex-shrink-0 ${t.isLead ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-brand-100 hover:text-brand-600"}`}>
                        {t.isLead ? "Lead ✓" : "Lead?"}
                      </button>
                      <button onClick={() => setTripTravelers(tv => tv.filter((_,j) => j!==i))}
                        className="text-slate-300 hover:text-red-400 transition-colors ml-1 flex-shrink-0">
                        <X size={13}/>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Search box — always visible, always ready */}
                {!showNewTravelerInline && (
                  <div className="relative">
                    <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Search & add travelers</label>
                    <input
                      value={travelerSearch}
                      onChange={e => setTravelerSearch(e.target.value)}
                      placeholder="Type name, email, or phone..."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                    />
                    {travelerSearch.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto mt-0.5">
                        {clients
                          .filter(c =>
                            c.id !== form.client_id &&
                            !tripTravelers.some(t => t.clientId === c.id) &&
                            `${c.first_name} ${c.last_name} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(travelerSearch.toLowerCase())
                          )
                          .slice(0, 8)
                          .map(c => (
                            <div key={c.id}
                              onClick={() => {
                                setTripTravelers(tv => [...tv, { clientId: c.id, name: `${c.first_name} ${c.last_name}`, email: c.email, isLead: false }])
                                setTravelerSearch("")
                              }}
                              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-50 cursor-pointer border-b border-slate-50 last:border-0">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                                {c.first_name?.[0]}{c.last_name?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</p>
                                {c.email && <p className="text-xs text-slate-400 truncate">{c.email}</p>}
                              </div>
                              <span className="text-xs text-brand-500 font-medium flex-shrink-0">+ Add</span>
                            </div>
                          ))
                        }
                        {clients.filter(c => c.id !== form.client_id && !tripTravelers.some(t=>t.clientId===c.id) && `${c.first_name} ${c.last_name} ${c.email||""} ${c.phone||""}`.toLowerCase().includes(travelerSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-3 text-center">
                            <p className="text-sm text-slate-400 mb-2">No existing clients match "{travelerSearch}"</p>
                            <button onClick={() => { setShowNewTravelerInline(true); setInlineTravelerForm(f=>({...f, first_name: travelerSearch.split(" ")[0]||"", last_name: travelerSearch.split(" ").slice(1).join(" ")||"" })); setTravelerSearch("") }}
                              className="text-xs text-brand-600 font-medium hover:text-brand-800">
                              + Create new client for "{travelerSearch}"
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* New traveler inline form */}
                {showNewTravelerInline ? (
                  <div className="border border-brand-200 rounded-xl p-3 bg-brand-50 space-y-2">
                    <p className="text-xs font-semibold text-brand-600">New traveler — creates a full client record</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={inlineTravelerForm.first_name} onChange={e=>setInlineTravelerForm(f=>({...f,first_name:e.target.value}))}
                        placeholder="First name *" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                      <input value={inlineTravelerForm.last_name} onChange={e=>setInlineTravelerForm(f=>({...f,last_name:e.target.value}))}
                        placeholder="Last name *" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={inlineTravelerForm.email} onChange={e=>setInlineTravelerForm(f=>({...f,email:e.target.value}))}
                        placeholder="Email" type="email" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                      <input value={inlineTravelerForm.phone} onChange={e=>setInlineTravelerForm(f=>({...f,phone:e.target.value}))}
                        placeholder="Phone" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={inlineTravelerForm.date_of_birth} onChange={e=>setInlineTravelerForm(f=>({...f,date_of_birth:e.target.value}))}
                        type="date" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                      <input value={inlineTravelerForm.passport_number} onChange={e=>setInlineTravelerForm(f=>({...f,passport_number:e.target.value}))}
                        placeholder="Passport # (optional)" className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm"
                        disabled={!inlineTravelerForm.first_name || !inlineTravelerForm.last_name}
                        onClick={async () => {
                          const { data: nc } = await supabase.from("clients").insert({
                            first_name: inlineTravelerForm.first_name,
                            last_name:  inlineTravelerForm.last_name,
                            email:      inlineTravelerForm.email || null,
                            phone:      inlineTravelerForm.phone || null,
                            date_of_birth: inlineTravelerForm.date_of_birth || null,
                            passport_number: inlineTravelerForm.passport_number || null,
                          }).select().single()
                          if (nc) {
                            setTripTravelers(tv => [...tv, { clientId: nc.id, name: `${nc.first_name} ${nc.last_name}`, email: nc.email, isLead: false, isNew: true }])
                            const { data: ac } = await supabase.from("clients").select("id,first_name,last_name,email,phone").order("last_name")
                            setClients(ac || [])
                          }
                          setInlineTravelerForm({ first_name:"", last_name:"", email:"", phone:"", date_of_birth:"", passport_number:"" })
                          setShowNewTravelerInline(false)
                        }}>
                        <Plus size={12}/>Add to trip
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setShowNewTravelerInline(false); setInlineTravelerForm({ first_name:"", last_name:"", email:"", phone:"", date_of_birth:"", passport_number:"" }) }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowNewTravelerInline(true); setTravelerSearch("") }}
                    className="w-full py-2 border-2 border-dashed border-brand-200 rounded-lg text-xs text-brand-500 font-medium hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-all flex items-center justify-center gap-1.5">
                    <Plus size={13}/>Add new traveler (not in system)
                  </button>
                )}

                {tripTravelers.length > 0 && (
                  <p className="text-xs text-slate-400 text-center">
                    Click "Lead?" next to any traveler to make them the lead client on this booking
                  </p>
                )}
              </>
            )}

            {editing && (
              <div className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-sm text-slate-500">To manage travelers on an existing trip, use the trip detail panel and click "Add" in the Group travelers section.</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
