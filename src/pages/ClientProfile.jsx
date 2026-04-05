import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { ArrowLeft, Globe, CheckSquare, FileText, Mail, Phone, Plus, Trash2, Edit2, Star, AlertTriangle, UserPlus, Sparkles, Download, PhoneCall } from "lucide-react"
import { Card, Button, StatusBadge, OccasionBadge, Spinner, Modal, Input, Select, Textarea, Badge, InfoRow, SectionCard, MissingDataWarning } from "../components/UI"
import AIEmailComposer from "../components/AIEmailComposer"
import AIClientBriefing from "../components/AIClientBriefing"

const RELATIONSHIPS = ["Self","Spouse","Partner","Child","Parent","Sibling","Friend","Other"]
const AIRLINES = ["Delta","Southwest","American","United","Spirit","Frontier","Carnival","Royal Caribbean","Norwegian","MSC","Celebrity","Other"]

function getMissingFields(client) {
  const critical = []
  if (!client.email) critical.push("email")
  if (!client.phone) critical.push("phone")
  if (!client.passport_number) critical.push("passport #")
  if (!client.passport_expiry) critical.push("passport expiry")
  if (!client.date_of_birth) critical.push("date of birth")
  if (!client.emergency_contact_name) critical.push("emergency contact")
  return critical
}

export default function ClientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient]       = useState(null)
  const [trips, setTrips]         = useState([])
  const [tasks, setTasks]         = useState([])
  const [docs, setDocs]           = useState([])
  const [travelers, setTravelers] = useState([])
  const [loyalty, setLoyalty]     = useState([])
  const [allClients, setAllClients] = useState([])
  const [loading, setLoading]     = useState(true)

  const [travelerModal, setTravelerModal] = useState(false)
  const [loyaltyModal, setLoyaltyModal]   = useState(false)
  const [travelerForm, setTravelerForm]   = useState({ full_name:"", date_of_birth:"", relationship:"Self", passport_number:"", passport_expiry:"", notes:"", link_as_client: false, existing_client_id:"" })
  const [loyaltyForm, setLoyaltyForm]     = useState({ airline_or_cruise:"Delta", number:"", traveler_id:"" })
  const [saving, setSaving]               = useState(false)
  const [showEmailAI, setShowEmailAI]     = useState(false)
  const [showBriefing, setShowBriefing]   = useState(false)
  const [selectedTripForEmail, setSelectedTripForEmail] = useState(null)

  const load = async () => {
    const [{ data: c }, { data: t }, { data: tk }, { data: d }, { data: tv }, { data: ly }, { data: ac }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("trips").select("*").eq("client_id", id).order("departure_date", { ascending: false }),
      supabase.from("tasks").select("*").eq("client_id", id).eq("completed", false).order("due_date"),
      supabase.from("documents").select("*").eq("client_id", id).order("uploaded_at", { ascending: false }),
      supabase.from("travelers").select("*").eq("client_id", id).order("created_at"),
      supabase.from("loyalty_numbers").select("*, travelers(full_name)").eq("client_id", id),
      supabase.from("clients").select("id,first_name,last_name").order("last_name"),
    ])
    setClient(c)
    setTrips(t || [])
    setTasks(tk || [])
    setDocs(d || [])
    setTravelers(tv || [])
    setLoyalty(ly || [])
    setAllClients((ac || []).filter(x => x.id !== id))
    setLoading(false)
  }


  const exportPDF = () => {
    const missingFields = getMissingFields(client)
    const upTrips = trips.filter(t => t.departure_date && new Date(t.departure_date) >= new Date() && t.status !== "Cancelled")
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Client Card — ${client.first_name} ${client.last_name}</title>
  <style>
    body { font-family: Georgia, serif; padding: 40px; color: #1a1a2e; max-width: 700px; margin: 0 auto; }
    h1 { color: #8B1A4A; font-size: 26px; margin: 0 0 4px; }
    .sub { color: #9d2558; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }
    .section { margin-bottom: 20px; border-top: 1px solid #F4A7C3; padding-top: 12px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9d2558; font-weight: bold; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .row { font-size: 13px; display: flex; gap: 8px; }
    .label { color: #888; min-width: 130px; flex-shrink: 0; }
    .value { color: #1a1a2e; font-weight: normal; }
    .trip { background: #fdf2f7; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .trip-dest { font-size: 14px; font-weight: bold; color: #8B1A4A; }
    .trip-detail { font-size: 12px; color: #666; margin-top: 2px; }
    .warn { background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #795548; margin-bottom: 16px; }
    .footer { margin-top: 40px; border-top: 2px solid #F4A7C3; padding-top: 12px; text-align: center; color: #9d2558; font-size: 11px; letter-spacing: 1px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${client.first_name} ${client.last_name}</h1>
  <div class="sub">ASA Destination Travel — Client Card</div>
  ${missingFields.length > 0 ? `<div class="warn">⚠ Missing information: ${missingFields.join(", ")}</div>` : ""}
  <div class="section">
    <div class="section-title">Contact</div>
    <div class="grid">
      ${client.email ? `<div class="row"><span class="label">Email</span><span class="value">${client.email}</span></div>` : ""}
      ${client.phone ? `<div class="row"><span class="label">Phone</span><span class="value">${client.phone}</span></div>` : ""}
      ${client.home_airport ? `<div class="row"><span class="label">Home airport</span><span class="value">${client.home_airport}</span></div>` : ""}
      ${client.typical_budget ? `<div class="row"><span class="label">Budget</span><span class="value">${client.typical_budget}</span></div>` : ""}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Passport & Emergency</div>
    <div class="grid">
      ${client.date_of_birth ? `<div class="row"><span class="label">Date of birth</span><span class="value">${new Date(client.date_of_birth).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      ${client.nationality ? `<div class="row"><span class="label">Nationality</span><span class="value">${client.nationality}</span></div>` : ""}
      ${client.passport_number ? `<div class="row"><span class="label">Passport #</span><span class="value">${client.passport_number}</span></div>` : ""}
      ${client.passport_expiry ? `<div class="row"><span class="label">Passport expiry</span><span class="value">${new Date(client.passport_expiry).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span></div>` : ""}
      ${client.emergency_contact_name ? `<div class="row"><span class="label">Emergency contact</span><span class="value">${client.emergency_contact_name}</span></div>` : ""}
      ${client.emergency_contact_phone ? `<div class="row"><span class="label">Emergency phone</span><span class="value">${client.emergency_contact_phone}</span></div>` : ""}
    </div>
  </div>
  <div class="section">
    <div class="section-title">Travel Preferences</div>
    <div class="grid">
      ${client.preferred_airline ? `<div class="row"><span class="label">Preferred airline</span><span class="value">${client.preferred_airline}</span></div>` : ""}
      ${client.preferred_cruise_line ? `<div class="row"><span class="label">Cruise line</span><span class="value">${client.preferred_cruise_line}</span></div>` : ""}
      ${client.preferred_seat ? `<div class="row"><span class="label">Seat preference</span><span class="value">${client.preferred_seat}</span></div>` : ""}
      ${client.preferred_cabin ? `<div class="row"><span class="label">Cabin class</span><span class="value">${client.preferred_cabin}</span></div>` : ""}
      ${client.preferred_hotel_tier ? `<div class="row"><span class="label">Hotel preference</span><span class="value">${client.preferred_hotel_tier}</span></div>` : ""}
      ${client.preferred_transport ? `<div class="row"><span class="label">Transport</span><span class="value">${client.preferred_transport}</span></div>` : ""}
      ${client.dietary_restrictions ? `<div class="row"><span class="label">Dietary</span><span class="value">${client.dietary_restrictions}</span></div>` : ""}
      ${client.special_needs ? `<div class="row"><span class="label">Special needs</span><span class="value">${client.special_needs}</span></div>` : ""}
    </div>
    ${client.preferences ? `<div class="row" style="margin-top:8px"><span class="label">Notes</span><span class="value">${client.preferences}</span></div>` : ""}
  </div>
  ${travelers.length > 0 ? `
  <div class="section">
    <div class="section-title">Travelers (${travelers.length})</div>
    <div class="grid">${travelers.map(t => `<div class="row"><span class="label">${t.relationship||"Traveler"}</span><span class="value">${t.full_name}${t.date_of_birth?" · DOB: "+new Date(t.date_of_birth).toLocaleDateString():""}</span></div>`).join("")}</div>
  </div>` : ""}
  ${loyalty.length > 0 ? `
  <div class="section">
    <div class="section-title">Loyalty Numbers</div>
    <div class="grid">${loyalty.map(l => `<div class="row"><span class="label">${l.airline_or_cruise}</span><span class="value">${l.number}${l.travelers?" ("+l.travelers.full_name+")":""}</span></div>`).join("")}</div>
  </div>` : ""}
  ${upTrips.length > 0 ? `
  <div class="section">
    <div class="section-title">Upcoming Trips</div>
    ${upTrips.map(t => `
    <div class="trip">
      <div class="trip-dest">${t.destination}</div>
      <div class="trip-detail">
        ${t.departure_date ? new Date(t.departure_date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}) : "TBD"}
        ${t.return_date ? " → " + new Date(t.return_date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : ""}
        · ${t.status}
        ${t.occasion ? " · " + t.occasion : ""}
        ${(t.total_price - t.amount_paid) > 0 ? " · Balance due: $" + (t.total_price - t.amount_paid).toLocaleString() : " · Paid in full"}
      </div>
    </div>`).join("")}
  </div>` : ""}
  <div class="footer">ASA DESTINATION TRAVEL · Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
</body>
</html>`
    const w = window.open("","_blank")
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  useEffect(() => { load() }, [id])

  const saveTraveler = async () => {
    setSaving(true)
    if (travelerForm.link_as_client && travelerForm.existing_client_id) {
      // Link existing client as traveler
      const existing = allClients.find(c => c.id === travelerForm.existing_client_id)
      if (existing) {
        await supabase.from("travelers").insert({
          client_id: id,
          full_name: `${existing.first_name} ${existing.last_name}`,
          relationship: travelerForm.relationship,
          notes: `Linked client: ${existing.id}`
        })
      }
    } else if (travelerForm.link_as_client && !travelerForm.existing_client_id) {
      // Create new client AND traveler
      const { data: newClient } = await supabase.from("clients").insert({
        first_name: travelerForm.full_name.split(" ")[0] || travelerForm.full_name,
        last_name:  travelerForm.full_name.split(" ").slice(1).join(" ") || "",
        date_of_birth: travelerForm.date_of_birth || null,
        passport_number: travelerForm.passport_number || null,
        passport_expiry: travelerForm.passport_expiry || null,
        notes: travelerForm.notes || null,
      }).select().single()
      if (newClient) {
        await supabase.from("travelers").insert({
          client_id: id,
          full_name: travelerForm.full_name,
          date_of_birth: travelerForm.date_of_birth || null,
          relationship: travelerForm.relationship,
          passport_number: travelerForm.passport_number || null,
          passport_expiry: travelerForm.passport_expiry || null,
          notes: `Also a client: ${newClient.id}. ${travelerForm.notes || ""}`,
        })
      }
    } else {
      // Just add as traveler
      await supabase.from("travelers").insert({
        client_id: id,
        full_name: travelerForm.full_name,
        date_of_birth: travelerForm.date_of_birth || null,
        relationship: travelerForm.relationship,
        passport_number: travelerForm.passport_number || null,
        passport_expiry: travelerForm.passport_expiry || null,
        notes: travelerForm.notes || null,
      })
    }
    setSaving(false)
    setTravelerModal(false)
    setTravelerForm({ full_name:"", date_of_birth:"", relationship:"Self", passport_number:"", passport_expiry:"", notes:"", link_as_client: false, existing_client_id:"" })
    load()
  }

  const saveLoyalty = async () => {
    setSaving(true)
    await supabase.from("loyalty_numbers").insert({ ...loyaltyForm, client_id: id, traveler_id: loyaltyForm.traveler_id || null })
    setSaving(false)
    setLoyaltyModal(false)
    setLoyaltyForm({ airline_or_cruise:"Delta", number:"", traveler_id:"" })
    load()
  }

  const deleteTraveler = async (tid) => {
    if (!confirm("Remove this traveler?")) return
    await supabase.from("travelers").delete().eq("id", tid)
    load()
  }

  const deleteLoyalty = async (lid) => {
    await supabase.from("loyalty_numbers").delete().eq("id", lid)
    load()
  }

  const completeTask = async (taskId) => {
    await supabase.from("tasks").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", taskId)
    setTasks(t => t.filter(x => x.id !== taskId))
  }

  const tf = (k) => ({ value: travelerForm[k] || "", onChange: e => setTravelerForm(f => ({ ...f, [k]: e.target.value })) })
  const lf = (k) => ({ value: loyaltyForm[k]  || "", onChange: e => setLoyaltyForm(f => ({  ...f, [k]: e.target.value })) })

  if (loading) return <Spinner />
  if (!client) return <div className="p-6 text-slate-500">Client not found.</div>

  const missing = getMissingFields(client)
  const upcomingTrips = trips.filter(t => t.departure_date && new Date(t.departure_date) >= new Date() && t.status !== "Cancelled")
  const pastTrips     = trips.filter(t => !t.departure_date || new Date(t.departure_date) < new Date() || t.status === "Completed")

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/clients")} className="text-slate-400 hover:text-brand-500 transition-colors p-1 rounded-lg hover:bg-brand-50">
          <ArrowLeft size={18} />
        </button>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
          {client.first_name?.[0]}{client.last_name?.[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800" style={{fontFamily:"Georgia,serif"}}>{client.first_name} {client.last_name}</h1>
            {missing.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10} />{missing.length} missing
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {client.email && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail size={10}/>{client.email}</span>}
            {client.phone && <span className="flex items-center gap-1 text-xs text-slate-400"><Phone size={10}/>{client.phone}</span>}
            {client.home_airport && <span className="text-xs text-brand-500 font-medium">{client.home_airport}</span>}
            {client.typical_budget && <span className="text-xs text-slate-400">Budget: {client.typical_budget}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowBriefing(true)} className="text-purple-600 hover:bg-purple-50">
            <PhoneCall size={12}/>Pre-call briefing
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setSelectedTripForEmail(upcomingTrips[0]||null); setShowEmailAI(true) }} className="text-brand-600 hover:bg-brand-50">
            <Sparkles size={12}/>Draft email
          </Button>
          <Button variant="ghost" size="sm" onClick={exportPDF} className="text-slate-600 hover:bg-slate-50">
            <Download size={12}/>Client card
          </Button>
          <Link to="/clients"><Button variant="secondary" size="sm"><Edit2 size={12}/>Edit</Button></Link>
        </div>
      </div>

      {/* Missing data warning */}
      {missing.length > 0 && <MissingDataWarning fields={missing} />}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="space-y-4">

          {/* Profile */}
          <SectionCard title="Profile">
            <div className="px-4 py-2">
              <InfoRow label="Date of birth"   value={client.date_of_birth ? format(new Date(client.date_of_birth), "MMM d, yyyy") : null} />
              <InfoRow label="Nationality"     value={client.nationality} />
              <InfoRow label="Passport no."    value={client.passport_number} />
              <InfoRow label="Passport expiry" value={client.passport_expiry ? format(new Date(client.passport_expiry), "MMM d, yyyy") : null} />
              <InfoRow label="Emergency"       value={client.emergency_contact_name} />
              <InfoRow label="Emerg. phone"    value={client.emergency_contact_phone} />
              <InfoRow label="Referral"        value={client.referral_source} />
            </div>
          </SectionCard>

          {/* Travel preferences */}
          <SectionCard title="Travel preferences">
            <div className="px-4 py-2">
              <InfoRow label="Airline"       value={client.preferred_airline} />
              <InfoRow label="Cruise line"   value={client.preferred_cruise_line} />
              <InfoRow label="Seat"          value={client.preferred_seat} />
              <InfoRow label="Cabin"         value={client.preferred_cabin} />
              <InfoRow label="Hotel"         value={client.preferred_hotel_tier} />
              <InfoRow label="Transport"     value={client.preferred_transport} />
              <InfoRow label="Rental car"    value={client.preferred_rental_car} />
              <InfoRow label="Home airport"  value={client.home_airport} />
              <InfoRow label="Budget"        value={client.typical_budget} />
              <InfoRow label="Dietary"       value={client.dietary_restrictions} />
              <InfoRow label="Special needs" value={client.special_needs} />
              {client.preferences && (
                <div className="py-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">General notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{client.preferences}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Notes */}
          {client.notes && (
            <SectionCard title="Notes">
              <p className="text-sm text-slate-700 leading-relaxed px-4 py-3">{client.notes}</p>
            </SectionCard>
          )}

          {/* Loyalty numbers */}
          <SectionCard title="Loyalty numbers"
            action={<button onClick={() => setLoyaltyModal(true)} className="text-brand-500 hover:text-brand-700 transition-colors"><Plus size={14}/></button>}>
            <div className="px-4 py-2">
              {loyalty.length === 0
                ? <p className="text-xs text-slate-400 py-2 text-center">No loyalty numbers yet</p>
                : loyalty.map(l => (
                  <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{l.airline_or_cruise}</p>
                      <p className="text-xs text-slate-400 font-mono">{l.number}</p>
                      {l.travelers && <p className="text-xs text-brand-400">{l.travelers.full_name}</p>}
                    </div>
                    <button onClick={() => deleteLoyalty(l.id)} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={12}/></button>
                  </div>
                ))
              }
            </div>
          </SectionCard>
        </div>

        {/* Right col */}
        <div className="lg:col-span-2 space-y-4">

          {/* Travelers */}
          <SectionCard title={`Travelers (${travelers.length})`}
            action={<Button size="sm" variant="pink" onClick={() => setTravelerModal(true)}><UserPlus size={12}/>Add traveler</Button>}>
            <div className="divide-y divide-slate-50">
              {travelers.length === 0
                ? <p className="text-sm text-slate-400 px-4 py-4 text-center">No travelers added yet. Add family members or frequent travel companions.</p>
                : travelers.map(tv => (
                  <div key={tv.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0">
                      {tv.full_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{tv.full_name}</p>
                        {tv.relationship && <Badge label={tv.relationship} color="pink" />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {tv.date_of_birth && <span className="text-xs text-slate-400">DOB: {format(new Date(tv.date_of_birth), "MMM d, yyyy")}</span>}
                        {tv.passport_number && <span className="text-xs text-slate-400">PP: {tv.passport_number}</span>}
                        {tv.passport_expiry && <span className="text-xs text-slate-400">Exp: {format(new Date(tv.passport_expiry), "MMM d, yyyy")}</span>}
                      </div>
                      {tv.notes && tv.notes.includes("Also a client:") && (
                        <span className="text-xs text-green-600 font-medium">✓ Full client record</span>
                      )}
                      {tv.notes && tv.notes.includes("Linked client:") && (
                        <span className="text-xs text-blue-600 font-medium">↗ Linked to existing client</span>
                      )}
                    </div>
                    <button onClick={() => deleteTraveler(tv.id)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"><Trash2 size={14}/></button>
                  </div>
                ))
              }
            </div>
          </SectionCard>

          {/* Upcoming trips */}
          <SectionCard title={`Upcoming trips (${upcomingTrips.length})`}
            action={<Link to="/trips"><Button size="sm" variant="pink"><Plus size={12}/>New trip</Button></Link>}>
            <div className="divide-y divide-slate-50">
              {upcomingTrips.length === 0
                ? <p className="text-sm text-slate-400 px-4 py-4 text-center">No upcoming trips.</p>
                : upcomingTrips.map(t => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-brand-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{t.destination}</p>
                        {t.occasion && <OccasionBadge occasion={t.occasion} />}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {t.departure_date ? format(new Date(t.departure_date), "MMM d") : "TBD"}
                        {t.return_date ? ` → ${format(new Date(t.return_date), "MMM d, yyyy")}` : ""}
                        {t.confirmation_number ? ` · ${t.confirmation_number}` : ""}
                        {t.group_name ? ` · ${t.group_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-green-600">${parseFloat(t.amount_paid||0).toLocaleString()} paid</p>
                        {(parseFloat(t.total_price||0) - parseFloat(t.amount_paid||0)) > 0 && (
                          <p className="text-xs text-red-500">${(parseFloat(t.total_price||0) - parseFloat(t.amount_paid||0)).toLocaleString()} due</p>
                        )}
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                ))
              }
            </div>
          </SectionCard>

          {/* Past trips */}
          {pastTrips.length > 0 && (
            <SectionCard title={`Past trips (${pastTrips.length})`}>
              <div className="divide-y divide-slate-50">
                {pastTrips.map(t => (
                  <div key={t.id} className="px-4 py-2.5 flex items-center justify-between opacity-75">
                    <div>
                      <p className="text-sm text-slate-700">{t.destination}</p>
                      <p className="text-xs text-slate-400">
                        {t.departure_date ? format(new Date(t.departure_date), "MMM d, yyyy") : "—"}
                        {t.occasion ? ` · ${t.occasion}` : ""}
                        {t.notes ? ` · ${t.notes}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Open tasks */}
          {tasks.length > 0 && (
            <SectionCard title="Open tasks"
              action={<Link to="/tasks"><Button size="sm" variant="pink"><Plus size={12}/>Add task</Button></Link>}>
              <div className="divide-y divide-slate-50">
                {tasks.map(task => (
                  <div key={task.id} className="px-4 py-2.5 flex items-center gap-3">
                    <button onClick={() => completeTask(task.id)}
                      className="w-4 h-4 rounded border border-slate-300 hover:border-brand-400 flex-shrink-0 transition-colors" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-800">{task.title}</p>
                      {task.due_date && <p className="text-xs text-slate-400">Due {format(new Date(task.due_date), "MMM d, yyyy")}</p>}
                    </div>
                    <StatusBadge status={task.priority} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Documents */}
          {docs.length > 0 && (
            <SectionCard title={`Documents (${docs.length})`}
              action={<Link to="/documents"><Button size="sm" variant="pink"><Plus size={12}/>Upload</Button></Link>}>
              <div className="divide-y divide-slate-50">
                {docs.map(doc => (
                  <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-800">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.category} · {format(new Date(doc.uploaded_at), "MMM d, yyyy")}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="secondary">View</Button>
                    </a>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* AI Email Composer */}
      {showEmailAI && (
        <AIEmailComposer
          client={client}
          trip={selectedTripForEmail}
          onClose={() => setShowEmailAI(false)}
        />
      )}

      {/* AI Client Briefing */}
      {showBriefing && (
        <AIClientBriefing
          client={client}
          trips={trips}
          tasks={tasks}
          travelers={travelers}
          loyalty={loyalty}
          onClose={() => setShowBriefing(false)}
        />
      )}

      {/* Add Traveler Modal */}
      <Modal open={travelerModal} onClose={() => setTravelerModal(false)} title="Add traveler" wide
        footer={<>
          <Button variant="secondary" onClick={() => setTravelerModal(false)}>Cancel</Button>
          <Button onClick={saveTraveler} disabled={saving || (!travelerForm.full_name && !travelerForm.existing_client_id)}>
            {saving ? "Saving..." : "Add traveler"}
          </Button>
        </>}>

        {/* Option selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
          {[
            ["just_traveler", "Traveler only"],
            ["existing_client", "Link existing client"],
            ["new_client", "Create new client too"],
          ].map(([val, label]) => (
            <button key={val}
              onClick={() => setTravelerForm(f => ({ ...f, link_as_client: val !== "just_traveler", existing_client_id: val !== "existing_client" ? "" : f.existing_client_id, _mode: val }))}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                (travelerForm._mode || "just_traveler") === val ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {(travelerForm._mode || "just_traveler") === "existing_client" ? (
          <>
            <Select label="Select existing client" {...tf("existing_client_id")}>
              <option value="">Choose a client...</option>
              {allClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </Select>
            <Select label="Relationship" {...tf("relationship")}>
              {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
            </Select>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full name" {...tf("full_name")} placeholder="Jane Smith" className="col-span-2" />
              <Select label="Relationship" {...tf("relationship")}>
                {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
              </Select>
              <Input label="Date of birth" type="date" {...tf("date_of_birth")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Passport number"  {...tf("passport_number")}  placeholder="A12345678" />
              <Input label="Passport expiry"  type="date" {...tf("passport_expiry")} />
            </div>
            <Textarea label="Notes" {...tf("notes")} placeholder="Any notes about this traveler..." />
            {(travelerForm._mode || "just_traveler") === "new_client" && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                A full client record will be created for this person so they can be managed independently as well.
              </p>
            )}
          </>
        )}
      </Modal>

      {/* Add Loyalty Number Modal */}
      <Modal open={loyaltyModal} onClose={() => setLoyaltyModal(false)} title="Add loyalty number"
        footer={<>
          <Button variant="secondary" onClick={() => setLoyaltyModal(false)}>Cancel</Button>
          <Button onClick={saveLoyalty} disabled={saving || !loyaltyForm.number}>{saving ? "Saving..." : "Add"}</Button>
        </>}>
        <Select label="Airline or cruise line" {...lf("airline_or_cruise")}>
          {AIRLINES.map(a => <option key={a}>{a}</option>)}
        </Select>
        <Input label="Loyalty number" {...lf("number")} placeholder="Member number..." />
        <Select label="Linked traveler (optional)" {...lf("traveler_id")}>
          <option value="">Account-level — not traveler specific</option>
          {travelers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
      </Modal>
    </div>
  )
}
