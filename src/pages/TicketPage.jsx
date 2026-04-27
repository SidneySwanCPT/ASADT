import { useEffect, useState } from "react"
import { LifeBuoy, CheckCircle2, AlertTriangle, Inbox } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { Card, PageHeader, Button, Input, Select, Textarea, Badge, Spinner } from "../components/UI"

const CATEGORIES = ["Hardware","Software","Network","Access/Permissions","Website Bug","Data Issue","Other"]
const PRIORITIES = ["Low","Medium","High","Urgent"]

const PRIORITY_COLOR = { Low:"gray", Medium:"blue", High:"amber", Urgent:"red" }
const STATUS_COLOR   = { Open:"gray", "In Progress":"blue", Resolved:"green", Closed:"gray" }
const RESOLVED_STATUSES = new Set(["Resolved","Closed"])

const initialForm = (user) => ({
  name: user?.user_metadata?.full_name || user?.user_metadata?.name || "",
  email: user?.email || "",
  category: "Software",
  priority: "Medium",
  subject: "",
  description: "",
})

const fmtDate = (iso) => {
  if (!iso) return ""
  try { return format(new Date(iso), "MMM d, yyyy 'at' h:mm a") } catch { return iso }
}

export default function TicketPage() {
  const { session } = useAuth()
  const user  = session?.user
  const email = user?.email

  const [form, setForm] = useState(() => initialForm(user))
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState("")

  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [fetchError, setFetchError] = useState("")

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const loadTickets = async () => {
    setLoadingTickets(true)
    setFetchError("")
    const { data, error: e } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
    if (e) {
      console.error("[TicketPage] tickets query failed:", e)
      setFetchError(e.message || "Failed to load tickets.")
      setTickets([])
    } else {
      setTickets(data || [])
    }
    setLoadingTickets(false)
  }

  useEffect(() => {
    loadTickets()

    const channel = supabase
      .channel("tickets-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          setTickets(prev => {
            if (payload.eventType === "INSERT") {
              if (prev.some(t => t.id === payload.new.id)) return prev
              return [payload.new, ...prev]
            }
            if (payload.eventType === "UPDATE") {
              return prev.map(t => t.id === payload.new.id ? payload.new : t)
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(t => t.id !== payload.old.id)
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess(null)
    if (!form.name || !form.email || !form.subject || !form.description) {
      setError("Please fill in all required fields.")
      return
    }
    setSubmitting(true)
    try {
      const resp = await fetch("/.netlify/functions/submit-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, user_id: user?.id || null }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`)
      setSuccess({ ...form, ticket_id: data.ticket_id, timestamp: data.timestamp || new Date().toISOString() })
      setForm(initialForm(user))
      loadTickets()
    } catch (err) {
      setError(err.message || "Something went wrong submitting your ticket.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <PageHeader
        title="IT Support"
        subtitle="Submit a ticket and track its status here."
      />

      {success && (
        <Card className="mb-5 border-green-200 bg-green-50">
          <div className="p-4 flex gap-3">
            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Ticket submitted</p>
              <p className="text-xs text-green-700 mt-0.5">
                We'll respond to <span className="font-medium">{success.email}</span> as soon as possible.
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-900">
                <div><span className="text-green-600 uppercase tracking-wide">Subject:</span> {success.subject}</div>
                <div><span className="text-green-600 uppercase tracking-wide">Category:</span> {success.category}</div>
                <div><span className="text-green-600 uppercase tracking-wide">Priority:</span> {success.priority}</div>
                <div><span className="text-green-600 uppercase tracking-wide">Submitted:</span> {fmtDate(success.timestamp)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className="mb-5 border-red-200 bg-red-50">
          <div className="p-4 flex gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Couldn't submit ticket</p>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-brand-100" style={{background:"#fdf2f7"}}>
          <div className="bg-brand-100 text-brand-600 rounded-lg p-2">
            <LifeBuoy size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-800">New support ticket</p>
            <p className="text-xs text-brand-600">All fields are required.</p>
          </div>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Your name"
              id="ticket-name"
              value={form.name}
              onChange={e => update("name", e.target.value)}
              placeholder="Jane Doe"
              required
            />
            <Input
              label="Your email"
              id="ticket-email"
              type="email"
              value={form.email}
              onChange={e => update("email", e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Category"
              id="ticket-category"
              value={form.category}
              onChange={e => update("category", e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select
              label="Priority"
              id="ticket-priority"
              value={form.priority}
              onChange={e => update("priority", e.target.value)}
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>

          <Input
            label="Subject"
            id="ticket-subject"
            value={form.subject}
            onChange={e => update("subject", e.target.value)}
            placeholder="Short summary of the issue"
            required
          />

          <Textarea
            label="Description"
            id="ticket-description"
            rows={8}
            value={form.description}
            onChange={e => update("description", e.target.value)}
            placeholder="What happened? What were you trying to do? Any error messages or steps to reproduce?"
            required
          />

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <LifeBuoy size={14} />
                  Submit ticket
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800" style={{fontFamily:"Georgia,serif"}}>
            My Tickets
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {loadingTickets ? "Loading…" : `${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}`}
            </span>
            <Button size="sm" variant="secondary" onClick={loadTickets} disabled={loadingTickets}>
              Refresh
            </Button>
          </div>
        </div>

        {fetchError && (
          <Card className="mb-3 border-red-200 bg-red-50">
            <div className="p-4 flex gap-3">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Couldn't load tickets</p>
                <p className="text-xs text-red-700 mt-0.5">{fetchError}</p>
                <p className="text-xs text-red-600 mt-1">
                  This usually means a Supabase RLS policy is blocking the read. See the browser console for the raw error.
                </p>
              </div>
            </div>
          </Card>
        )}

        {loadingTickets ? (
          <Card>
            <div className="p-6">
              <Spinner />
            </div>
          </Card>
        ) : tickets.length === 0 && !fetchError ? (
          <Card>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="bg-brand-50 rounded-full p-4 mb-3">
                <Inbox size={22} className="text-brand-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No tickets submitted yet.</p>
            </div>
          </Card>
        ) : tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map(t => <TicketCard key={t.id} ticket={t} />)}
          </div>
        ) : null}
      </section>
    </div>
  )
}

function TicketCard({ ticket }) {
  const isResolved = RESOLVED_STATUSES.has(ticket.status)
  const resolvedAt = ticket.resolved_at ? fmtDate(ticket.resolved_at) : null

  return (
    <Card>
      {isResolved && (
        <div className="px-4 py-3 bg-green-50 border-b border-green-200 rounded-t-xl">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                This ticket has been {ticket.status === "Closed" ? "closed" : "resolved"}
                {resolvedAt && <span className="font-normal text-green-700"> · {resolvedAt}</span>}
              </p>
              {ticket.admin_notes && (
                <p className="text-xs text-green-900 mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {ticket.admin_notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-slate-800 leading-snug">{ticket.subject}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge label={ticket.priority} color={PRIORITY_COLOR[ticket.priority] || "gray"} />
            <Badge label={ticket.status}   color={STATUS_COLOR[ticket.status]   || "gray"} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
          <span>{ticket.category}</span>
          <span className="text-slate-300">•</span>
          <span>Submitted {fmtDate(ticket.created_at)}</span>
        </div>

        <p className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3 leading-relaxed">
          {ticket.description}
        </p>

        {!isResolved && ticket.admin_notes && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Admin notes</p>
            <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{ticket.admin_notes}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
