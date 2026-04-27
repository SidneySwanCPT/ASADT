import { useState } from "react"
import { LifeBuoy, CheckCircle2, AlertTriangle } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { Card, PageHeader, Button, Input, Select, Textarea } from "../components/UI"

const CATEGORIES = ["Hardware","Software","Network","Access/Permissions","Website Bug","Data Issue","Other"]
const PRIORITIES = ["Low","Medium","High","Urgent"]

const initialForm = (user) => ({
  name: user?.user_metadata?.full_name || user?.user_metadata?.name || "",
  email: user?.email || "",
  category: "Software",
  priority: "Medium",
  subject: "",
  description: "",
})

export default function TicketPage() {
  const { session } = useAuth()
  const user = session?.user
  const [form, setForm] = useState(() => initialForm(user))
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState("")

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

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
        body: JSON.stringify(form),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        throw new Error(data.error || `Request failed (${resp.status})`)
      }
      setSuccess({ ...form, timestamp: data.timestamp || new Date().toISOString() })
      setForm(initialForm(user))
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
        subtitle="Submit a ticket and the team will follow up by email."
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
                <div><span className="text-green-600 uppercase tracking-wide">Submitted:</span> {new Date(success.timestamp).toLocaleString()}</div>
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
    </div>
  )
}
