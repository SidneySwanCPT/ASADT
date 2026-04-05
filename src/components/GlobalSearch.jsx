import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"
import { useNavigate } from "react-router-dom"
import { Search, Users, Globe, CheckSquare, X } from "lucide-react"

export default function GlobalSearch() {
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState({ clients: [], trips: [], tasks: [] })
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (query.length < 2) { setResults({ clients: [], trips: [], tasks: [] }); setOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      const q = query.toLowerCase()
      const [{ data: clients }, { data: trips }, { data: tasks }] = await Promise.all([
        supabase.from("clients").select("id,first_name,last_name,email,phone,home_airport,passport_number").or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`).limit(5),
        supabase.from("trips").select("id,destination,departure_date,status,clients(first_name,last_name)").ilike("destination", `%${q}%`).limit(4),
        supabase.from("tasks").select("id,title,clients(first_name,last_name)").ilike("title", `%${q}%`).eq("completed", false).limit(3),
      ])
      setResults({ clients: clients || [], trips: trips || [], tasks: tasks || [] })
      setOpen(true)
      setLoading(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const total = results.clients.length + results.trips.length + results.tasks.length

  const go = (path) => { setQuery(""); setOpen(false); navigate(path) }

  const highlight = (text, q) => {
    if (!q || !text) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return <>{text.slice(0, idx)}<mark className="bg-brand-200 text-brand-800 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search clients, trips, tasks..."
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white hover:border-brand-200 transition-colors shadow-sm"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
          {loading && <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>}

          {!loading && total === 0 && (
            <div className="px-4 py-4 text-sm text-slate-400 text-center">No results for "{query}"</div>
          )}

          {results.clients.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 flex items-center gap-1.5">
                <Users size={11} />Clients
              </div>
              {results.clients.map(c => {
                const missing = []
                if (!c.email) missing.push("email")
                if (!c.phone) missing.push("phone")
                if (!c.passport_number) missing.push("passport")
                return (
                  <button key={c.id} onClick={() => go(`/clients/${c.id}`)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:"#8B1A4A"}}>
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-800">{highlight(`${c.first_name} ${c.last_name}`, query)}</p>
                        {missing.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title={`Missing: ${missing.join(", ")}`} />}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{c.email || c.phone || "No contact info"}{c.home_airport ? ` · ${c.home_airport}` : ""}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {results.trips.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 flex items-center gap-1.5">
                <Globe size={11} />Trips
              </div>
              {results.trips.map(t => (
                <button key={t.id} onClick={() => go("/trips")}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0">
                  <p className="text-sm font-medium text-slate-800">{highlight(t.destination, query)}</p>
                  <p className="text-xs text-slate-400">
                    {t.clients ? `${t.clients.first_name} ${t.clients.last_name}` : "—"}
                    {t.departure_date ? ` · ${new Date(t.departure_date).toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"})}` : ""}
                    {` · ${t.status}`}
                  </p>
                </button>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 flex items-center gap-1.5">
                <CheckSquare size={11} />Tasks
              </div>
              {results.tasks.map(t => (
                <button key={t.id} onClick={() => go("/tasks")}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0">
                  <p className="text-sm font-medium text-slate-800">{highlight(t.title, query)}</p>
                  {t.clients && <p className="text-xs text-slate-400">{t.clients.first_name} {t.clients.last_name}</p>}
                </button>
              ))}
            </div>
          )}

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400">{total} result{total !== 1 ? "s" : ""} — press Enter to search all</p>
          </div>
        </div>
      )}
    </div>
  )
}
