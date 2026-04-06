import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { format } from "date-fns"
import { ArrowLeft, Mail, Phone, Plus, Trash2, AlertTriangle, UserPlus, Sparkles, Phone as PhoneIcon, Printer, Globe, X, ExternalLink } from "lucide-react"
import { Button, StatusBadge, OccasionBadge, Spinner, Modal, Input, Select, Textarea, Badge, InfoRow, SectionCard, MissingDataWarning } from "../components/UI"
import AIEmailComposer from "../components/AIEmailComposer"
import AIClientBriefing from "../components/AIClientBriefing"
import { generateClientCard } from "../lib/clientCard"

const RELATIONSHIPS = ["Self","Spouse","Partner","Child","Parent","Sibling","Friend","Other"]
const AIRLINES      = ["Delta","Southwest","American","United","Spirit","Frontier","Carnival","Royal Caribbean","Norwegian","MSC","Celebrity","Other"]
const STATUSES      = ["Quoted","Confirmed","Paid","Departed","Completed","Cancelled"]
const OCCASIONS     = ["","Birthday","Anniversary","Honeymoon","Girls Trip","Business","Family","Group","Other"]
const PAY_STATUSES  = ["Pending","Deposit Paid","Paid in Full","Overdue","Cancelled"]
const EMPTY_TRIP    = { destination:"", departure_date:"", return_date:"", status:"Quoted", total_price:"", amount_paid:"0", booking_ref:"", confirmation_number:"", traveler_count:"1", occasion:"", credit_balance:"0", credit_notes:"", group_name:"", notes:"" }

function getMissingFields(c) {
  const m = []
  if (!c.email)                  m.push("email")
  if (!c.phone)                  m.push("phone")
  if (!c.passport_number)        m.push("passport #")
  if (!c.passport_expiry)        m.push("passport expiry")
  if (!c.date_of_birth)          m.push("date of birth")
  if (!c.emergency_contact_name) m.push("emergency contact")
  return m
}

export default function ClientProfile() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient]           = useState(null)
  const [trips, setTrips]             = useState([])
  const [allTrips, setAllTrips]       = useState([]) // for add-to-trip dropdown
  const [tasks, setTasks]             = useState([])
  const [travelers, setTravelers]     = useState([])
  const [loyalty, setLoyalty]         = useState([])
  const [allClients, setAllClients]   = useState([])
  const [coByTrip, setCoByTrip]       = useState({})
  const [loading, setLoading]         = useState(true)

  // Modals
  const [travelerModal, setTravelerModal]   = useState(false)
  const [loyaltyModal, setLoyaltyModal]     = useState(false)
  const [emailModal, setEmailModal]         = useState(false)
  const [briefingOpen, setBriefingOpen]     = useState(false)
  const [bookTripModal, setBookTripModal]   = useState(false)
  const [addToTripModal, setAddToTripModal] = useState(false)
  const [selectedTrip, setSelectedTrip]     = useState(null)

  // Traveler quick-view popup
  const [travelerPopup, setTravelerPopup]   = useState(null) // the traveler object
  const [travelerClient, setTravelerClient] = useState(null) // matching client record if exists

  const [travelerForm, setTravelerForm] = useState({ full_name:"", date_of_birth:"", relationship:"Self", passport_number:"", passport_expiry:"", notes:"", _mode:"just_traveler", existing_client_id:"", is_minor: false })
  const [loyaltyForm, setLoyaltyForm]   = useState({ airline_or_cruise:"Delta", number:"", traveler_id:"" })
  const [tripForm, setTripForm]         = useState({ ...EMPTY_TRIP })
  const [addToTripForm, setAddToTripForm] = useState({ trip_id:"", role:"Member", amount_owed:"", confirmation_number:"" })
  const [saving, setSaving]             = useState(false)

  const load = async () => {
    const [{ data: c }, { data: t }, { data: at }, { data: tk }, { data: tv }, { data: ly }, { data: ac }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("trips").select("*").eq("client_id", id).order("departure_date", { ascending: false }),
      supabase.from("trips").select("id,destination,departure_date,status,group_id,group_name,client_id").order("departure_date", { ascending: false }),
      supabase.from("tasks").select("*").eq("client_id", id).eq("completed", false).order("due_date"),
      supabase.from("travelers").select("*").eq("client_id", id).order("created_at"),
      supabase.from("loyalty_numbers").select("*, travelers(full_name)").eq("client_id", id),
      supabase.from("clients").select("id,first_name,last_name").order("last_name"),
    ])

    setClient(c)
    setTrips(t || [])
    setAllTrips(at || [])
    setTasks(tk || [])
    setTravelers(tv || [])
    setLoyalty(ly || [])
    setAllClients((ac || []).filter(x => x.id !== id))

    // Load co-travelers
    if (t && t.length > 0) {
      const tripIds = t.map(tr => tr.id)
      const { data: groups } = await supabase.from("groups").select("id,name,trip_id").in("trip_id", tripIds)
      if (groups && groups.length > 0) {
        const groupIds = groups.map(g => g.id)
        const { data: members } = await supabase
          .from("group_members")
          .select("*, clients(id,first_name,last_name,email,phone), travelers(full_name)")
          .in("group_id", groupIds)
          .eq("removed", false)
          .neq("client_id", id)

        const cbt = {}
        ;(members || []).forEach(m => {
          const group = groups.find(g => g.id === m.group_id)
          const trip  = (t || []).find(tr => tr.id === group?.trip_id)
          const key   = group?.trip_id
          if (!key) return
          if (!cbt[key]) cbt[key] = { tripName: trip?.destination || group?.name, tripId: key, members: [] }
          cbt[key].members.push(m)
        })
        setCoByTrip(cbt)
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Open traveler popup and try to find matching client record
  const openTravelerPopup = async (tv) => {
    setTravelerPopup(tv)
    // Check if this traveler has a linked client record
    if (tv.notes?.includes("Also a client:")) {
      const clientId = tv.notes.match(/Also a client: ([a-z0-9-]+)/)?.[1]
      if (clientId) {
        const { data } = await supabase.from("clients").select("id,first_name,last_name,email,phone").eq("id", clientId).single()
        setTravelerClient(data)
      }
    } else if (tv.notes?.includes("Linked client:")) {
      const clientId = tv.notes.match(/Linked client: ([a-z0-9-]+)/)?.[1]
      if (clientId) {
        const { data } = await supabase.from("clients").select("id,first_name,last_name,email,phone").eq("id", clientId).single()
        setTravelerClient(data)
      }
    } else {
      // Try to find by name match
      const nameParts = tv.full_name.split(" ")
      const { data } = await supabase.from("clients")
        .select("id,first_name,last_name,email,phone")
        .ilike("first_name", `${nameParts[0]}%`)
        .ilike("last_name", `${nameParts.slice(1).join(" ")||"%"}`)
        .single()
      setTravelerClient(data || null)
    }
  }

  const saveTraveler = async () => {
    setSaving(true)
    const mode = travelerForm._mode || "just_traveler"
    if (mode === "existing_client" && travelerForm.existing_client_id) {
      const ex = allClients.find(c => c.id === travelerForm.existing_client_id)
      if (ex) await supabase.from("travelers").insert({ client_id: id, full_name: `${ex.first_name} ${ex.last_name}`, relationship: travelerForm.relationship, notes: `Linked client: ${ex.id}` })
    } else if (mode === "new_client") {
      const parts = travelerForm.full_name.split(" ")
      const { data: nc } = await supabase.from("clients").insert({ first_name: parts[0]||travelerForm.full_name, last_name: parts.slice(1).join(" ")||"", date_of_birth: travelerForm.date_of_birth||null, passport_number: travelerForm.passport_number||null, passport_expiry: travelerForm.passport_expiry||null, is_minor: travelerForm.is_minor||false }).select().single()
      if (nc) await supabase.from("travelers").insert({ client_id: id, full_name: travelerForm.full_name, date_of_birth: travelerForm.date_of_birth||null, relationship: travelerForm.relationship, passport_number: travelerForm.passport_number||null, passport_expiry: travelerForm.passport_expiry||null, notes: `Also a client: ${nc.id}.`, is_minor: travelerForm.is_minor||false })
    } else {
      await supabase.from("travelers").insert({ client_id: id, full_name: travelerForm.full_name, date_of_birth: travelerForm.date_of_birth||null, relationship: travelerForm.relationship, passport_number: travelerForm.passport_number||null, passport_expiry: travelerForm.passport_expiry||null, notes: travelerForm.notes||null, is_minor: travelerForm.is_minor||false })
    }
    setSaving(false); setTravelerModal(false)
    setTravelerForm({ full_name:"", date_of_birth:"", relationship:"Self", passport_number:"", passport_expiry:"", notes:"", _mode:"just_traveler", existing_client_id:"", is_minor: false })
    load()
  }

  const saveLoyalty = async () => {
    setSaving(true)
    await supabase.from("loyalty_numbers").insert({ ...loyaltyForm, client_id: id, traveler_id: loyaltyForm.traveler_id||null })
    setSaving(false); setLoyaltyModal(false)
    setLoyaltyForm({ airline_or_cruise:"Delta", number:"", traveler_id:"" })
    load()
  }

  const saveTrip = async () => {
    setSaving(true)
    const payload = { ...tripForm, client_id: id, total_price: parseFloat(tripForm.total_price)||0, amount_paid: parseFloat(tripForm.amount_paid)||0, credit_balance: parseFloat(tripForm.credit_balance)||0, occasion: tripForm.occasion||null }
    const { data: newTrip } = await supabase.from("trips").insert(payload).select().single()
    if (tripForm.group_name && newTrip) {
      const { data: grp } = await supabase.from("groups").insert({ name: tripForm.group_name, trip_id: newTrip.id, lead_client_id: id, status: "Active" }).select().single()
      if (grp) await supabase.from("trips").update({ group_id: grp.id }).eq("id", newTrip.id)
    }
    setSaving(false); setBookTripModal(false)
    setTripForm({ ...EMPTY_TRIP }); load()
  }

  const addToExistingTrip = async () => {
    setSaving(true)
    const trip = allTrips.find(t => t.id === addToTripForm.trip_id)
    if (!trip) { setSaving(false); return }

    // Ensure group exists
    let groupId = trip.group_id
    if (!groupId) {
      const { data: grp } = await supabase.from("groups").insert({
        name: trip.group_name || trip.destination,
        trip_id: trip.id, lead_client_id: trip.client_id||null, status: "Active"
      }).select().single()
      if (grp) {
        groupId = grp.id
        await supabase.from("trips").update({ group_id: grp.id }).eq("id", trip.id)
      }
    }

    if (groupId) {
      await supabase.from("group_members").insert({
        group_id: groupId,
        client_id: id,
        role: addToTripForm.role || "Member",
        amount_owed: parseFloat(addToTripForm.amount_owed)||0,
        confirmation_number: addToTripForm.confirmation_number||null,
        payment_status: "Pending",
      })
    }
    setSaving(false); setAddToTripModal(false)
    setAddToTripForm({ trip_id:"", role:"Member", amount_owed:"", confirmation_number:"" })
    load()
  }

  const deleteTraveler = async (tid) => {
    if (!confirm("Remove this traveler?")) return
    await supabase.from("travelers").delete().eq("id", tid); load()
  }

  const deleteLoyalty = async (lid) => {
    await supabase.from("loyalty_numbers").delete().eq("id", lid); load()
  }

  const completeTask = async (taskId) => {
    await supabase.from("tasks").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", taskId)
    setTasks(t => t.filter(x => x.id !== taskId))
  }

  const tf = (k) => ({ value: travelerForm[k]||"", onChange: e => setTravelerForm(f => ({ ...f, [k]: e.target.value })) })
  const lf = (k) => ({ value: loyaltyForm[k] ||"", onChange: e => setLoyaltyForm(f =>  ({ ...f, [k]: e.target.value })) })
  const bf = (k) => ({ value: tripForm[k]    ??"", onChange: e => setTripForm(f =>     ({ ...f, [k]: e.target.value })) })
  const af = (k) => ({ value: addToTripForm[k]||"", onChange: e => setAddToTripForm(f => ({ ...f, [k]: e.target.value })) })

  if (loading) return <Spinner />
  if (!client) return <div className="p-6 text-slate-500">Client not found.</div>

  const missing       = getMissingFields(client)
  const upcomingTrips = trips.filter(t => t.departure_date && new Date(t.departure_date) >= new Date() && t.status !== "Cancelled")
  const pastTrips     = trips.filter(t => !upcomingTrips.includes(t))
  // Trips this client is NOT already on — for add-to-trip
  const otherTrips    = allTrips.filter(t => t.client_id !== id)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/clients")} className="text-slate-400 hover:text-brand-500 p-1 rounded-lg hover:bg-brand-50 transition-colors">
          <ArrowLeft size={18}/>
        </button>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>
          {client.first_name?.[0]}{client.last_name?.[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800" style={{fontFamily:"Georgia,serif"}}>{client.first_name} {client.last_name}</h1>
            {missing.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={10}/>{missing.length} missing
              </span>
            )}
            {client.is_minor && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Minor</span>}
            {client.referral_source === "Vacation Package" && <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Vacation Package</span>}
          </div>
          <div className="flex items-center gap-4 mt-0.5 flex-wrap">
            {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"><Mail size={13}/>{client.email}</a>}
            {client.phone && <a href={`tel:${client.phone}`}   className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"><Phone size={13}/>{client.phone}</a>}
            {client.home_airport && <span className="text-xs text-brand-500 font-medium bg-brand-50 px-2 py-0.5 rounded-full">{client.home_airport}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <Button variant="primary"   size="sm" onClick={() => setBookTripModal(true)}><Globe size={12}/>Book trip</Button>
          <Button variant="secondary" size="sm" onClick={() => setAddToTripModal(true)}><Plus size={12}/>Add to trip</Button>
          <Button variant="secondary" size="sm" onClick={() => setBriefingOpen(true)}><PhoneIcon size={12}/>Prep for call</Button>
          <Button variant="pink"      size="sm" onClick={() => { setSelectedTrip(null); setEmailModal(true) }}><Sparkles size={12}/>Draft email</Button>
          <Button variant="secondary" size="sm" onClick={() => generateClientCard(client, trips, travelers, loyalty)}><Printer size={12}/>Client card</Button>
        </div>
      </div>

      {missing.length > 0 && <MissingDataWarning fields={missing} />}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="space-y-4">
          <SectionCard title="Profile">
            <div className="px-4 py-2">
              <InfoRow label="Date of birth"   value={client.date_of_birth ? format(new Date(client.date_of_birth),"MMM d, yyyy") : null} />
              <InfoRow label="Nationality"     value={client.nationality} />
              <InfoRow label="Passport no."    value={client.passport_number} />
              <InfoRow label="Passport expiry" value={client.passport_expiry ? format(new Date(client.passport_expiry),"MMM d, yyyy") : null} />
              <InfoRow label="Emergency"       value={client.emergency_contact_name} />
              <InfoRow label="Emerg. phone"    value={client.emergency_contact_phone} />
              <InfoRow label="Referral"        value={client.referral_source} />
              {client.is_minor && (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-xs text-slate-400 w-36 flex-shrink-0 uppercase tracking-wide">Status</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Minor (under 18)</span>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Travel preferences">
            <div className="px-4 py-2">
              <InfoRow label="Airline"       value={client.preferred_airline} />
              <InfoRow label="Cruise line"   value={client.preferred_cruise_line} />
              <InfoRow label="Seat"          value={client.preferred_seat} />
              <InfoRow label="Cabin"         value={client.preferred_cabin} />
              <InfoRow label="Hotel"         value={client.preferred_hotel_tier} />
              <InfoRow label="Transport"     value={client.preferred_transport} />
              <InfoRow label="Home airport"  value={client.home_airport} />
              <InfoRow label="Budget"        value={client.typical_budget} />
              <InfoRow label="Dietary"       value={client.dietary_restrictions} />
              <InfoRow label="Special needs" value={client.special_needs} />
              {client.preferences && (
                <div className="py-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{client.preferences}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {client.notes && (
            <SectionCard title="Notes">
              <p className="text-sm text-slate-700 leading-relaxed px-4 py-3">{client.notes}</p>
            </SectionCard>
          )}

          <SectionCard title="Loyalty numbers"
            action={<button onClick={() => setLoyaltyModal(true)} className="text-brand-500 hover:text-brand-700"><Plus size={14}/></button>}>
            <div className="px-4 py-2">
              {loyalty.length === 0
                ? <p className="text-xs text-slate-400 py-2 text-center">No loyalty numbers yet</p>
                : loyalty.map(l => (
                  <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{l.airline_or_cruise}</p>
                      <p className="text-xs text-slate-400 font-mono">{l.number || "—"}</p>
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

          {/* Travelers — clickable */}
          <SectionCard title={`Travelers (${travelers.length})`}
            action={<Button size="sm" variant="pink" onClick={() => setTravelerModal(true)}><UserPlus size={12}/>Add traveler</Button>}>
            <div className="divide-y divide-slate-50">
              {travelers.length === 0
                ? <p className="text-sm text-slate-400 px-4 py-4 text-center">No travelers added yet.</p>
                : travelers.map(tv => (
                  <div key={tv.id}
                    onClick={() => openTravelerPopup(tv)}
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-brand-50 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0">
                      {tv.full_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800 group-hover:text-brand-600 transition-colors">{tv.full_name}</p>
                        {tv.relationship && <Badge label={tv.relationship} color="pink" />}
                        {tv.is_minor && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Minor</span>}
                        {(tv.notes?.includes("Also a client:") || tv.notes?.includes("Linked client:")) && (
                          <span className="text-xs text-green-600 font-medium">✓ Has profile</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {tv.date_of_birth && <span className="text-xs text-slate-400">DOB: {format(new Date(tv.date_of_birth),"MMM d, yyyy")}</span>}
                        {tv.passport_number && <span className="text-xs text-slate-400">PP: {tv.passport_number}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                      <button onClick={() => deleteTraveler(tv.id)} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))
              }
            </div>
          </SectionCard>

          {/* Travel companions */}
          {Object.values(coByTrip).length > 0 && (
            <SectionCard title="Travel companions">
              <div className="divide-y divide-slate-50">
                {Object.values(coByTrip).map(group => (
                  <div key={group.tripId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-brand-600 flex items-center gap-1.5">
                        <Globe size={11}/>{group.tripName}
                      </p>
                      <Link to={`/trips/${group.tripId}/manifest`}
                        className="text-xs text-brand-400 hover:text-brand-600 font-medium transition-colors">
                        View manifest →
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.members.map((m, i) => {
                        const name     = m.clients ? `${m.clients.first_name} ${m.clients.last_name}` : m.travelers?.full_name || "Unknown"
                        const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()
                        const payColor = m.payment_status === "Paid in Full" ? "green" : m.payment_status === "Pending" ? "gray" : "amber"
                        return (
                          <div key={i} className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-1.5">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:"#8B1A4A"}}>{initials}</div>
                            {m.clients
                              ? <Link to={`/clients/${m.clients.id}`} className="text-xs font-medium text-brand-700 hover:text-brand-900 transition-colors">{name}</Link>
                              : <span className="text-xs font-medium text-brand-700">{name}</span>
                            }
                            <Badge label={m.payment_status||"Pending"} color={payColor} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Upcoming trips — clickable */}
          <SectionCard title={`Upcoming trips (${upcomingTrips.length})`}
            action={<Button size="sm" variant="pink" onClick={() => setBookTripModal(true)}><Plus size={12}/>New trip</Button>}>
            <div className="divide-y divide-slate-50">
              {upcomingTrips.length === 0
                ? <p className="text-sm text-slate-400 px-4 py-4 text-center">No upcoming trips.</p>
                : upcomingTrips.map(t => (
                  <Link key={t.id} to="/trips" state={{ openTripId: t.id }}
                    className="block px-4 py-3 hover:bg-brand-50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{t.destination}</p>
                          {t.occasion && <OccasionBadge occasion={t.occasion} />}
                          {t.group_name && <Badge label={t.group_name} color="purple" />}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.departure_date ? format(new Date(t.departure_date),"MMM d") : "TBD"}
                          {t.return_date ? ` → ${format(new Date(t.return_date),"MMM d, yyyy")}` : ""}
                          {t.confirmation_number ? ` · ${t.confirmation_number}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedTrip(t); setEmailModal(true) }}
                          className="text-xs text-brand-400 hover:text-brand-600 flex items-center gap-1 transition-colors">
                          <Sparkles size={11}/>Email
                        </button>
                        <div className="text-right">
                          <p className="text-xs text-green-600">${parseFloat(t.amount_paid||0).toLocaleString()} paid</p>
                          {(parseFloat(t.total_price||0)-parseFloat(t.amount_paid||0)) > 0 && (
                            <p className="text-xs text-red-500">${(parseFloat(t.total_price||0)-parseFloat(t.amount_paid||0)).toLocaleString()} due</p>
                          )}
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                  </Link>
                ))
              }
            </div>
          </SectionCard>

          {/* Past trips — clickable */}
          {pastTrips.length > 0 && (
            <SectionCard title={`Past trips (${pastTrips.length})`}>
              <div className="divide-y divide-slate-50">
                {pastTrips.map(t => (
                  <Link key={t.id} to="/trips" state={{ openTripId: t.id }}
                    className="flex items-center justify-between px-4 py-2.5 opacity-75 hover:opacity-100 hover:bg-brand-50 transition-all cursor-pointer">
                    <div>
                      <p className="text-sm text-slate-700">{t.destination}</p>
                      <p className="text-xs text-slate-400">
                        {t.departure_date ? format(new Date(t.departure_date),"MMM d, yyyy") : "—"}
                        {t.occasion ? ` · ${t.occasion}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
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
                      {task.due_date && <p className="text-xs text-slate-400">Due {format(new Date(task.due_date),"MMM d, yyyy")}</p>}
                    </div>
                    <StatusBadge status={task.priority} />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── TRAVELER QUICK-VIEW POPUP ── */}
      {travelerPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setTravelerPopup(null); setTravelerClient(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{background:"#8B1A4A"}}>
              <div>
                <h2 className="text-base font-bold text-white">{travelerPopup.full_name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {travelerPopup.relationship && <Badge label={travelerPopup.relationship} color="pink" />}
                  {travelerPopup.is_minor && <span className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-medium">Minor</span>}
                </div>
              </div>
              <button onClick={() => { setTravelerPopup(null); setTravelerClient(null) }}
                className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
                <X size={14}/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-2">
              {travelerPopup.date_of_birth && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 uppercase tracking-wide">Date of birth</span>
                  <span className="text-sm text-slate-700">{format(new Date(travelerPopup.date_of_birth),"MMM d, yyyy")}</span>
                </div>
              )}
              {travelerPopup.passport_number && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 uppercase tracking-wide">Passport #</span>
                  <span className="text-sm text-slate-700 font-mono">{travelerPopup.passport_number}</span>
                </div>
              )}
              {travelerPopup.passport_expiry && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 uppercase tracking-wide">Passport expiry</span>
                  <span className="text-sm text-slate-700">{format(new Date(travelerPopup.passport_expiry),"MMM d, yyyy")}</span>
                </div>
              )}
              {travelerClient && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-600 font-semibold mb-1">Full client record exists</p>
                  <p className="text-sm text-green-800">{travelerClient.first_name} {travelerClient.last_name}</p>
                  {travelerClient.email && <p className="text-xs text-green-600">{travelerClient.email}</p>}
                  {travelerClient.phone && <p className="text-xs text-green-600">{travelerClient.phone}</p>}
                </div>
              )}
              {!travelerClient && (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">No standalone client record — traveler only.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between">
              <button onClick={() => { setTravelerPopup(null); setTravelerClient(null) }}
                className="text-sm text-slate-500 hover:text-slate-700">Close</button>
              {travelerClient && (
                <Button onClick={() => { setTravelerPopup(null); setTravelerClient(null); navigate(`/clients/${travelerClient.id}`) }}>
                  <ExternalLink size={13}/>Go to full profile
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Book Trip Modal */}
      <Modal open={bookTripModal} onClose={() => setBookTripModal(false)}
        title={`New trip — ${client.first_name} ${client.last_name}`} wide
        footer={<>
          <Button variant="secondary" onClick={() => setBookTripModal(false)}>Cancel</Button>
          <Button onClick={saveTrip} disabled={saving || !tripForm.destination}>{saving?"Saving...":"Book trip"}</Button>
        </>}>
        <div className="bg-brand-50 rounded-lg px-3 py-2 text-sm text-brand-700 font-medium flex items-center gap-2">
          <Globe size={13}/>Booking for {client.first_name} {client.last_name}
        </div>
        <Input label="Destination" {...bf("destination")} placeholder="Montego Bay, Jamaica" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Occasion" {...bf("occasion")}>{OCCASIONS.map(o=><option key={o}>{o}</option>)}</Select>
          <Input label="Group name" {...bf("group_name")} placeholder="Girls Trip 2026..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Departure date" type="date" {...bf("departure_date")} />
          <Input label="Return date"    type="date" {...bf("return_date")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Total price ($)" type="number" {...bf("total_price")} placeholder="0.00" />
          <Input label="Amount paid ($)" type="number" {...bf("amount_paid")} placeholder="0.00" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Status" {...bf("status")}>{STATUSES.map(s=><option key={s}>{s}</option>)}</Select>
          <Input label="Travelers" type="number" {...bf("traveler_count")} placeholder="1" />
          <Input label="Confirmation #" {...bf("confirmation_number")} placeholder="ABC123" />
        </div>
        <Textarea label="Notes" {...bf("notes")} />
      </Modal>

      {/* Add to Existing Trip Modal */}
      <Modal open={addToTripModal} onClose={() => setAddToTripModal(false)}
        title={`Add ${client.first_name} to existing trip`}
        footer={<>
          <Button variant="secondary" onClick={() => setAddToTripModal(false)}>Cancel</Button>
          <Button onClick={addToExistingTrip} disabled={saving || !addToTripForm.trip_id}>{saving?"Adding...":"Add to trip"}</Button>
        </>}>
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          Select a trip to add {client.first_name} {client.last_name} to as a group member.
        </p>
        <Select label="Select trip" {...af("trip_id")}>
          <option value="">Choose a trip...</option>
          {otherTrips.map(t => (
            <option key={t.id} value={t.id}>
              {t.destination}{t.departure_date ? ` · ${format(new Date(t.departure_date),"MMM d, yyyy")}` : ""} {t.group_name ? `· ${t.group_name}` : ""}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" {...af("role")}><option>Member</option><option>Lead</option><option>Guest</option></Select>
          <Input label="Amount owed ($)" type="number" {...af("amount_owed")} placeholder="0.00" />
        </div>
        <Input label="Confirmation number" {...af("confirmation_number")} placeholder="Individual conf #" />
      </Modal>

      {/* AI Email */}
      <AIEmailComposer client={client} trip={selectedTrip} open={emailModal}
        onClose={() => { setEmailModal(false); setSelectedTrip(null) }} />

      {/* AI Briefing */}
      <AIClientBriefing client={client} trips={trips} tasks={tasks} travelers={travelers} loyalty={loyalty}
        open={briefingOpen} onClose={() => setBriefingOpen(false)} />

      {/* Add Traveler Modal */}
      <Modal open={travelerModal} onClose={() => setTravelerModal(false)} title="Add traveler" wide
        footer={<>
          <Button variant="secondary" onClick={() => setTravelerModal(false)}>Cancel</Button>
          <Button onClick={saveTraveler} disabled={saving || (!travelerForm.full_name && !travelerForm.existing_client_id)}>
            {saving?"Saving...":"Add traveler"}
          </Button>
        </>}>
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
          {[["just_traveler","Traveler only"],["existing_client","Link existing"],["new_client","Create new client"]].map(([val, label]) => (
            <button key={val} onClick={() => setTravelerForm(f => ({ ...f, _mode: val, existing_client_id:"" }))}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors ${travelerForm._mode===val?"bg-white text-brand-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              {label}
            </button>
          ))}
        </div>
        {travelerForm._mode === "existing_client" ? (
          <>
            <Select label="Select client" {...tf("existing_client_id")}>
              <option value="">Choose...</option>
              {allClients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </Select>
            <Select label="Relationship" {...tf("relationship")}>{RELATIONSHIPS.map(r=><option key={r}>{r}</option>)}</Select>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full name" {...tf("full_name")} placeholder="Jane Smith" className="col-span-2" />
              <Select label="Relationship" {...tf("relationship")}>{RELATIONSHIPS.map(r=><option key={r}>{r}</option>)}</Select>
              <Input label="Date of birth" type="date" {...tf("date_of_birth")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Passport number" {...tf("passport_number")} placeholder="A12345678" />
              <Input label="Passport expiry" type="date" {...tf("passport_expiry")} />
            </div>
            <Textarea label="Notes" {...tf("notes")} />
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <input type="checkbox" id="tv_minor" checked={travelerForm.is_minor||false}
                onChange={e => setTravelerForm(f => ({ ...f, is_minor: e.target.checked }))}
                className="w-4 h-4 accent-purple-500" />
              <label htmlFor="tv_minor" className="text-sm text-purple-700 font-medium cursor-pointer">
                This traveler is a minor (under 18)
              </label>
            </div>
            {travelerForm._mode === "new_client" && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">A full client record will also be created.</p>
            )}
          </>
        )}
      </Modal>

      {/* Add Loyalty Modal */}
      <Modal open={loyaltyModal} onClose={() => setLoyaltyModal(false)} title="Add loyalty number"
        footer={<>
          <Button variant="secondary" onClick={() => setLoyaltyModal(false)}>Cancel</Button>
          <Button onClick={saveLoyalty} disabled={saving || !loyaltyForm.number}>{saving?"Saving...":"Add"}</Button>
        </>}>
        <Select label="Airline or cruise line" {...lf("airline_or_cruise")}>{AIRLINES.map(a=><option key={a}>{a}</option>)}</Select>
        <Input label="Loyalty number" {...lf("number")} placeholder="Member number..." />
        <Select label="Linked traveler (optional)" {...lf("traveler_id")}>
          <option value="">Account-level</option>
          {travelers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </Select>
      </Modal>
    </div>
  )
}
