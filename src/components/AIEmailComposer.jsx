import { useState } from "react"
import { callClaude } from "../lib/claude"
import { Sparkles, Copy, Mail, RefreshCw, X, Check } from "lucide-react"
import { Button, Select, Textarea, Modal } from "./UI"

const EMAIL_TYPES = [
  { value: "payment_reminder",   label: "Payment reminder"       },
  { value: "payment_overdue",    label: "Overdue payment notice" },
  { value: "trip_confirmation",  label: "Trip confirmation"      },
  { value: "pre_departure",      label: "Pre-departure tips"     },
  { value: "welcome_home",       label: "Welcome home"           },
  { value: "birthday",           label: "Birthday greeting"      },
  { value: "reengagement",       label: "Re-engagement outreach" },
  { value: "document_request",   label: "Document collection"    },
  { value: "custom",             label: "Custom message"         },
]

export default function AIEmailComposer({ client, trip, open, onClose }) {
  const [emailType, setEmailType] = useState("payment_reminder")
  const [customPrompt, setCustomPrompt] = useState("")
  const [subject, setSubject]     = useState("")
  const [body, setBody]           = useState("")
  const [loading, setLoading]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const [error, setError]         = useState("")

  // Guard — don't render at all if not open
  if (!open) return null

  const draft = async () => {
    setLoading(true); setError(""); setBody(""); setSubject("")

    const clientName  = `${client?.first_name||""} ${client?.last_name||""}`.trim()
    const destination = trip?.destination || ""
    const depDate     = trip?.departure_date ? new Date(trip.departure_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : ""
    const retDate     = trip?.return_date    ? new Date(trip.return_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : ""
    const balance     = trip ? Math.max(0, parseFloat(trip.total_price||0) - parseFloat(trip.amount_paid||0)) : 0
    const occasion    = trip?.occasion || ""

    const system = `You are a professional travel agent assistant for ASA Destination Travel.
Write warm, personal, professional emails on behalf of the travel agent.
Always address the client by their first name.
Keep emails concise — 3-5 short paragraphs maximum.
Sign off as "Your travel agent at ASA Destination Travel".
Return ONLY a JSON object with two fields: "subject" and "body".
No markdown, no backticks, no explanation — just the raw JSON.`

    const prompts = {
      payment_reminder:  `Write a friendly payment reminder email to ${clientName} for their ${destination ? destination+" " : ""}trip${depDate ? " on "+depDate : ""}. Balance due: $${balance.toLocaleString()}.`,
      payment_overdue:   `Write a firm but kind overdue payment notice to ${clientName}. Their payment of $${balance.toLocaleString()} for ${destination||"their trip"} is past due.`,
      trip_confirmation: `Write an exciting trip confirmation email to ${clientName} for their ${occasion ? occasion+" " : ""}trip to ${destination}${depDate ? ", departing "+depDate : ""}${retDate ? " and returning "+retDate : ""}.`,
      pre_departure:     `Write a pre-departure tips and checklist email to ${clientName} traveling to ${destination} on ${depDate||"soon"}.`,
      welcome_home:      `Write a warm welcome home email to ${clientName} who just returned from ${destination||"their trip"}.`,
      birthday:          `Write a warm birthday greeting email to ${clientName}. Mention their special day and plant a seed for their next trip.`,
      reengagement:      `Write a gentle re-engagement email to ${clientName} who hasn't traveled with ASA in over a year.`,
      document_request:  `Write a friendly email to ${clientName} requesting travel documents for their ${destination||"upcoming"} trip.`,
      custom:            customPrompt || `Write a professional email to ${clientName} about their ${destination||"travel"} booking.`,
    }

    try {
      const result = await callClaude(system, prompts[emailType] || prompts.custom)
      const clean  = result.replace(/```json|```/g, "").trim()
      const parsed = JSON.parse(clean)
      setSubject(parsed.subject || "")
      setBody(parsed.body || "")
    } catch (e) {
      setError("Could not generate email. Please try again.")
    }
    setLoading(false)
  }

  const copyAll = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const openMailto = () => {
    window.open(`mailto:${client?.email||""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  const reset = () => { setBody(""); setSubject(""); setError(""); setCopied(false) }

  return (
    <Modal open={open} onClose={onClose} title="AI email composer" wide
      footer={
        body ? (
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" onClick={() => { reset(); draft() }}>
              <RefreshCw size={13}/>Redraft
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={copyAll}>
                {copied ? <><Check size={13}/>Copied!</> : <><Copy size={13}/>Copy all</>}
              </Button>
              {client?.email && (
                <Button onClick={openMailto}><Mail size={13}/>Open in email</Button>
              )}
            </div>
          </div>
        ) : null
      }>

      <div className="bg-brand-50 rounded-xl p-3 text-sm">
        <p className="font-medium text-brand-800">{client?.first_name} {client?.last_name}</p>
        {trip && <p className="text-brand-600 text-xs mt-0.5">{trip.destination}{trip.departure_date ? ` · ${new Date(trip.departure_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}` : ""}</p>}
        {!trip && client?.email && <p className="text-brand-500 text-xs mt-0.5">{client.email}</p>}
      </div>

      <Select label="Email type" value={emailType} onChange={e => { setEmailType(e.target.value); reset() }}>
        {EMAIL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </Select>

      {emailType === "custom" && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Describe what you need</label>
          <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3}
            placeholder="e.g. Let her know the cruise departure time changed to 4pm..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
        </div>
      )}

      {!body && (
        <Button onClick={draft} disabled={loading} className="w-full justify-center" size="lg">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Drafting...</>
            : <><Sparkles size={16}/>Draft with AI</>
          }
        </Button>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {body && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white resize-none"/>
          </div>
        </div>
      )}
    </Modal>
  )
}
