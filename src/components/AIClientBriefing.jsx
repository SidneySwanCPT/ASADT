import { useState, useEffect } from "react"
import { callClaude } from "../lib/claude"
import { Sparkles, X, Copy, Check, RefreshCw, FileText } from "lucide-react"

export default function AIClientBriefing({ client, trips, tasks, travelers, loyalty, onClose }) {
  const [briefing, setBriefing] = useState("")
  const [loading, setLoading]   = useState(true)
  const [copied, setCopied]     = useState(false)
  const [error, setError]       = useState("")

  const generate = async () => {
    setLoading(true); setError(""); setBriefing("")
    try {
      const result = await generateClientBriefing({ client, trips, tasks, travelers, loyalty })
      setBriefing(result)
    } catch { setError("Could not generate briefing. Please try again.") }
    setLoading(false)
  }

  useEffect(() => { generate() }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(briefing)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const formatBriefing = (text) => {
    if (!text) return null
    return text.split("\n").map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-1.5"/>
      if (/^\d+\.|^#+/.test(line.trim())) return <p key={i} className="text-sm font-bold text-pink-700 mt-3 mb-1">{line.replace(/^#+\s*|^\d+\.\s*/,"")}</p>
      if (/^[-•]/.test(line.trim())) return (
        <p key={i} className="text-sm text-slate-700 pl-3 flex gap-2">
          <span className="text-pink-400 flex-shrink-0">·</span>
          <span>{line.replace(/^[-•]\s*/,"")}</span>
        </p>
      )
      return <p key={i} className="text-sm text-slate-700 leading-relaxed">{line}</p>
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{background:"#8B1A4A"}}>
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-pink-200"/>
            <h2 className="text-sm font-bold text-white">Pre-call briefing — {client.first_name} {client.last_name}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={13}/></button>
        </div>
        <div className="px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"/>
              <p className="text-sm text-slate-500">Preparing your briefing...</p>
            </div>
          )}
          {error && (
            <div className="space-y-3">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              <button onClick={generate} className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg" style={{background:"#8B1A4A"}}>
                <RefreshCw size={13}/>Try again
              </button>
            </div>
          )}
          {briefing && !loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-pink-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-pink-700">{trips.length}</p>
                  <p className="text-xs text-pink-500">Total trips</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-700">${trips.reduce((s,t)=>s+parseFloat(t.amount_paid||0),0).toLocaleString()}</p>
                  <p className="text-xs text-green-500">Total spent</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-amber-700">{tasks.filter(t=>!t.completed).length}</p>
                  <p className="text-xs text-amber-500">Open tasks</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 space-y-0.5">{formatBriefing(briefing)}</div>
              <div className="flex gap-2">
                <button onClick={generate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <RefreshCw size={11}/>Regenerate
                </button>
                <button onClick={copy} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${copied?"bg-green-50 text-green-600 border-green-200":"text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                  {copied ? <><Check size={11}/>Copied!</> : <><Copy size={11}/>Copy briefing</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
