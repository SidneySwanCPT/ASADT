import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { Bell, Plus, Search, Send } from "lucide-react"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, Badge } from "../components/UI"

const TYPES = [
  "payment_due", "trip_countdown", "passport_expiry",
  "document_missing", "visa_deadline", "custom"
]

const TYPE_LABELS = {
  payment_due:      "Payment due",
  trip_countdown:   "Trip countdown",
  passport_expiry:  "Passport expiry",
  document_missing: "Document missing",
  visa_deadline:    "Visa deadline",
  custom:           "Custom",
}

const EMPTY = {
  client_id: "", trip_id: "", type: "custom", channel: "email",
  scheduled_for: "", subject: "", custom_message: ""
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState([])
  const [clients, setClients]     = useState([])
  const [trips, setTrips]         = useState([])
  const [search, setSearch]       = useState("")
  const [filter, setFilter]       = useState("Pending")
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    const [{ data: r }, { data: c }, { data: t }] = await Promise.all([
      supabase.from("reminders")
        .select("*, clients(first_name,last_name), trips(destination)")
        .order("scheduled_for"),
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
    await supabase.from("reminders").insert({ ...form, sent: false })
    setSaving(false)
    setModal(false)
    load()
  }

  const markSent = async (id) => {
    await supabase.from("reminders").update({ sent: true, sent_at: new Date().toISOString() }).eq("id", id)
    load()
  }

  const deleteReminder = async (id) => {
    await supabase.from("reminders").delete().eq("id", id)
    load()
  }

  const field = (k) => ({ value: form[k] || "", onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = reminders.filter(r => {
    const matchSearch = `${r.clients?.first_name} ${r.clients?.last_name} ${r.subject}`.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "All" ? true : filter === "Pending" ? !r.sent : r.sent
    return matchSearch && matchFilter
  })

  const isOverdue = (r) => !r.sent && new Date(r.scheduled_for) < new Date()

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Reminders"
        subtitle={`${reminders.filter(r => !r.sent).length} pending reminders`}
        action={<Button onClick={() => { setForm(EMPTY); setModal(true) }}><Plus size={15} />Add reminder</Button>}
      />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search reminders..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm bg-white">
          {["Pending", "Sent", "All"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 transition-colors ${filter === f ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={Bell} title="No reminders found" action={<Button onClick={() => setModal(true)}><Plus size={14} />Add reminder</Button>} />
        : (
          <Card>
            <div className="divide-y divide-slate-50">
              {filtered.map(r => (
                <div key={r.id} className={`px-4 py-3 flex items-center gap-4 ${r.sent ? "opacity-60" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${r.sent ? "bg-green-50 text-green-600" : isOverdue(r) ? "bg-red-50 text-red-500" : "bg-brand-50 text-brand-500"}`}>
                    <Bell size={14} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {r.subject || TYPE_LABELS[r.type] || r.type}
                      </p>
                      <Badge
                        label={TYPE_LABELS[r.type] || r.type}
                        color={r.type === "payment_due" ? "amber" : r.type === "passport_expiry" ? "red" : "blue"}
                      />
                      <Badge label={r.channel} color="gray" />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.clients && <span className="text-xs text-slate-400">{r.clients.first_name} {r.clients.last_name}</span>}
                      {r.trips && <span className="text-xs text-slate-400">· {r.trips.destination}</span>}
                      <span className={`text-xs ${isOverdue(r) ? "text-red-500 font-medium" : "text-slate-400"}`}>
                        · {r.sent ? "Sent" : "Scheduled"} {format(new Date(r.scheduled_for), "MMM d, yyyy 'at' h:mm a")}
                        {isOverdue(r) ? " (overdue)" : ""}
                      </span>
                    </div>
                    {r.custom_message && <p className="text-xs text-slate-400 mt-0.5 truncate">{r.custom_message}</p>}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    {!r.sent && (
                      <Button size="sm" variant="secondary" onClick={() => markSent(r.id)}>
                        <Send size={12} />Mark sent
                      </Button>
                    )}
                    <button onClick={() => deleteReminder(r.id)} className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      }

      <Modal
        open={modal} onClose={() => setModal(false)}
        title="Add reminder"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.scheduled_for}>{saving ? "Saving..." : "Schedule reminder"}</Button>
        </>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Select label="Client" {...field("client_id")}
            onChange={e => setForm(f => ({ ...f, client_id: e.target.value, trip_id: "" }))}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </Select>
          <Select label="Trip (optional)" {...field("trip_id")}>
            <option value="">No trip</option>
            {clientTrips.map(t => <option key={t.id} value={t.id}>{t.destination}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" {...field("type")}>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </Select>
          <Select label="Channel" {...field("channel")}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="both">Both</option>
          </Select>
        </div>
        <Input label="Send date & time" type="datetime-local" {...field("scheduled_for")} />
        <Input label="Subject line" {...field("subject")} placeholder="Your trip is 10 days away!" />
        <Textarea label="Custom message (optional)" {...field("custom_message")}
          placeholder="Write a personal note to include in the reminder..." />
      </Modal>
    </div>
  )
}
