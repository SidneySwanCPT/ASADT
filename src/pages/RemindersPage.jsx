import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { Bell, Plus, Search, X } from "lucide-react"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, StatusBadge, StatsBar, Badge } from "../components/UI"

const TYPES      = ["Payment due","Document needed","Pre-departure","Welcome home","Birthday","Check-in","Custom"]
const CHANNELS   = ["Email","SMS","Both"]
const PRIORITIES = ["Low","Medium","High","Urgent"]
const PRIORITY_ORDER = { Urgent:0, High:1, Medium:2, Low:3 }
const EMPTY = { client_id:"", trip_id:"", type:"Payment due", channel:"Email", subject:"", message:"", scheduled_for:"", priority:"Medium" }

const TYPE_COLORS = {
  "Payment due":"red","Document needed":"amber","Pre-departure":"blue",
  "Welcome home":"green","Birthday":"pink","Check-in":"teal","Custom":"gray"
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState([])
  const [clients, setClients]     = useState([])
  const [trips, setTrips]         = useState([])
  const [search, setSearch]       = useState("")
  const [typeFilter, setType]     = useState("All")
  const [priFilter, setPri]       = useState("All")
  const [sentFilter, setSent]     = useState("Pending")
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    const [{ data: r }, { data: c }, { data: t }] = await Promise.all([
      supabase.from("reminders").select("*, clients(first_name,last_name), trips(destination)").order("scheduled_for"),
      supabase.from("clients").select("id,first_name,last_name").order("last_name"),
      supabase.from("trips").select("id,destination,client_id").order("departure_date", { ascending: false }),
    ])
    setReminders(r || [])
    setClients(c || [])
    setTrips(t || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clientTrips = trips.filter(t => t.client_id === form.client_id)

  const save = async () => {
    setSaving(true)
    await supabase.from("reminders").insert({ ...form, client_id: form.client_id||null, trip_id: form.trip_id||null })
    setSaving(false); setModal(false); setForm(EMPTY); load()
  }

  const markSent = async (id) => {
    await supabase.from("reminders").update({ sent: true, sent_at: new Date().toISOString() }).eq("id", id)
    load()
  }

  const deleteReminder = async (id) => {
    if (!confirm("Delete this reminder?")) return
    await supabase.from("reminders").delete().eq("id", id)
    load()
  }

  const field = (k) => ({ value: form[k]||"", onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = reminders
    .filter(r => {
      const ms = `${r.subject||""} ${r.clients?.first_name||""} ${r.clients?.last_name||""} ${r.type}`.toLowerCase().includes(search.toLowerCase())
      const mt = typeFilter === "All" || r.type === typeFilter
      const mp = priFilter === "All" || r.priority === priFilter
      const ms2 = sentFilter === "All" ? true : sentFilter === "Pending" ? !r.sent : r.sent
      return ms && mt && mp && ms2
    })
    .sort((a, b) => {
      if (a.sent !== b.sent) return a.sent ? 1 : -1
      const pa = PRIORITY_ORDER[a.priority] ?? 2
      const pb = PRIORITY_ORDER[b.priority] ?? 2
      if (pa !== pb) return pa - pb
      if (a.scheduled_for && b.scheduled_for) return new Date(a.scheduled_for) - new Date(b.scheduled_for)
      return 0
    })

  const pendingCount = reminders.filter(r => !r.sent).length
  const sentCount    = reminders.filter(r => r.sent).length
  const urgentCount  = reminders.filter(r => !r.sent && r.priority === "Urgent").length
  const overdueCount = reminders.filter(r => !r.sent && r.scheduled_for && new Date(r.scheduled_for) < new Date()).length

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader title="Reminders" subtitle={`${pendingCount} pending`}
        action={<Button onClick={() => { setForm(EMPTY); setModal(true) }} size="lg"><Plus size={16}/>Add reminder</Button>} />

      <StatsBar stats={[
        { label: "Pending",  value: pendingCount, color: "pink"  },
        { label: "Overdue",  value: overdueCount, color: "red"   },
        { label: "Urgent",   value: urgentCount,  color: "amber" },
        { label: "Sent",     value: sentCount,    color: "green" },
      ]} />

      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reminders..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
          {["Pending","Sent","All"].map(f => (
            <button key={f} onClick={() => setSent(f)}
              className={`px-3 py-2 text-sm transition-colors ${sentFilter===f?"text-white":"text-slate-500 hover:bg-brand-50"}`}
              style={sentFilter===f?{background:"#8B1A4A"}:{}}>
              {f}
            </button>
          ))}
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
          <option value="All">All types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={priFilter} onChange={e => setPri(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300">
          <option value="All">All priorities</option>
          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={Bell} title="No reminders found"
            action={<Button onClick={() => { setForm(EMPTY); setModal(true) }} size="lg"><Plus size={16}/>Add reminder</Button>} />
        : (
          <Card>
            <div className="divide-y divide-slate-50">
              {filtered.map(r => {
                const isOverdue = !r.sent && r.scheduled_for && new Date(r.scheduled_for) < new Date()
                return (
                  <div key={r.id} className={`px-4 py-3 flex items-center gap-3 ${r.sent?"opacity-60":""}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.sent?"bg-green-400":isOverdue?"bg-red-400":"bg-brand-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-800">{r.subject || r.type}</p>
                        <Badge label={r.type} color={TYPE_COLORS[r.type]||"gray"} />
                        {r.sent && <span className="text-xs text-green-600 font-medium">✓ Sent</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {r.clients && <span className="text-xs text-slate-400">{r.clients.first_name} {r.clients.last_name}</span>}
                        {r.trips && <span className="text-xs text-slate-400">· {r.trips.destination}</span>}
                        {r.scheduled_for && (
                          <span className={`text-xs font-medium ${isOverdue?"text-red-500":"text-slate-400"}`}>
                            · {format(new Date(r.scheduled_for),"MMM d, yyyy h:mm a")}
                            {isOverdue?" — OVERDUE":""}
                          </span>
                        )}
                        {r.channel && <span className="text-xs text-slate-400">· {r.channel}</span>}
                      </div>
                      {r.message && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.message}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={r.priority} />
                      {!r.sent && <Button size="sm" variant="pink" onClick={() => markSent(r.id)}>Mark sent</Button>}
                      <button onClick={() => deleteReminder(r.id)} className="text-slate-300 hover:text-red-400 transition-colors"><X size={14}/></button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      }

      <Modal open={modal} onClose={() => setModal(false)} title="Add reminder" wide
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving?"Saving...":"Add reminder"}</Button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Client" {...field("client_id")} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, trip_id:"" }))}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </Select>
          <Select label="Trip" {...field("trip_id")}>
            <option value="">No trip</option>
            {clientTrips.map(t => <option key={t.id} value={t.id}>{t.destination}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Reminder type" {...field("type")}>{TYPES.map(t=><option key={t}>{t}</option>)}</Select>
          <Select label="Channel"       {...field("channel")}>{CHANNELS.map(c=><option key={c}>{c}</option>)}</Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" {...field("priority")}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</Select>
          <Input  label="Scheduled for" type="datetime-local" {...field("scheduled_for")} />
        </div>
        <Input    label="Subject"  {...field("subject")}  placeholder="e.g. Final payment due in 7 days" />
        <Textarea label="Message"  {...field("message")}  placeholder="Message to send to the client..." />
      </Modal>
    </div>
  )
}
