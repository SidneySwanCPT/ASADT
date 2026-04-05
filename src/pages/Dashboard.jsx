import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Link, useNavigate } from "react-router-dom"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addMonths, subMonths, differenceInDays, startOfYear, eachMonthOfInterval, endOfYear } from "date-fns"
import {
  Globe, Users, AlertCircle, CheckSquare, TrendingUp, CreditCard,
  Bell, ArrowRight, ChevronLeft, ChevronRight, BookOpen, Zap,
  Calendar, Clock, Gift, RefreshCw, BarChart2, AlertTriangle,
  DollarSign, Plane, UserCheck
} from "lucide-react"
import { Card, StatusBadge, OccasionBadge, Spinner } from "../components/UI"

const VERSES = [
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13", theme: "Strength for every challenge you face today." },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", ref: "Jeremiah 29:11", theme: "Trust the journey — every trip has a purpose." },
  { text: "Commit to the Lord whatever you do, and he will establish your plans.", ref: "Proverbs 16:3", theme: "Start every booking with intention and faith." },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", ref: "Joshua 1:9", theme: "Go confidently — you are never alone." },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5", theme: "When things feel uncertain, lean into faith." },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28", theme: "Every setback is a setup for something greater." },
  { text: "She is clothed with strength and dignity, and she laughs without fear of the future.", ref: "Proverbs 31:25", theme: "You are equipped for everything ahead." },
  { text: "Let your light shine before others, that they may see your good deeds.", ref: "Matthew 5:16", theme: "Your work creates joy and lasting memories." },
  { text: "The Lord will fight for you; you need only to be still.", ref: "Exodus 14:14", theme: "Rest in the assurance that you are covered." },
  { text: "Ask and it will be given to you; seek and you will find.", ref: "Matthew 7:7", theme: "Keep showing up — breakthrough is near." },
  { text: "Give thanks in all circumstances; for this is God's will for you in Christ Jesus.", ref: "1 Thessalonians 5:18", theme: "Gratitude turns ordinary days into extraordinary ones." },
  { text: "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.", ref: "Philippians 4:6", theme: "Breathe. Pray. Trust. Then plan." },
  { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24", theme: "Today is a gift — make it count." },
  { text: "Delight yourself in the Lord, and he will give you the desires of your heart.", ref: "Psalm 37:4", theme: "Your passion for this work is a gift." },
]

function getDailyVerse() {
  const day = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  return VERSES[day % VERSES.length]
}

function StatCard({ icon: Icon, label, value, to, color, sub }) {
  const navigate = useNavigate()
  const colors = {
    pink:  "bg-brand-50 text-brand-600 border-brand-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red:   "bg-red-50 text-red-600 border-red-100",
    blue:  "bg-blue-50 text-blue-600 border-blue-100",
    teal:  "bg-teal-50 text-teal-600 border-teal-100",
  }
  return (
    <div onClick={() => to && navigate(to)}
      className={`rounded-xl border p-4 flex items-start gap-3 transition-all group ${colors[color]} ${to ? "cursor-pointer hover:shadow-md" : ""}`}>
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs opacity-80">{label}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight size={13} className="opacity-30 group-hover:opacity-80 transition-opacity flex-shrink-0 mt-1" />}
    </div>
  )
}

function MiniBarChart({ data, color = "#F4A7C3" }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-sm transition-all hover:opacity-80" title={`${d.label}: $${d.value.toLocaleString()}`}
            style={{ height: `${Math.max(4, (d.value / max) * 52)}px`, background: color, opacity: i === data.length - 1 ? 1 : 0.5 }} />
          <span className="text-xs text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [calMonth, setCalMonth] = useState(new Date())
  const verse = getDailyVerse()
  const today = new Date()

  useEffect(() => {
    async function load() {
      const [
        { data: upcomingTrips },
        { data: overduePayments },
        { data: openTasks },
        { count: clientCount },
        { data: allTrips },
        { data: allClients },
        { data: payments },
        { data: remindersToday },
        { data: groups },
      ] = await Promise.all([
        supabase.from("upcoming_trips").select("*").limit(6),
        supabase.from("overdue_payments").select("*"),
        supabase.from("tasks").select("*, clients(first_name,last_name)").eq("completed", false).order("due_date").limit(10),
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("trips").select("*, clients(id,first_name,last_name,date_of_birth,anniversary_date)").order("departure_date"),
        supabase.from("clients").select("id,first_name,last_name,date_of_birth,anniversary_date,email,phone,passport_expiry").order("last_name"),
        supabase.from("payments").select("amount,paid_at,status").eq("status", "Paid"),
        supabase.from("reminders").select("*, clients(first_name,last_name)").eq("sent", false).lte("scheduled_for", new Date(today.getTime() + 86400000).toISOString()).gte("scheduled_for", new Date(today.setHours(0,0,0,0)).toISOString()),
        supabase.from("groups").select("*, trips(destination,departure_date), group_members(payment_status,removed)").eq("status","Active"),
      ])

      // Revenue by month this year
      const monthRevenue = eachMonthOfInterval({ start: startOfYear(new Date()), end: endOfYear(new Date()) }).map(month => {
        const label = format(month, "MMM")
        const value = (payments || []).filter(p => {
          if (!p.paid_at) return false
          const d = new Date(p.paid_at)
          return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
        }).reduce((s, p) => s + parseFloat(p.amount), 0)
        return { label, value }
      }).slice(0, new Date().getMonth() + 1)

      // Trips departing today
      const departingToday = (allTrips || []).filter(t => t.departure_date && format(new Date(t.departure_date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))

      // Returning today
      const returningToday = (allTrips || []).filter(t => t.return_date && format(new Date(t.return_date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))

      // Tasks due today
      const tasksDueToday = (openTasks || []).filter(t => t.due_date && format(new Date(t.due_date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))

      // Upcoming birthdays (next 30 days)
      const birthdays = (allClients || []).filter(c => {
        if (!c.date_of_birth) return false
        const bday = new Date(c.date_of_birth)
        const thisYear = new Date(new Date().getFullYear(), bday.getMonth(), bday.getDate())
        const days = differenceInDays(thisYear, new Date())
        return days >= 0 && days <= 30
      }).map(c => {
        const bday = new Date(c.date_of_birth)
        const thisYear = new Date(new Date().getFullYear(), bday.getMonth(), bday.getDate())
        return { ...c, daysUntil: differenceInDays(thisYear, new Date()), birthdayDate: thisYear }
      }).sort((a, b) => a.daysUntil - b.daysUntil)

      // Expiring passports (next 90 days)
      const expiringPassports = (allClients || []).filter(c => {
        if (!c.passport_expiry) return false
        const days = differenceInDays(new Date(c.passport_expiry), new Date())
        return days >= 0 && days <= 90
      }).sort((a, b) => new Date(a.passport_expiry) - new Date(b.passport_expiry))

      // Trips with balance due departing in < 30 days
      const urgentPayments = (allTrips || []).filter(t => {
        if (!t.departure_date) return false
        const days = differenceInDays(new Date(t.departure_date), new Date())
        const balance = parseFloat(t.total_price || 0) - parseFloat(t.amount_paid || 0)
        return days >= 0 && days <= 30 && balance > 0 && t.status !== "Cancelled"
      })

      // Re-engagement: clients with no trip in 12+ months
      const reEngagement = (allClients || []).filter(c => {
        const clientTrips = (allTrips || []).filter(t => t.clients?.id === c.id)
        if (clientTrips.length === 0) return false
        const lastTrip = clientTrips.sort((a, b) => new Date(b.departure_date) - new Date(a.departure_date))[0]
        if (!lastTrip.departure_date) return false
        return differenceInDays(new Date(), new Date(lastTrip.departure_date)) > 365
      }).slice(0, 5)

      // Pipeline counts
      const pipeline = {}
      ;["Quoted","Confirmed","Paid","Departed"].forEach(s => {
        pipeline[s] = (allTrips || []).filter(t => t.status === s).length
      })

      // Total revenue
      const totalRevenue = (payments || []).reduce((s, p) => s + parseFloat(p.amount), 0)
      const thisMonthRev = monthRevenue[monthRevenue.length - 1]?.value || 0
      const lastMonthRev = monthRevenue[monthRevenue.length - 2]?.value || 0

      // Repeat clients
      const repeatClients = (allClients || []).filter(c => {
        return (allTrips || []).filter(t => t.clients?.id === c.id).length > 1
      }).length

      setData({
        upcomingTrips: upcomingTrips || [],
        overduePayments: overduePayments || [],
        openTasks: openTasks || [],
        allTrips: allTrips || [],
        clientCount: clientCount || 0,
        monthRevenue,
        totalRevenue,
        thisMonthRev,
        lastMonthRev,
        departingToday,
        returningToday,
        tasksDueToday,
        birthdays,
        expiringPassports,
        urgentPayments,
        reEngagement,
        pipeline,
        repeatClients,
        remindersToday: remindersToday || [],
        groups: groups || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  const completeTask = async (id) => {
    await supabase.from("tasks").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", id)
    setData(d => ({ ...d, openTasks: d.openTasks.filter(t => t.id !== id) }))
  }

  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) })
  const tripsOnDay = (day) => (data?.allTrips || []).filter(t => {
    if (!t.departure_date) return false
    const dep = parseISO(t.departure_date)
    const ret = t.return_date ? parseISO(t.return_date) : dep
    return day >= dep && day <= ret
  })

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner />
    </div>
  )

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"
  const revenueGrowth = data.lastMonthRev > 0 ? Math.round(((data.thisMonthRev - data.lastMonthRev) / data.lastMonthRev) * 100) : null

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* Bible verse */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 flex items-start gap-4">
        <BookOpen size={18} className="text-brand-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-brand-800 font-medium italic leading-relaxed">"{verse.text}"</p>
          <p className="text-xs text-brand-500 font-semibold mt-1">{verse.ref}</p>
          <p className="text-xs text-brand-400 mt-0.5">{verse.theme}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{fontFamily:"Georgia,serif"}}>{greeting} ✈️</h1>
          <p className="text-sm text-slate-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
        <div className="flex gap-3">
          <Link to="/clients">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-brand-50 hover:border-brand-200 transition-all text-sm font-medium shadow-sm">
              <Users size={16} className="text-brand-400" />Add client
            </button>
          </Link>
          <Link to="/trips">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-sm hover:shadow-md transition-all" style={{background:"#8B1A4A"}}>
              <Globe size={16} />Book a trip
            </button>
          </Link>
        </div>
      </div>

      {/* ── TODAY'S AGENDA ── */}
      {(data.departingToday.length > 0 || data.returningToday.length > 0 || data.tasksDueToday.length > 0 || data.remindersToday.length > 0) && (
        <div className="rounded-xl border-2 border-brand-200 bg-white p-4">
          <p className="text-sm font-bold text-brand-700 mb-3 flex items-center gap-2"><Clock size={15}/>Today's agenda</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.departingToday.length > 0 && (
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-600 mb-1.5 flex items-center gap-1"><Plane size={11}/>Departing today</p>
                {data.departingToday.map(t => (
                  <p key={t.id} className="text-xs text-green-800 font-medium truncate">{t.clients?.first_name} {t.clients?.last_name} → {t.destination}</p>
                ))}
              </div>
            )}
            {data.returningToday.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-600 mb-1.5 flex items-center gap-1"><Plane size={11} style={{transform:"scaleX(-1)"}}/>Returning today</p>
                {data.returningToday.map(t => (
                  <p key={t.id} className="text-xs text-blue-800 font-medium truncate">{t.clients?.first_name} {t.clients?.last_name} from {t.destination}</p>
                ))}
              </div>
            )}
            {data.tasksDueToday.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-600 mb-1.5 flex items-center gap-1"><CheckSquare size={11}/>Tasks due today</p>
                {data.tasksDueToday.map(t => (
                  <p key={t.id} className="text-xs text-amber-800 font-medium truncate">{t.title}</p>
                ))}
              </div>
            )}
            {data.remindersToday.length > 0 && (
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-600 mb-1.5 flex items-center gap-1"><Bell size={11}/>Reminders today</p>
                {data.remindersToday.map(r => (
                  <p key={r.id} className="text-xs text-purple-800 font-medium truncate">{r.clients?.first_name} {r.clients?.last_name} · {r.subject || r.type}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KEY STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}       label="Total clients"    value={data.clientCount}                          to="/clients" color="pink"  sub={`${data.repeatClients} repeat bookers`} />
        <StatCard icon={Globe}       label="Active trips"     value={data.allTrips.filter(t => !["Cancelled","Completed"].includes(t.status)).length} to="/trips" color="green" sub={`${data.pipeline.Confirmed || 0} confirmed`} />
        <StatCard icon={DollarSign}  label="This month"       value={`$${Math.round(data.thisMonthRev).toLocaleString()}`} to="/trips" color="teal"
          sub={revenueGrowth !== null ? `${revenueGrowth >= 0 ? "▲" : "▼"} ${Math.abs(revenueGrowth)}% vs last month` : "First month"} />
        <StatCard icon={AlertCircle} label="Needs attention"  value={data.overduePayments.length + data.urgentPayments.length} to="/trips" color="red" sub="Overdue + urgent" />
      </div>

      {/* ── ACTION REQUIRED ── */}
      {(data.overduePayments.length > 0 || data.urgentPayments.length > 0 || data.expiringPassports.length > 0) && (
        <Card>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-red-100 bg-red-50 rounded-t-xl">
            <Zap size={14} className="text-red-500" />
            <p className="text-sm font-bold text-red-700">Action required</p>
          </div>
          <div className="divide-y divide-slate-50">
            {data.overduePayments.slice(0,3).map(p => (
              <Link key={p.id} to="/trips" className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-sm text-slate-800 flex-1"><span className="font-medium">{p.client_name}</span> — overdue payment of <span className="text-red-600 font-semibold">${parseFloat(p.amount).toLocaleString()}</span></p>
                <ArrowRight size={12} className="text-slate-300" />
              </Link>
            ))}
            {data.urgentPayments.slice(0,3).map(t => (
              <Link key={t.id} to="/trips" className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <p className="text-sm text-slate-800 flex-1">
                  <span className="font-medium">{t.clients?.first_name} {t.clients?.last_name}</span> — {t.destination} departs in {differenceInDays(new Date(t.departure_date), new Date())}d, <span className="text-amber-600 font-semibold">${(parseFloat(t.total_price||0)-parseFloat(t.amount_paid||0)).toLocaleString()} due</span>
                </p>
                <ArrowRight size={12} className="text-slate-300" />
              </Link>
            ))}
            {data.expiringPassports.slice(0,2).map(c => (
              <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <p className="text-sm text-slate-800 flex-1">
                  <span className="font-medium">{c.first_name} {c.last_name}</span> — passport expires {format(new Date(c.passport_expiry), "MMM d, yyyy")} ({differenceInDays(new Date(c.passport_expiry), new Date())}d)
                </p>
                <ArrowRight size={12} className="text-slate-300" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="space-y-4">

          {/* Revenue chart */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5"><BarChart2 size={11}/>Revenue {new Date().getFullYear()}</p>
              <p className="text-sm font-bold text-slate-800">${Math.round(data.totalRevenue).toLocaleString()}</p>
            </div>
            <MiniBarChart data={data.monthRevenue} color="#C2185B" />
          </Card>

          {/* Booking pipeline */}
          <Card className="p-4">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"><TrendingUp size={11}/>Booking pipeline</p>
            <div className="space-y-2">
              {[
                { label: "Quoted",    color: "#94a3b8", count: data.pipeline.Quoted    || 0 },
                { label: "Confirmed", color: "#3b82f6", count: data.pipeline.Confirmed || 0 },
                { label: "Paid",      color: "#22c55e", count: data.pipeline.Paid      || 0 },
                { label: "Departed",  color: "#a855f7", count: data.pipeline.Departed  || 0 },
              ].map(({ label, color, count }) => {
                const total = Object.values(data.pipeline).reduce((a, b) => a + b, 0) || 1
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20">{label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${(count/total)*100}%`, background: color }} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-4 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Active group trips */}
          {data.groups.length > 0 && (
            <Card>
              <div className="px-4 py-2.5 border-b border-slate-100 bg-brand-50 rounded-t-xl">
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5"><Users size={11}/>Group trips ({data.groups.length})</p>
              </div>
              <div className="divide-y divide-slate-50">
                {data.groups.slice(0,4).map(g => {
                  const members = (g.group_members || []).filter(m => !m.removed)
                  const paid = members.filter(m => m.payment_status === "Paid in Full").length
                  return (
                    <Link key={g.id} to="/trips" className="block px-4 py-2.5 hover:bg-brand-50 transition-colors">
                      <p className="text-sm font-medium text-slate-800 truncate">{g.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400">{members.length} travelers</p>
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-green-500" style={{ width: members.length > 0 ? `${(paid/members.length)*100}%` : "0%" }} />
                        </div>
                        <p className="text-xs text-green-600 font-medium">{paid}/{members.length} paid</p>
                      </div>
                      {g.trips?.departure_date && (
                        <p className="text-xs text-slate-400 mt-0.5">{g.trips.destination} · {format(new Date(g.trips.departure_date), "MMM d, yyyy")}</p>
                      )}
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Re-engagement */}
          {data.reEngagement.length > 0 && (
            <Card>
              <div className="px-4 py-2.5 border-b border-slate-100 bg-brand-50 rounded-t-xl">
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider flex items-center gap-1.5"><RefreshCw size={11}/>Re-engage (12mo+)</p>
              </div>
              <div className="divide-y divide-slate-50">
                {data.reEngagement.map(c => (
                  <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50 transition-colors">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:"#8B1A4A"}}>
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <p className="text-sm text-slate-800 flex-1">{c.first_name} {c.last_name}</p>
                    <ArrowRight size={12} className="text-slate-300" />
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Center + right col */}
        <div className="lg:col-span-2 space-y-4">

          {/* Upcoming birthdays */}
          {data.birthdays.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-brand-50 rounded-t-xl">
                <Gift size={14} className="text-brand-500" />
                <p className="text-sm font-semibold text-brand-700">Upcoming birthdays</p>
              </div>
              <div className="flex gap-3 px-4 py-3 overflow-x-auto">
                {data.birthdays.slice(0,6).map(c => (
                  <Link key={c.id} to={`/clients/${c.id}`}
                    className="flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50 transition-all min-w-20 text-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{background:"#8B1A4A"}}>
                      {c.first_name?.[0]}{c.last_name?.[0]}
                    </div>
                    <p className="text-xs font-medium text-slate-700 truncate w-full text-center">{c.first_name}</p>
                    <p className="text-xs text-brand-500 font-semibold">{c.daysUntil === 0 ? "Today! 🎂" : `in ${c.daysUntil}d`}</p>
                    <p className="text-xs text-slate-400">{format(c.birthdayDate, "MMM d")}</p>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Open tasks + upcoming departures side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tasks due soon */}
            <Card>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-brand-50 rounded-t-xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-700"><CheckSquare size={14}/>Open tasks</div>
                <Link to="/tasks" className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1">All <ArrowRight size={10}/></Link>
              </div>
              <div className="divide-y divide-slate-50">
                {data.openTasks.length === 0
                  ? <p className="text-sm text-slate-400 px-4 py-4 text-center">All caught up!</p>
                  : data.openTasks.slice(0,6).map(task => {
                    const overdue = task.due_date && new Date(task.due_date) < new Date()
                    return (
                      <div key={task.id} className="px-4 py-2.5 flex items-center gap-2.5">
                        <button onClick={() => completeTask(task.id)}
                          className="w-4 h-4 rounded border border-slate-300 hover:border-brand-400 flex-shrink-0 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-800 truncate">{task.title}</p>
                          {task.due_date && <p className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-slate-400"}`}>{format(new Date(task.due_date), "MMM d")}</p>}
                        </div>
                        <StatusBadge status={task.priority} />
                      </div>
                    )
                  })
                }
              </div>
            </Card>

            {/* Upcoming departures */}
            <Card>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-brand-50 rounded-t-xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-brand-700"><Globe size={14}/>Departures</div>
                <Link to="/trips" className="text-xs text-brand-500 hover:text-brand-700 flex items-center gap-1">All <ArrowRight size={10}/></Link>
              </div>
              <div className="divide-y divide-slate-50">
                {data.upcomingTrips.length === 0
                  ? <p className="text-sm text-slate-400 px-4 py-4 text-center">No upcoming trips.</p>
                  : data.upcomingTrips.slice(0,6).map(trip => (
                    <Link key={trip.id} to="/trips" className="block px-4 py-2.5 hover:bg-brand-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{trip.client_name}</p>
                          <p className="text-xs text-slate-400 truncate">{trip.destination}</p>
                        </div>
                        <span className={`text-xs font-bold ml-2 flex-shrink-0 ${trip.days_until_departure <= 7 ? "text-red-500" : trip.days_until_departure <= 30 ? "text-amber-500" : "text-slate-400"}`}>
                          {trip.days_until_departure}d
                        </span>
                      </div>
                    </Link>
                  ))
                }
              </div>
            </Card>
          </div>

          {/* Calendar */}
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-brand-50 rounded-t-xl">
              <button onClick={() => setCalMonth(m => subMonths(m,1))} className="p-1 rounded-lg hover:bg-brand-100 transition-colors"><ChevronLeft size={15} className="text-brand-600"/></button>
              <p className="text-sm font-semibold text-brand-700" style={{fontFamily:"Georgia,serif"}}>{format(calMonth,"MMMM yyyy")}</p>
              <button onClick={() => setCalMonth(m => addMonths(m,1))} className="p-1 rounded-lg hover:bg-brand-100 transition-colors"><ChevronRight size={15} className="text-brand-600"/></button>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <div key={i} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: calDays[0].getDay() }).map((_,i) => <div key={`e${i}`}/>)}
                {calDays.map(day => {
                  const dayTrips = tripsOnDay(day)
                  const isBirthday = data.birthdays.some(c => format(c.birthdayDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
                  return (
                    <div key={day.toISOString()}
                      className={`min-h-12 rounded-lg p-0.5 border text-center ${isToday(day) ? "border-brand-400 bg-brand-50" : "border-slate-100 hover:border-brand-200"}`}>
                      <div className="flex items-center justify-center gap-0.5">
                        <p className={`text-xs font-medium ${isToday(day) ? "text-brand-600" : "text-slate-500"}`}>{format(day,"d")}</p>
                        {isBirthday && <span className="text-xs">🎂</span>}
                      </div>
                      {dayTrips.slice(0,1).map(t => (
                        <Link to="/trips" key={t.id}
                          className="block text-xs px-0.5 py-0.5 rounded mb-0.5 truncate font-medium"
                          style={{background:"#F8BBD9", color:"#6b1238", fontSize:"9px"}}>
                          {t.clients?.first_name?.substring(0,6)}
                        </Link>
                      ))}
                      {dayTrips.length > 1 && <p style={{fontSize:"9px"}} className="text-brand-400 font-medium">+{dayTrips.length-1}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
