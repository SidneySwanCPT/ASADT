import { useState, useEffect } from "react"
import { suggestTasks } from "../lib/ai"
import { Sparkles, X, Check, RefreshCw, Plus } from "lucide-react"

export default function AITaskSuggestions({ trip, client, onAddTasks, onClose }) {
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState("")

  const generate = async () => {
    setLoading(true); setError(""); setSuggestions([])
    try {
      const tasks = await suggestTasks({ trip, client })
      setSuggestions(tasks)
      setSelected(new Set(tasks.map((_, i) => i)))
    } catch { setError("Could not generate suggestions. Please try again.") }
    setLoading(false)
  }

  useEffect(() => { generate() }, [])

  const toggle = (i) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === suggestions.length) setSelected(new Set())
    else setSelected(new Set(suggestions.map((_,i) => i)))
  }

  const addSelected = async () => {
    setSaving(true)
    const toAdd = suggestions.filter((_,i) => selected.has(i))
    await onAddTasks(toAdd)
    setSaving(false)
    onClose()
  }

  const priorityColor = { Low:"bg-slate-100 text-slate-600", Medium:"bg-blue-100 text-blue-700", High:"bg-amber-100 text-amber-700", Urgent:"bg-red-100 text-red-600" }
  const categoryColor = { Documents:"bg-purple-50 text-purple-600", Payment:"bg-green-50 text-green-600", Visa:"bg-orange-50 text-orange-600", Insurance:"bg-teal-50 text-teal-600", Transport:"bg-blue-50 text-blue-600", Hotel:"bg-pink-50 text-pink-600", Communication:"bg-indigo-50 text-indigo-600", General:"bg-slate-50 text-slate-600" }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{background:"#8B1A4A"}}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-pink-200"/>
            <h2 className="text-sm font-bold text-white">AI Task Suggestions</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30"><X size={13}/></button>
        </div>

        <div className="px-5 py-4">
          {/* Trip context */}
          <div className="bg-pink-50 rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-pink-700">{trip.destination}</p>
            <p className="text-xs text-pink-500">{trip.departure_date ? new Date(trip.departure_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : "TBD"}{trip.occasion ? ` · ${trip.occasion}` : ""}</p>
          </div>

          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="w-7 h-7 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"/>
              <p className="text-sm text-slate-500">Generating smart task list...</p>
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

          {suggestions.length > 0 && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{selected.size} of {suggestions.length} tasks selected</p>
                <button onClick={toggleAll} className="text-xs text-pink-600 hover:text-pink-800 font-medium transition-colors">
                  {selected.size === suggestions.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {suggestions.map((task, i) => (
                  <div key={i} onClick={() => toggle(i)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selected.has(i) ? "border-pink-300 bg-pink-50" : "border-slate-100 hover:border-slate-200"
                    }`}>
                    <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
                      selected.has(i) ? "text-white border-transparent" : "border-slate-300"
                    }`} style={selected.has(i)?{background:"#8B1A4A"}:{}}>
                      {selected.has(i) && <Check size={11}/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{task.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priorityColor[task.priority]||priorityColor.Medium}`}>{task.priority}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${categoryColor[task.category]||categoryColor.General}`}>{task.category}</span>
                        {task.days_before && <span className="text-xs text-slate-400">{task.days_before}d before departure</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={generate} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <RefreshCw size={11}/>Regenerate
                </button>
                <button onClick={addSelected} disabled={saving || selected.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 hover:shadow-md transition-all ml-auto font-medium"
                  style={{background:"#8B1A4A"}}>
                  <Plus size={13}/>{saving ? "Adding..." : `Add ${selected.size} task${selected.size!==1?"s":""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
