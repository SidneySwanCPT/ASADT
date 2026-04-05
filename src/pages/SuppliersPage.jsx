import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Building2, Plus, Search, Phone, Mail, Globe, ExternalLink } from "lucide-react"
import { Card, PageHeader, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, Badge, StatsBar } from "../components/UI"

const CATEGORIES = ["hotel","airline","cruise","tour","transfer","insurance","other"]
const CAT_COLORS = { hotel:"blue", airline:"purple", cruise:"teal", tour:"green", transfer:"amber", insurance:"red", other:"gray" }
const EMPTY = { name:"", category:"hotel", contact_name:"", email:"", phone:"", website:"", notes:"" }

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch]       = useState("")
  const [catFilter, setCat]       = useState("All")
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("category").order("name")
    setSuppliers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (s) => { setEditing(s); setForm({ ...EMPTY, ...s }); setModal(true) }

  const save = async () => {
    setSaving(true)
    if (editing) {
      await supabase.from("suppliers").update(form).eq("id", editing.id)
    } else {
      await supabase.from("suppliers").insert(form)
    }
    setSaving(false)
    setModal(false)
    load()
  }

  const deleteSupplier = async (id) => {
    if (!confirm("Delete this supplier?")) return
    await supabase.from("suppliers").delete().eq("id", id)
    load()
  }

  const field = (k) => ({ value: form[k] || "", onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const filtered = suppliers.filter(s => {
    const ms = `${s.name} ${s.contact_name||""} ${s.email||""}`.toLowerCase().includes(search.toLowerCase())
    return ms && (catFilter === "All" || s.category === catFilter)
  })

  // Group by category for display
  const grouped = {}
  filtered.forEach(s => {
    if (!grouped[s.category]) grouped[s.category] = []
    grouped[s.category].push(s)
  })

  const categoryCounts = {}
  CATEGORIES.forEach(c => { categoryCounts[c] = suppliers.filter(s => s.category === c).length })

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Suppliers"
        subtitle={`${suppliers.length} suppliers in your rolodex`}
        action={<Button onClick={openNew} size="lg"><Plus size={16}/>Add supplier</Button>}
      />

      <StatsBar stats={[
        { label: "Airlines",     value: categoryCounts.airline   || 0, color: "purple" },
        { label: "Cruise lines", value: categoryCounts.cruise    || 0, color: "teal"   },
        { label: "Hotels",       value: categoryCounts.hotel     || 0, color: "blue"   },
        { label: "Rental cars",  value: categoryCounts.transfer  || 0, color: "amber"  },
      ]} />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white" />
        </div>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white text-sm">
          <button onClick={() => setCat("All")}
            className={`px-3 py-2 transition-colors ${catFilter==="All"?"text-white":"text-slate-500 hover:bg-brand-50"}`}
            style={catFilter==="All"?{background:"#8B1A4A"}:{}}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-2 capitalize transition-colors ${catFilter===c?"text-white":"text-slate-500 hover:bg-brand-50"}`}
              style={catFilter===c?{background:"#8B1A4A"}:{}}>
              {c === "transfer" ? "Rental" : c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={Building2} title="No suppliers found"
            subtitle="Add hotels, airlines, cruise lines and more — or run the suppliers preload SQL."
            action={<Button onClick={openNew} size="lg"><Plus size={16}/>Add supplier</Button>} />
        : Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 capitalize flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full inline-block ${
                cat==="airline"?"bg-purple-400":cat==="cruise"?"bg-teal-400":cat==="hotel"?"bg-blue-400":
                cat==="tour"?"bg-green-400":cat==="transfer"?"bg-amber-400":cat==="insurance"?"bg-red-400":"bg-slate-400"
              }`}/>
              {cat === "transfer" ? "Rental cars" : cat + "s"} ({items.length})
            </p>
            <Card>
              <div className="divide-y divide-slate-50">
                {items.map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-start gap-4 hover:bg-brand-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                        <Badge label={s.category === "transfer" ? "rental" : s.category} color={CAT_COLORS[s.category]||"gray"} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {s.phone && (
                          <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors">
                            <Phone size={10}/>{s.phone}
                          </a>
                        )}
                        {s.email && (
                          <a href={`mailto:${s.email}`} className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 transition-colors">
                            <Mail size={10}/>{s.email}
                          </a>
                        )}
                        {s.website && (
                          <a href={s.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-500 transition-colors">
                            <ExternalLink size={10}/>Website
                          </a>
                        )}
                      </div>
                      {s.notes && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.notes}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {s.phone && (
                        <a href={`tel:${s.phone}`}>
                          <Button variant="pink" size="sm"><Phone size={12}/>Call</Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-50" onClick={() => deleteSupplier(s.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))
      }

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit supplier" : "Add supplier"}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name}>{saving ? "Saving..." : "Save supplier"}</Button>
        </>}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Supplier name" {...field("name")} placeholder="Delta Air Lines" />
          <Select label="Category" {...field("category")}>
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Contact name" {...field("contact_name")} placeholder="Travel Agent Desk" />
          <Input label="Phone"        {...field("phone")}        placeholder="1-800-000-0000" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email"   type="email" {...field("email")}   placeholder="agents@supplier.com" />
          <Input label="Website" {...field("website")} placeholder="https://supplier.com" />
        </div>
        <Textarea label="Notes" {...field("notes")} placeholder="Agent portal URL, commission rates, special contacts..." />
      </Modal>
    </div>
  )
}
