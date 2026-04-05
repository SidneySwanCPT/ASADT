import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { CheckSquare, Plus, Search, X, Edit2 } from "lucide-react"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, StatusBadge, StatsBar, SectionCard } from "../components/UI"

const PRIORITIES  = ["Low","Medium","High","Urgent"]
const CATEGORIES  = ["General","Documents","Payment","Visa","Insurance","Transport","Hotel","Communication"]

const EMPTY = { client_id:"", trip_id:"", traveler_id:"", title:"", description:"", due_date:"", priority:"Medium", category:"General" }

export default function TasksPage() {
  const [tasks, setTasks]       = useState([])
  const [clients, setClients]   = useState([])
  const [trips, setTrips]       = useState([])
  const [travelers, setTravelers] = useState([])
  const [search, setSearch]     = useState("")
  const [filter, setFilter]     = useState("Open")
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [detail, setDetail]     = useState(null)
  const [editing, setEditing]   = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)

  const load = async () => {
    const [{ data: t }, { data: c }, { data: tr }, { data: tv }] = await Promise.all([
      supabase.from("tasks").select("*, clients(first_name,last_name), trips(destination), travelers(full_name)").order("due_date"),
      supabase.from("clients").select("id,first_name,last_name").order("last_name"),
      supabase.from("trips").select("id,destination,client_id").order("departure_date", { ascending: false }),
      supabase.from("travelers").select("id,full_name,client_id").order("full_name"),
    ])
    setTasks(t || [])
    setClients(c || [])
    setTrips(tr || [])
    setTravelers(tv || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clientTrips     = trips.filter(t => t.client_id === form.client_id)
  const clientTravelers = travelers.filter(t => t.client_id === form.client_id)

  const openNew = () => { setForm(EMPTY); setModal(true) }
  const openEdit = (task) => {
    setForm({ ...EMPTY, ...task, client_id: task.client_id || "", trip_id: task.trip_id || "", traveler_id: task.traveler_id || "" })
    setDetail(null)
    setEditing(true)
    setModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, completed: false, traveler_id: form.traveler_id || null, trip_id: form.trip_id || null, client_id: form.client_id || null }
    if (editing && detail) {
      await supabase.from("tasks").update(payload).eq("id", detail.id)
    } else {
      await supabase.from("tasks").insert(payload)
    }
    setSaving(false)
    setModal(false)
    setEditing(false)
    load()
  }

  const complete = async (id) => {
    await supabase.from("tasks").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", id)
    setDetail(null)
    load()
  }

  const reopen = async (id) => {
    await supabase.from("tasks").update({ completed: false, completed_at: null }).eq("id", id)
    load()
  }

  const deleteTask = async (id) => {
    if (!confirm("Delete this task?")) return
    await supabase.from("tasks").delete().eq("id", id)
    setDetail(null)
    load()
  }

  const field = (k) => ({ value: form[k] || "", onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = tasks.filter(t => {
    const ms = `${t.title} ${t.clients?.first_name || ""} ${t.clients?.last_name || ""}`.toLowerCase().includes(search.toLowerCase())
    const mf = filter === "All" ? true : filter === "Open" ? !t.completed : t.completed
    return ms && mf
  })

  const isOverdue = (task) => task.due_date && !task.completed && new Date(task.due_date) < new Date()
  const openCount = tasks.filter(t => !t.completed).length
  const overdueCount = tasks.filter(t => isOverdue(t)).length
  const urgentCount = tasks.filter(t => !t.completed && t.priority === "Urgent").length
  const doneCount = tasks.filter(t => t.completed).length

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open tasks`}
        action={<Button onClick={openNew} size="lg"><Plus size={16} />Add task</Button>}
      />

      <StatsBar stats={[
        { label: "Open tasks",   value: openCount,    color: "pink"  },
        { label: "Overdue",      value: overdueCount, color: "red"   },
        { label: "Urgent",       value: urgentCount,  color: "amber" },
        { label: "Completed",    value: doneCount,    color: "green" },
      ]} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm bg-white">
          {["Open","Completed","All"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 transition-colors text-sm ${filter===f ? "text-white" : "text-slate-500 hover:bg-brand-50"}`}
              style={filter===f ? {background:"#8B1A4A"} : {}}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={CheckSquare} title="No tasks found" action={<Button onClick={openNew} size="lg"><Plus size={16} />Add task</Button>} />
        : (
          <Card>
            <div className="divide-y divide-slate-50">
              {filtered.map(task => (
                <div key={task.id}
                  onClick={() => setDetail(task)}
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${task.completed ? "opacity-60" : ""} hover:bg-brand-50`}>
                  <button onClick={e => { e.stopPropagation(); task.completed ? reopen(task.id) : complete(task.id) }}
                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      task.completed ? "text-white border-green-500" : "border-slate-300 hover:border-brand-400"
                    }`}
                    style={task.completed ? {background:"#22c55e"} : {}}>
                    {task.completed && <span className="text-xs leading-none">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}>{task.title}</p>
                      {task.category && task.category !== "General" && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{task.category}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.clients && <span className="text-xs text-slate-400">{task.clients.first_name} {task.clients.last_name}</span>}
                      {task.trips && <span className="text-xs text-slate-400">· {task.trips.destination}</span>}
                      {task.travelers && <span className="text-xs text-brand-400">· {task.travelers.full_name}</span>}
                      {task.due_date && (
                        <span className={`text-xs font-medium ${isOverdue(task) ? "text-red-500" : "text-slate-400"}`}>
                          · Due {format(new Date(task.due_date), "MMM d, yyyy")}{isOverdue(task) ? " — OVERDUE" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={task.priority} />
                </div>
              ))}
            </div>
          </Card>
        )
      }

      {/* Task detail popup */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 py-4 rounded-t-2xl" style={{background:"#8B1A4A"}}>
              <div>
                <h2 className="text-base font-bold text-white" style={{fontFamily:"Georgia,serif"}}>{detail.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={detail.priority} />
                  {detail.category && <span className="text-xs text-brand-200">{detail.category}</span>}
                  {detail.completed && <span className="text-xs text-green-300 font-medium">✓ Completed</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(detail)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><Edit2 size={13} /></button>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={13} /></button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {detail.description && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-slate-700">{detail.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {detail.clients && (
                  <div className="bg-brand-50 rounded-lg p-3">
                    <p className="text-xs text-brand-400 uppercase tracking-wide mb-1">Client</p>
                    <p className="text-sm font-medium text-brand-800">{detail.clients.first_name} {detail.clients.last_name}</p>
                  </div>
                )}
                {detail.trips && (
                  <div className="bg-brand-50 rounded-lg p-3">
                    <p className="text-xs text-brand-400 uppercase tracking-wide mb-1">Trip</p>
                    <p className="text-sm font-medium text-brand-800">{detail.trips.destination}</p>
                  </div>
                )}
                {detail.travelers && (
                  <div className="bg-brand-50 rounded-lg p-3">
                    <p className="text-xs text-brand-400 uppercase tracking-wide mb-1">Traveler</p>
                    <p className="text-sm font-medium text-brand-800">{detail.travelers.full_name}</p>
                  </div>
                )}
                {detail.due_date && (
                  <div className={`rounded-lg p-3 ${isOverdue(detail) ? "bg-red-50" : "bg-slate-50"}`}>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${isOverdue(detail) ? "text-red-400" : "text-slate-400"}`}>Due date</p>
                    <p className={`text-sm font-medium ${isOverdue(detail) ? "text-red-700" : "text-slate-800"}`}>
                      {format(new Date(detail.due_date), "MMMM d, yyyy")}
                      {isOverdue(detail) && " — OVERDUE"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between">
              <Button variant="danger" size="sm" onClick={() => deleteTask(detail.id)}>Delete</Button>
              <div className="flex gap-2">
                {detail.completed
                  ? <Button variant="secondary" size="sm" onClick={() => reopen(detail.id)}>Reopen</Button>
                  : <Button size="sm" onClick={() => complete(detail.id)}>Mark complete</Button>
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => { setModal(false); setEditing(false) }}
        title={editing ? "Edit task" : "Add task"} wide
        footer={<>
          <Button variant="secondary" onClick={() => { setModal(false); setEditing(false) }}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.title}>{saving ? "Saving..." : editing ? "Save changes" : "Add task"}</Button>
        </>}>
        <Input label="Task title" {...field("title")} placeholder="e.g. Collect passport copy" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Client" {...field("client_id")}
            onChange={e => setForm(f => ({ ...f, client_id: e.target.value, trip_id: "", traveler_id: "" }))}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </Select>
          <Select label="Trip" {...field("trip_id")}>
            <option value="">No trip</option>
            {clientTrips.map(t => <option key={t.id} value={t.id}>{t.destination}</option>)}
          </Select>
        </div>
        <Select label="Assign to traveler (optional)" {...field("traveler_id")}>
          <option value="">Not assigned to a traveler</option>
          {clientTravelers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Due date" type="date" {...field("due_date")} />
          <Select label="Priority" {...field("priority")}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </Select>
          <Select label="Category" {...field("category")}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <Textarea label="Description" {...field("description")} placeholder="Additional details..." />
      </Modal>
    </div>
  )
}
