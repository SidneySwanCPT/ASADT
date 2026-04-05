// ─── Badge ───────────────────────────────────────────────────────────────────
export function Badge({ label, color = "gray" }) {
  const map = {
    gray:   "bg-slate-100 text-slate-600",
    pink:   "bg-brand-100 text-brand-700",
    blue:   "bg-blue-100 text-blue-700",
    green:  "bg-green-100 text-green-700",
    amber:  "bg-amber-100 text-amber-700",
    red:    "bg-red-100 text-red-600",
    purple: "bg-purple-100 text-purple-700",
    teal:   "bg-teal-100 text-teal-700",
    rose:   "bg-rose-100 text-rose-700",
  }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${map[color] || map.gray}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    Quoted:"gray", Confirmed:"blue", Paid:"green", Departed:"purple",
    Completed:"teal", Cancelled:"red", Pending:"gray", Sent:"blue",
    Overdue:"red", Low:"gray", Medium:"blue", High:"amber", Urgent:"red",
    Active:"green", "Paid in Full":"green", "Deposit Paid":"blue",
  }
  return <Badge label={status} color={map[status] || "gray"} />
}

export function OccasionBadge({ occasion }) {
  if (!occasion) return null
  const map = {
    "Birthday":"pink","Anniversary":"rose","Honeymoon":"pink",
    "Girls Trip":"purple","Business":"blue","Family":"teal","Group":"amber","Other":"gray"
  }
  return <Badge label={occasion} color={map[occasion] || "gray"} />
}

// ─── Missing Data Warning ─────────────────────────────────────────────────────
export function MissingDataWarning({ fields }) {
  if (!fields || fields.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
      <span className="text-amber-500 text-sm">⚠</span>
      <span className="text-xs text-amber-700 font-medium">Missing: {fields.join(", ")}</span>
    </div>
  )
}

// ─── Missing Data Dot (inline indicator) ─────────────────────────────────────
export function MissingDot({ tooltip }) {
  return (
    <span title={tooltip || "Missing critical information"}
      className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-1 flex-shrink-0" />
  )
}

// ─── Button ──────────────────────────────────────────────────────────────────
export function Button({ children, onClick, type = "button", variant = "primary", size = "md", disabled, className = "" }) {
  const base = "inline-flex items-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-6 py-3 text-base" }
  const variants = {
    primary:   "bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow-md",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-brand-50 hover:border-brand-200",
    danger:    "bg-red-500 text-white hover:bg-red-600",
    ghost:     "text-slate-600 hover:bg-brand-50 hover:text-brand-600",
    pink:      "bg-brand-100 text-brand-700 hover:bg-brand-200",
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────
export function Input({ label, id, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">{label}</label>}
      <input id={id}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-colors
          ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-white hover:border-brand-200"}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ─── Select ──────────────────────────────────────────────────────────────────
export function Select({ label, id, children, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">{label}</label>}
      <select id={id}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 hover:border-brand-200 transition-colors"
        {...props}>
        {children}
      </select>
    </div>
  )
}

// ─── Textarea ────────────────────────────────────────────────────────────────
export function Textarea({ label, id, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1 uppercase tracking-wide">{label}</label>}
      <textarea id={id} rows={3}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none hover:border-brand-200 transition-colors"
        {...props}
      />
    </div>
  )
}

// ─── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, className = "", onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 ${onClick ? "cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all" : ""} ${className}`}>
      {children}
    </div>
  )
}

// ─── PageHeader ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800" style={{fontFamily:"Georgia,serif"}}>{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ─── StatsBar ────────────────────────────────────────────────────────────────
export function StatsBar({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {stats.map(({ label, value, color = "pink", icon: Icon }) => {
        const colors = {
          pink:  "bg-brand-50 text-brand-600 border-brand-100",
          green: "bg-green-50 text-green-600 border-green-100",
          amber: "bg-amber-50 text-amber-600 border-amber-100",
          red:   "bg-red-50 text-red-600 border-red-100",
          blue:  "bg-blue-50 text-blue-600 border-blue-100",
          teal:  "bg-teal-50 text-teal-600 border-teal-100",
        }
        return (
          <div key={label} className={`rounded-xl border p-3 flex items-center gap-3 ${colors[color]}`}>
            {Icon && <Icon size={18} className="flex-shrink-0" />}
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs opacity-80">{label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide, extraWide }) {
  if (!open) return null
  const maxW = extraWide ? "max-w-4xl" : wide ? "max-w-2xl" : "max-w-lg"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxW} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-100 bg-brand-50 rounded-t-2xl">
          <h2 className="text-base font-semibold text-brand-800" style={{fontFamily:"Georgia,serif"}}>{title}</h2>
          <button onClick={onClose} className="text-brand-400 hover:text-brand-600 text-2xl leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-brand-100 transition-colors">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  )
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <div className="bg-brand-50 rounded-full p-5 mb-4"><Icon size={24} className="text-brand-400" /></div>}
      <p className="text-slate-700 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────
export function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 w-36 flex-shrink-0 pt-0.5 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  )
}

// ─── SectionCard ─────────────────────────────────────────────────────────────
export function SectionCard({ title, action, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100" style={{background:"#fdf2f7"}}>
        <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}
