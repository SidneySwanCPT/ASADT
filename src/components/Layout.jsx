import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { LayoutDashboard, Users, Globe, CheckSquare, Bell, Building2, LogOut } from "lucide-react"
import GlobalSearch from "./GlobalSearch"

const navItems = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard"  },
  { to: "/clients",   icon: Users,           label: "Clients"    },
  { to: "/trips",     icon: Globe,           label: "Trips"      },
  { to: "/tasks",     icon: CheckSquare,     label: "Tasks"      },
  { to: "/reminders", icon: Bell,            label: "Reminders"  },
  { to: "/suppliers", icon: Building2,       label: "Suppliers"  },
]

function Logo() {
  return (
    <div className="px-4 py-5 border-b border-brand-700">
      <div className="flex items-center gap-3">
        <svg width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="#6b1238"/>
          <circle cx="18" cy="18" r="16" fill="none" stroke="#F4A7C3" strokeWidth="1.5"/>
          <ellipse cx="18" cy="18" rx="16" ry="7" fill="none" stroke="#9d2558" strokeWidth="0.8"/>
          <line x1="2" y1="18" x2="34" y2="18" stroke="#9d2558" strokeWidth="0.8"/>
          <path d="M18 2 Q24 18 18 34" fill="none" stroke="#9d2558" strokeWidth="0.8"/>
          <path d="M18 2 Q12 18 18 34" fill="none" stroke="#9d2558" strokeWidth="0.8"/>
          <g transform="translate(18,17) rotate(-25)">
            <ellipse cx="0" cy="0" rx="6" ry="1.8" fill="#F8BBD9"/>
            <path d="M-1,-1.5 Q1,-5 4,-4.5 Q2,-2 -1,0 Z" fill="white"/>
            <path d="M-1,1.5 Q1,5 4,4.5 Q2,2 -1,0 Z" fill="white"/>
          </g>
        </svg>
        <div>
          <p className="text-sm font-bold text-white leading-tight" style={{fontFamily:"Georgia,serif"}}>ASA Destination</p>
          <p className="text-xs text-brand-300 leading-tight tracking-wider">TRAVEL</p>
        </div>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-56 flex flex-col flex-shrink-0" style={{background:"#8B1A4A"}}>
        <Logo />
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive ? "bg-white/20 text-white font-medium" : "text-brand-200 hover:bg-white/10 hover:text-white"
                }`}>
              <Icon size={16} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-brand-700">
          <button onClick={async () => { await signOut(); navigate("/login") }}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-brand-300 hover:bg-white/10 hover:text-white transition-all">
            <LogOut size={16} />Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <GlobalSearch />
        </div>
        <main className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
