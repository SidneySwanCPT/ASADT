import { useState } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError("Invalid email or password. Please try again.")
    } else {
      navigate("/")
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12" style={{background:"#8B1A4A"}}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="90" cy="90" r="80" fill="#6b1238"/>
          <circle cx="90" cy="90" r="80" fill="none" stroke="#F4A7C3" strokeWidth="2"/>
          <ellipse cx="90" cy="90" rx="80" ry="24" fill="none" stroke="#9d2558" strokeWidth="1"/>
          <ellipse cx="90" cy="90" rx="80" ry="52" fill="none" stroke="#9d2558" strokeWidth="0.8"/>
          <line x1="10" y1="90" x2="170" y2="90" stroke="#9d2558" strokeWidth="1"/>
          <path d="M90 10 Q120 90 90 170" fill="none" stroke="#9d2558" strokeWidth="1"/>
          <path d="M90 10 Q60 90 90 170" fill="none" stroke="#9d2558" strokeWidth="1"/>
          <g transform="translate(90,86) rotate(-25)">
            <ellipse cx="0" cy="0" rx="22" ry="6" fill="#F8BBD9"/>
            <path d="M22,0 Q32,-1.5 35,0 Q32,1.5 22,0" fill="#F8BBD9"/>
            <path d="M-22,0 Q-28,-1.5 -31,0 Q-28,1.5 -22,0" fill="#F8BBD9"/>
            <path d="M-3,-5 Q3,-18 14,-16 Q8,-6 -3,0 Z" fill="white"/>
            <path d="M-3,5 Q3,18 14,16 Q8,6 -3,0 Z" fill="white"/>
            <path d="M-22,-5 Q-24,-11 -17,-10 Q-19,-5 -22,0 Z" fill="white"/>
            <path d="M-22,5 Q-24,11 -17,10 Q-19,5 -22,0 Z" fill="white"/>
          </g>
          <circle cx="50" cy="45" r="2" fill="#F4A7C3" opacity="0.6"/>
          <circle cx="135" cy="38" r="1.5" fill="#F4A7C3" opacity="0.5"/>
          <circle cx="148" cy="65" r="1" fill="#F4A7C3" opacity="0.4"/>
          <circle cx="38" cy="72" r="1.5" fill="#F4A7C3" opacity="0.5"/>
        </svg>
        <h1 className="text-3xl font-bold text-white mt-8 text-center" style={{fontFamily:"Georgia,serif"}}>ASA Destination Travel</h1>
        <p className="text-brand-300 mt-2 text-center text-sm tracking-widest uppercase">Your journey. Our passion.</p>
        <div className="mt-12 space-y-3 w-full max-w-xs">
          {["Client management","Trip tracking","Payment portal","Automated reminders"].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-300"/>
              <span className="text-brand-200 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800" style={{fontFamily:"Georgia,serif"}}>Agent portal</h2>
            <p className="text-slate-500 text-sm mt-1">Sign in to manage your clients and trips</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 hover:border-brand-200 transition-colors"
                placeholder="you@asadestinationtravel.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 hover:border-brand-200 transition-colors"
                placeholder="••••••••" />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <button type="submit" disabled={loading}
              className="w-full text-white font-medium rounded-lg py-2.5 text-sm transition-all disabled:opacity-60 shadow-sm hover:shadow-md"
              style={{background:"#8B1A4A"}}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
