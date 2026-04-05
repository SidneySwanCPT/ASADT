import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { FileText, Plus, Search, Upload, ExternalLink, Trash2 } from "lucide-react"
import { Card, PageHeader, Button, Select, Modal, EmptyState, Spinner, Badge } from "../components/UI"

const CATEGORIES = ["passport", "visa", "insurance", "confirmation", "invoice", "other"]

export default function DocumentsPage() {
  const [docs, setDocs]         = useState([])
  const [clients, setClients]   = useState([])
  const [trips, setTrips]       = useState([])
  const [search, setSearch]     = useState("")
  const [catFilter, setCatFilter] = useState("All")
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm]         = useState({ client_id: "", trip_id: "", category: "other", notes: "" })
  const [file, setFile]         = useState(null)

  const load = async () => {
    const [{ data: d }, { data: c }, { data: t }] = await Promise.all([
      supabase.from("documents").select("*, clients(first_name,last_name), trips(destination)").order("uploaded_at", { ascending: false }),
      supabase.from("clients").select("id,first_name,last_name").order("last_name"),
      supabase.from("trips").select("id,destination,client_id"),
    ])
    setDocs(d || [])
    setClients(c || [])
    setTrips(t || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clientTrips = trips.filter(t => t.client_id === form.client_id)

  const upload = async () => {
    if (!file) return
    setUploading(true)

    const ext = file.name.split(".").pop()
    const path = `${form.client_id || "general"}/${Date.now()}.${ext}`

    const { data: stored, error } = await supabase.storage.from("documents").upload(path, file)
    if (error) { alert("Upload failed: " + error.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path)

    await supabase.from("documents").insert({
      client_id: form.client_id || null,
      trip_id:   form.trip_id   || null,
      category:  form.category,
      notes:     form.notes,
      name:      file.name,
      file_type: file.type,
      file_url:  publicUrl,
    })

    setUploading(false)
    setModal(false)
    setFile(null)
    setForm({ client_id: "", trip_id: "", category: "other", notes: "" })
    load()
  }

  const deleteDoc = async (doc) => {
    if (!confirm("Delete this document?")) return
    const path = doc.file_url.split("/documents/")[1]
    await supabase.storage.from("documents").remove([path])
    await supabase.from("documents").delete().eq("id", doc.id)
    load()
  }

  const catColor = { passport: "blue", visa: "purple", insurance: "green", confirmation: "teal", invoice: "amber", other: "gray" }

  const filtered = docs.filter(d => {
    const matchSearch = `${d.name} ${d.clients?.first_name} ${d.clients?.last_name}`.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === "All" || d.category === catFilter
    return matchSearch && matchCat
  })

  if (loading) return <Spinner />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Documents"
        subtitle={`${docs.length} files stored`}
        action={<Button onClick={() => setModal(true)}><Upload size={15} />Upload document</Button>}
      />

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 capitalize">
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={FileText} title="No documents yet" subtitle="Upload passports, insurance, confirmations and more."
            action={<Button onClick={() => setModal(true)}><Upload size={14} />Upload document</Button>} />
        : (
          <Card>
            <div className="divide-y divide-slate-50">
              {filtered.map(doc => (
                <div key={doc.id} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge label={doc.category} color={catColor[doc.category] || "gray"} />
                      {doc.clients && <span className="text-xs text-slate-400">{doc.clients.first_name} {doc.clients.last_name}</span>}
                      {doc.trips && <span className="text-xs text-slate-400">· {doc.trips.destination}</span>}
                      <span className="text-xs text-slate-400">· {format(new Date(doc.uploaded_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <a href={doc.file_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="secondary"><ExternalLink size={12} />View</Button>
                    </a>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-50" onClick={() => deleteDoc(doc)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      }

      <Modal
        open={modal} onClose={() => setModal(false)}
        title="Upload document"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
          <Button onClick={upload} disabled={uploading || !file}>{uploading ? "Uploading..." : "Upload"}</Button>
        </>}
      >
        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-6 cursor-pointer hover:border-brand-300 transition-colors">
            <Upload size={20} className="text-slate-400 mb-2" />
            <span className="text-sm text-slate-500">{file ? file.name : "Click to choose a file"}</span>
            <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Client (optional)"
            value={form.client_id}
            onChange={e => setForm(f => ({ ...f, client_id: e.target.value, trip_id: "" }))}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </Select>
          <Select label="Trip (optional)"
            value={form.trip_id}
            onChange={e => setForm(f => ({ ...f, trip_id: e.target.value }))}>
            <option value="">No trip</option>
            {clientTrips.map(t => <option key={t.id} value={t.id}>{t.destination}</option>)}
          </Select>
        </div>

        <Select label="Category"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </Select>
      </Modal>
    </div>
  )
}
