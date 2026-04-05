import { useState } from "react"
import { draftEmail } from "../lib/ai"
import { Sparkles, Copy, Check, RefreshCw, X, Mail } from "lucide-react"

const EMAIL_TYPES = [
  { value:"payment_reminder",     label:"Payment reminder"  },
  { value:"trip_details",         label:"Pre-trip details"  },
  { value:"welcome_home",         label:"Welcome home"      },
  { value:"deposit_confirmation", label:"Deposit confirmed" },
  { value:"booking_confirmation", label:"Booking confirmed" },
  { value:"custom",               label:"Custom"            },
]

export default function AIEmailComposer({ client, trip, onClose }) {
  const [emailType, setEmailType] = useState("trip_details")
  const [customCtx, setCustomCtx] = useState("")
  const [draft, setDraft]         = useState("")
  const [subject, setSubject]     = useState("")
  const [loading, setLoading]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const [error, setError]         = useState("")

  const generate = async () => {
    setLoading(true); setError("")
    try {
      const result = await draftEmail({ type: emailType, client, trip, customContext: customCtx })
      const lines  = result.split("\n")
      const subLine = lines.find(l => l.toLowerCase().startsWith("subject:"))
      if (subLine) {
        setSubject(subLine.replace(/^subject:\s*/i,"").trim())
        setDraft(lines.slice(lines.indexOf(subLine)+1).join("\n").trim())
      } else { setSubject(""); setDraft(result.trim()) }
    } catch { setError("Could not generate email. Please try again.") }
    setLoading(false)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(subject ? `Subject: ${subject}\n\n${draft}` : draft)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const mailto = () => window.open(`mailto:${client.email||""}?subject=${encodeURIComponent(subject||"")}&body=${encodeURIComponent(draft||"")}`)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{background:"#8B1A4A"}}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-pink-200"/>
            <h2 className="text-sm font-bold text-white">AI Email Composer</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={13}/></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-pink-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{background:"#8B1A4A"}}>
              {client.first_name?.[0]}{client.last_name?.[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-pink-900">{client.first_name} {client.last_name}</p>
              <p className="text-xs text-pink-600">{client.email||"No email on file"}{trip ? ` · ${trip.destination}` : ""}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2 uppercase tracking-wide">Email type</label>
            <div className="grid grid-cols-3 gap-2">
              {EMAIL_TYPES.map(({value,label}) => (
                <button key={value} onClick={() => setEmailType(value)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${emailType===value?"text-white border-transparent":"border-slate-200 text-slate-600 hover:border-pink-200 hover:bg-pink-50"}`}
                  style={emailType===value?{background:"#8B1A4A"}:{}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">
              {emailType==="custom" ? "What should the email be about?" : "Additional context (optional)"}
            </label>
            <textarea value={customCtx} onChange={e=>setCustomCtx(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
              placeholder={emailType==="custom" ? "e.g. Follow up on visa application..." : "Any specific details..."}/>
          </div>
          <button onClick={generate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-60 hover:shadow-md transition-all"
            style={{background:"#8B1A4A"}}>
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Drafting...</span></>
              : <><Sparkles size={14}/><span>Draft with AI</span></>}
          </button>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {draft && (
            <div className="space-y-3">
              <div className="border border-pink-200 rounded-xl overflow-hidden">
                {subject && (
                  <div className="px-3 py-2 bg-pink-50 border-b border-pink-100">
                    <p className="text-xs text-pink-500 uppercase tracking-wide font-medium mb-0.5">Subject</p>
                    <input value={subject} onChange={e=>setSubject(e.target.value)} className="w-full text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"/>
                  </div>
                )}
                <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={10}
                  className="w-full px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none resize-none" style={{minHeight:"180px"}}/>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={generate} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <RefreshCw size={11}/>Regenerate
                </button>
                <button onClick={copy} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${copied?"bg-green-50 text-green-600 border-green-200":"text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                  {copied ? <><Check size={11}/>Copied!</> : <><Copy size={11}/>Copy</>}
                </button>
                {client.email && (
                  <button onClick={mailto} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white rounded-lg hover:shadow-md transition-all ml-auto" style={{background:"#8B1A4A"}}>
                    <Mail size={11}/>Open in email client
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
