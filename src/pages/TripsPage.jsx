import { useEffect, useState, useRef } from "react"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import { format, differenceInDays } from "date-fns"
import { Globe, Plus, Search, Calendar, List, ChevronLeft, ChevronRight, X, Edit2, Trash2, Users, CheckSquare, Upload, FileText, Eye, EyeOff } from "lucide-react"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, StatusBadge, OccasionBadge, Badge, StatsBar, InfoRow } from "../components/UI"
import AITaskSuggestions from "../components/AITaskSuggestions"
import { startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addMonths, subMonths } from "date-fns"

const STATUSES  = ["Quoted","Confirmed","Paid","Departed","Completed","Cancelled"]
const OCCASIONS = ["","Birthday","Anniversary","Honeymoon","Girls Trip","Business","Family","Group","Other"]
const PAY_STATUSES = ["Pending","Deposit Paid","Paid in Full","Overdue","Cancelled"]
const EMPTY_TRIP = {
  client_id:"", destination:"", departure_date:"", return_date:"",
  status:"Quoted", total_price:"", amount_paid:"0", booking_ref:"",
  confirmation_number:"", traveler_count:"1", occasion:"",
  credit_balance:"0", credit_notes:"", group_name:"", notes:""
}

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
  const [memberForm, setMemberForm] = useState({ client_id:"", traveler_id:"", role:"Member", amount_owed:"", confirmation_number:"", notes:"" })
  const [showCompletedTasks, setShowCompleted] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [showAITasks, setShowAITasks]   = useState(false)
  const [showAIEmail, setShowAIEmail]   = useState(false)
  const [aiTaskModal, setAiTaskModal] = useState(false)
  const [aiTaskTrip, setAiTaskTrip]   = useState(null)
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
    setDetailData({ tasks: tasks || [], members: members || [], docs: docs || [] })
  }


  const addTasksFromAI = async (suggestedTasks) => {
    if (!detailTrip) return
    for (const task of suggestedTasks) {
      const dueDate = detailTrip.departure_date && task.days_before
        ? new Date(new Date(detailTrip.departure_date).getTime() - task.days_before * 86400000).toISOString().split("T")[0]
        : null
      await supabase.from("tasks").insert({
        trip_id:    detailTrip.id,
        client_id:  detailTrip.client_id || null,
        title:      task.title,
        category:   task.category,
        priority:   task.priority,
        due_date:   dueDate,
        completed:  false,
      })
    }
    await loadDetail(detailTrip)
  }

  useEffect(() => { load() }, [])

  const openDetail = async (trip) => { setDetailTrip(trip); await loadDetail(trip) }
  const openNew    = () => { setEditing(null); setForm(EMPTY_TRIP); setModal(true) }
  const openEdit   = (t) => { setEditing(t); setForm({ ...EMPTY_TRIP, ...t }); setDetailTrip(null); setModal(true) }

  const save = async () => {
    setSaving(true)
    const payload = {
      ...form,
      total_price:    parseFloat(form.total_price)    || 0,
      amount_paid:    parseFloat(form.amount_paid)    || 0,
      credit_balance: parseFloat(form.credit_balance) || 0,
      occasion:       form.occasion || null,
    }
    if (editing) {
      await supabase.from("trips").update(payload).eq("id", editing.id)
    } else {
      const { data: newTrip } = await supabase.from("trips").insert(payload).select().single()
      if (form.group_name && newTrip) {
        const { data: grp } = await supabase.from("groups").insert({
          name: form.group_name, trip_id: newTrip.id, lead_client_id: form.client_id || null, status: "Active"
        }).select().single()
        if (grp) await supabase.from("trips").update({ group_id: grp.id }).eq("id", newTrip.id)
      }
      // Offer AI task suggestions for new trips
      if (newTrip) {
        setSaving(false)
        setModal(false)
        load()
        setAiTaskTrip(newTrip)
        setAiTaskModal(true)
        return
      }
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const deleteTrip = async (id) => {
    if (!confirm("Delete this trip?")) return
    await supabase.from("trips").delete().eq("id", id)
    setDetailTrip(null)
    load()
  }

  const completeTask = async (taskId, isComplete) => {
    await supabase.from("tasks").update({
      completed: !isComplete,
      completed_at: !isComplete ? new Date().toISOString() : null
    }).eq("id", taskId)
    await loadDetail(detailTrip)
  }

  const uploadDoc = async (file) => {
    if (!file || !detailTrip) return
    setUploading(true)
    const ext  = file.name.split(".").pop()
    const path = `${detailTrip.client_id || "general"}/${detailTrip.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("documents").upload(path, file)
    if (error) { alert("Upload failed: " + error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path)
    await supabase.from("documents").insert({
      client_id: detailTrip.client_id || null,
      trip_id:   detailTrip.id,
      name:      file.name,
      file_type: file.type,
      file_url:  publicUrl,
      category:  "confirmation",
    })
    setUploading(false)
    await loadDetail(detailTrip)
  }

  const saveMember = async () => {
    let clientId = memberForm.client_id || null
    let travelerId = memberForm.traveler_id || null

    // If adding a new client inline, create them first
    if (memberForm._mode === "new" && memberForm._new_first) {
      const { data: newClient } = await supabase.from("clients").insert({
        first_name: memberForm._new_first,
        last_name:  memberForm._new_last || "",
        email:      memberForm._new_email || null,
        phone:      memberForm._new_phone || null,
        date_of_birth: memberForm._new_dob || null,
        passport_number: memberForm._new_passport || null,
      }).select().single()
      if (newClient) { clientId = newClient.id; travelerId = null }
    }

    // Ensure group exists
    if (!detailTrip?.group_id) {
      const { data: grp } = await supabase.from("groups").insert({
        name: detailTrip.group_name || `${detailTrip.destination} Group`,
        trip_id: detailTrip.id, lead_client_id: detailTrip.client_id || null, status: "Active"
      }).select().single()
      if (grp) {
        await supabase.from("trips").update({ group_id: grp.id }).eq("id", detailTrip.id)
        setDetailTrip(t => ({ ...t, group_id: grp.id }))
      }
    }

    const groupId = detailTrip.group_id || (await supabase.from("groups").select("id").eq("trip_id", detailTrip.id).single()).data?.id
    if (groupId) {
      await supabase.from("group_members").insert({
        group_id: groupId,
        client_id: clientId,
        traveler_id: travelerId,
        role: memberForm.role || "Member",
        amount_owed: parseFloat(memberForm.amount_owed) || 0,
        confirmation_number: memberForm.confirmation_number || null,
        notes: memberForm.notes || null,
        payment_status: "Pending",
      })
    }
    setAddMemberModal(false)
    setMemberForm({ client_id:"", traveler_id:"", role:"Member", amount_owed:"", confirmation_number:"", notes:"", _mode:"existing" })
    await loadDetail(detailTrip)
    load() // refresh client list if new client was added
  }

  const removeMember = async (memberId) => {
    await supabase.from("group_members").update({ removed: true, removed_at: new Date().toISOString() }).eq("id", memberId)
    await loadDetail(detailTrip)
  }

  const updateMemberPayment = async (memberId, status) => {
    await supabase.from("group_members").update({ payment_status: status }).eq("id", memberId)
    await loadDetail(detailTrip)
  }

  const field = (k) => ({ value: form[k] ?? "", onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })
  const mf    = (k) => ({ value: memberForm[k] || "", onChange: e => setMemberForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = trips.filter(t => {
    const ms = `${t.clients?.first_name||""} ${t.clients?.last_name||""} ${t.destination} ${t.occasion||""}`.toLowerCase().includes(search.toLowerCase())
    return ms && (statusFilter === "All" || t.status === statusFilter)
  })

  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
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
        { label: "Upcoming trips",    value: upcoming,                                    color: "pink",  icon: Globe },
        { label: "Confirmed",         value: confirmed,                                   color: "green"              },
        { label: "Revenue collected", value: `$${Math.round(totalRev).toLocaleString()}`, color: "teal"               },
        { label: "Balance due",       value: `$${Math.round(balDue).toLocaleString()}`,   color: "amber"              },
      ]} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
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
          {[["list", <List size={14}/>, "List"], ["calendar", <Calendar size={14}/>, "Calendar"]].map(([v, icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm transition-colors ${view===v ? "text-white" : "text-slate-500 hover:bg-brand-50"}`}
              style={view===v ? {background:"#8B1A4A"} : {}}>
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
                  const balance = (parseFloat(trip.total_price)||0) - (parseFloat(trip.amount_paid)||0)
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
                          {trip.departure_date ? format(new Date(trip.departure_date), "MMM d") : "TBD"}
                          {trip.return_date ? ` → ${format(new Date(trip.return_date), "MMM d, yyyy")}` : ""}
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
                        style={{background:"#F8BBD9", color:"#6b1238"}}>
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

      {/* ── TRIP DETAIL ── */}
      {detailTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailTrip(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
                <button onClick={() => openEdit(detailTrip)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><Edit2 size={13}/></button>
                <button onClick={() => deleteTrip(detailTrip.id)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-red-500/50"><Trash2 size={13}/></button>
                <button onClick={() => setDetailTrip(null)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={13}/></button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {detailTrip.clients && (
                <div className="bg-brand-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
                    {detailTrip.clients.first_name?.[0]}{detailTrip.clients.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-800">{detailTrip.clients.first_name} {detailTrip.clients.last_name} <span className="text-xs font-normal text-brand-500">— Lead client</span></p>
                    <p className="text-xs text-brand-500">{detailTrip.clients.email} · {detailTrip.clients.phone}</p>
                  </div>
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
                <div className={`rounded-xl p-3 text-center ${(detailTrip.total_price-detailTrip.amount_paid)>0?"bg-red-50":"bg-green-50"}`}>
                  <p className={`text-xs uppercase tracking-wide mb-1 ${(detailTrip.total_price-detailTrip.amount_paid)>0?"text-red-400":"text-green-500"}`}>Balance due</p>
                  <p className={`text-lg font-bold ${(detailTrip.total_price-detailTrip.amount_paid)>0?"text-red-700":"text-green-700"}`}>
                    ${Math.max(0,parseFloat(detailTrip.total_price||0)-parseFloat(detailTrip.amount_paid||0)).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Trip details */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <InfoRow label="Confirmation #"  value={detailTrip.confirmation_number} />
                <InfoRow label="Booking ref"     value={detailTrip.booking_ref} />
                <InfoRow label="Travelers"       value={detailTrip.traveler_count ? `${detailTrip.traveler_count} travelers` : null} />
                <InfoRow label="Credit balance"  value={detailTrip.credit_balance > 0 ? `$${parseFloat(detailTrip.credit_balance).toLocaleString()}` : null} />
                <InfoRow label="Credit notes"    value={detailTrip.credit_notes} />
                <InfoRow label="Notes"           value={detailTrip.notes} />
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
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                        <span className="text-green-600 font-medium">{detailData.members.filter(m=>m.payment_status==="Paid in Full").length} paid</span>
                        <span className="text-amber-600 font-medium">{detailData.members.filter(m=>m.payment_status==="Deposit Paid").length} deposit</span>
                        <span className="text-red-500 font-medium">{detailData.members.filter(m=>["Pending","Overdue"].includes(m.payment_status)).length} unpaid</span>
                      </div>
                    </>
                  )
                }
              </div>

              {/* Tasks with complete/toggle */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-100">
                  <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare size={11}/>Tasks ({openTasks.length} open{completedTasks.length > 0 ? `, ${completedTasks.length} done` : ""})
                  </p>
                  {completedTasks.length > 0 && (
                    <button onClick={() => setShowCompleted(s => !s)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 transition-colors">
                      {showCompletedTasks ? <EyeOff size={11}/> : <Eye size={11}/>}
                      {showCompletedTasks ? "Hide" : "Show"} completed
                    </button>
                  )}
                </div>
                {detailData.tasks.length === 0
                  ? <p className="text-sm text-slate-400 px-4 py-3 text-center">No tasks for this trip.</p>
                  : (
                    <div className="divide-y divide-slate-50">
                      {/* Open tasks */}
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
                      {/* Completed tasks */}
                      {showCompletedTasks && completedTasks.map(task => (
                        <div key={task.id} className="px-4 py-2.5 flex items-center gap-2.5 bg-slate-50 opacity-60">
                          <button onClick={() => completeTask(task.id, true)}
                            className="w-4 h-4 rounded border border-green-400 bg-green-500 flex-shrink-0 flex items-center justify-center">
                            <span className="text-white text-xs leading-none">✓</span>
                          </button>
                          <div className="flex-1">
                            <p className="text-sm text-slate-500 line-through">{task.title}</p>
                            {task.travelers && <span className="text-xs text-slate-400">{task.travelers.full_name}</span>}
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
      )}

      {/* AI Task Suggestions */}
      {showAITasks && detailTrip && (
        <AITaskSuggestions
          trip={detailTrip}
          client={detailTrip.clients || {}}
          onAddTasks={addTasksFromAI}
          onClose={() => setShowAITasks(false)}
        />
      )}

      {/* AI Email Composer */}
      {showAIEmail && detailTrip && (
        <AIEmailComposer
          client={detailTrip.clients || {}}
          trip={detailTrip}
          onClose={() => setShowAIEmail(false)}
        />
      )}

      {/* Add member modal */}
      <Modal open={addMemberModal} onClose={() => setAddMemberModal(false)} title="Add traveler to trip" wide
        footer={<>
          <Button variant="secondary" onClick={() => setAddMemberModal(false)}>Cancel</Button>
          <Button onClick={saveMember}>Add to trip</Button>
        </>}>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Select an existing client, a known traveler, or create a brand new client on the spot.</p>

        {/* Mode selector */}
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
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">A full client record will be created for this person and they'll be added to the trip.</p>
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
          <Select label="Role" value={memberForm.role} onChange={e=>setMemberForm(f=>({...f,role:e.target.value}))}>
            <option>Member</option><option>Lead</option><option>Guest</option>
          </Select>
          <Input label="Amount owed ($)" type="number" value={memberForm.amount_owed||""} onChange={e=>setMemberForm(f=>({...f,amount_owed:e.target.value}))} placeholder="0.00" />
        </div>
        <Input label="Confirmation number" value={memberForm.confirmation_number||""} onChange={e=>setMemberForm(f=>({...f,confirmation_number:e.target.value}))} placeholder="Individual conf #" />
        <Textarea label="Notes" value={memberForm.notes||""} onChange={e=>setMemberForm(f=>({...f,notes:e.target.value}))} />
      </Modal>

      {/* Add/Edit trip modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit trip" : "New trip"} wide
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save trip"}</Button>
        </>}>
        <Select label="Lead client" {...field("client_id")}>
          <option value="">Select a client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Destination" {...field("destination")} placeholder="Montego Bay, Jamaica" />
          <Select label="Occasion" {...field("occasion")}>{OCCASIONS.map(o => <option key={o}>{o}</option>)}</Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Departure date" type="date" {...field("departure_date")} />
          <Input label="Return date"    type="date" {...field("return_date")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Total price ($)"  type="number" {...field("total_price")} placeholder="0.00" />
          <Input label="Amount paid ($)"  type="number" {...field("amount_paid")} placeholder="0.00" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Status" {...field("status")}>{STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
          <Input label="Travelers" type="number" {...field("traveler_count")} placeholder="1" />
          <Input label="Confirmation #" {...field("confirmation_number")} placeholder="ABC123" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Booking ref" {...field("booking_ref")} placeholder="REF456" />
          <Input label="Group name"  {...field("group_name")}  placeholder="Girls Trip, Church Group..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Credit balance ($)" type="number" {...field("credit_balance")} placeholder="0.00" />
          <Input label="Credit notes"       {...field("credit_notes")} placeholder="Balance from previous trip..." />
        </div>
        <Textarea label="Notes" {...field("notes")} />
      </Modal>
      {/* AI Task Suggestions Modal */}
      <Modal open={aiTaskModal} onClose={() => setAiTaskModal(false)}
        title="Smart task suggestions" wide
        footer={<Button variant="secondary" onClick={() => setAiTaskModal(false)}>Skip for now</Button>}>
        <p className="text-sm text-slate-500">Trip created! Claude can suggest a tailored task checklist based on this trip's details.</p>
        <AITaskSuggestions
          trip={aiTaskTrip}
          client={clients.find(c => c.id === aiTaskTrip?.client_id)}
          onAddTasks={async (tasks) => {
            if (!aiTaskTrip) return
            const client = clients.find(c => c.id === aiTaskTrip.client_id)
            const depDate = aiTaskTrip.departure_date ? new Date(aiTaskTrip.departure_date) : null
            await Promise.all(tasks.map(task =>
              supabase.from("tasks").insert({
                trip_id: aiTaskTrip.id,
                client_id: aiTaskTrip.client_id || null,
                title: task.title,
                priority: task.priority,
                category: task.category,
                due_date: depDate && task.days_before ? new Date(depDate.getTime() - task.days_before * 86400000).toISOString().split("T")[0] : null,
                completed: false,
              })
            ))
            setAiTaskModal(false)
            load()
          }}
          onClose={() => setAiTaskModal(false)}
        />
      </Modal>

    </div>
  )
}
