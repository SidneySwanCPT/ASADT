import { format } from "date-fns"

// Generates a printable HTML client card and triggers browser print dialog
export function generateClientCard(client, trips, travelers, loyalty) {
  const upcoming = (trips || []).filter(t => t.departure_date && new Date(t.departure_date) >= new Date() && t.status !== "Cancelled")
  const past     = (trips || []).filter(t => !upcoming.includes(t)).slice(0, 5)
  const initials = `${client.first_name?.[0] || ""}${client.last_name?.[0] || ""}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Client Card — ${client.first_name} ${client.last_name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Georgia', serif; color: #1a1a1a; background: white; }
    .page { width: 8.5in; min-height: 11in; padding: 0.5in; }

    .header { display:flex; align-items:center; gap:20px; padding-bottom:16px; border-bottom:3px solid #8B1A4A; margin-bottom:20px; }
    .avatar { width:64px; height:64px; border-radius:50%; background:#8B1A4A; display:flex; align-items:center; justify-content:center; color:white; font-size:24px; font-weight:bold; flex-shrink:0; }
    .header-info h1 { font-size:26px; color:#8B1A4A; font-weight:700; }
    .header-info p { font-size:12px; color:#666; margin-top:2px; }
    .header-logo { margin-left:auto; text-align:right; }
    .header-logo .brand { font-size:18px; color:#8B1A4A; font-weight:bold; }
    .header-logo .sub { font-size:11px; color:#aaa; letter-spacing:2px; }

    .grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
    .section { margin-bottom:16px; }
    .section-title { font-size:10px; font-weight:bold; color:#8B1A4A; text-transform:uppercase; letter-spacing:1.5px; border-bottom:1px solid #f4a7c3; padding-bottom:4px; margin-bottom:8px; }
    .row { display:flex; gap:8px; margin-bottom:4px; }
    .row-label { font-size:11px; color:#888; width:120px; flex-shrink:0; font-family:'Arial',sans-serif; }
    .row-value { font-size:11px; color:#1a1a1a; font-family:'Arial',sans-serif; }
    .missing { color:#d97706; font-style:italic; }

    .trip-card { background:#fdf2f7; border:1px solid #f4a7c3; border-radius:8px; padding:10px; margin-bottom:8px; }
    .trip-dest { font-size:13px; font-weight:bold; color:#8B1A4A; }
    .trip-dates { font-size:11px; color:#666; font-family:'Arial',sans-serif; margin-top:2px; }
    .trip-meta { font-size:11px; color:#444; font-family:'Arial',sans-serif; margin-top:3px; }
    .balance-due { color:#dc2626; font-weight:bold; }
    .paid-full { color:#16a34a; }

    .traveler-pill { display:inline-block; background:#f3e8ff; color:#7c3aed; font-size:10px; padding:2px 8px; border-radius:20px; margin:2px 2px 2px 0; font-family:'Arial',sans-serif; }
    .loyalty-row { display:flex; justify-content:space-between; font-size:11px; font-family:'Arial',sans-serif; padding:3px 0; border-bottom:1px solid #f9f9f9; }
    .loyalty-airline { color:#444; font-weight:bold; }
    .loyalty-num { color:#888; font-family:'Courier New',monospace; }

    .badge { display:inline-block; font-size:10px; padding:2px 8px; border-radius:20px; margin-left:6px; font-family:'Arial',sans-serif; }
    .badge-green { background:#dcfce7; color:#166534; }
    .badge-red { background:#fee2e2; color:#991b1b; }
    .badge-blue { background:#dbeafe; color:#1e40af; }

    .footer { border-top:1px solid #f4a7c3; padding-top:10px; margin-top:auto; display:flex; justify-content:space-between; align-items:center; }
    .footer p { font-size:10px; color:#aaa; font-family:'Arial',sans-serif; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0.4in; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="avatar">${initials}</div>
    <div class="header-info">
      <h1>${client.first_name} ${client.last_name}</h1>
      <p>${client.email || "No email"} ${client.phone ? "· " + client.phone : ""}</p>
      ${client.home_airport ? `<p>Home airport: <strong>${client.home_airport}</strong></p>` : ""}
    </div>
    <div class="header-logo">
      <div class="brand">ASA Destination</div>
      <div class="sub">TRAVEL</div>
      <div style="font-size:10px;color:#aaa;margin-top:4px;">${format(new Date(), "MMMM d, yyyy")}</div>
    </div>
  </div>

  <div class="grid">
    <!-- Left column -->
    <div>
      <div class="section">
        <div class="section-title">Personal information</div>
        <div class="row"><span class="row-label">Date of birth</span><span class="row-value">${client.date_of_birth ? format(new Date(client.date_of_birth), "MMMM d, yyyy") : '<span class="missing">Not on file</span>'}</span></div>
        <div class="row"><span class="row-label">Nationality</span><span class="row-value">${client.nationality || '<span class="missing">Not on file</span>'}</span></div>
        <div class="row"><span class="row-label">Passport #</span><span class="row-value">${client.passport_number || '<span class="missing">Missing ⚠</span>'}</span></div>
        <div class="row"><span class="row-label">Passport expiry</span><span class="row-value">${client.passport_expiry ? format(new Date(client.passport_expiry), "MMMM d, yyyy") : '<span class="missing">Missing ⚠</span>'}</span></div>
        <div class="row"><span class="row-label">Emergency contact</span><span class="row-value">${client.emergency_contact_name || '<span class="missing">Not on file</span>'}</span></div>
        <div class="row"><span class="row-label">Emergency phone</span><span class="row-value">${client.emergency_contact_phone || '<span class="missing">Not on file</span>'}</span></div>
      </div>

      <div class="section">
        <div class="section-title">Travel preferences</div>
        <div class="row"><span class="row-label">Preferred airline</span><span class="row-value">${client.preferred_airline || "No preference"}</span></div>
        <div class="row"><span class="row-label">Cruise line</span><span class="row-value">${client.preferred_cruise_line || "No preference"}</span></div>
        <div class="row"><span class="row-label">Seat preference</span><span class="row-value">${client.preferred_seat || "No preference"}</span></div>
        <div class="row"><span class="row-label">Cabin class</span><span class="row-value">${client.preferred_cabin || "No preference"}</span></div>
        <div class="row"><span class="row-label">Hotel tier</span><span class="row-value">${client.preferred_hotel_tier || "No preference"}</span></div>
        <div class="row"><span class="row-label">Ground transport</span><span class="row-value">${client.preferred_transport || "No preference"}</span></div>
        <div class="row"><span class="row-label">Typical budget</span><span class="row-value">${client.typical_budget || "Not specified"}</span></div>
        ${client.dietary_restrictions ? `<div class="row"><span class="row-label">Dietary</span><span class="row-value">${client.dietary_restrictions}</span></div>` : ""}
        ${client.special_needs ? `<div class="row"><span class="row-label">Special needs</span><span class="row-value">${client.special_needs}</span></div>` : ""}
      </div>

      ${travelers && travelers.length > 0 ? `
      <div class="section">
        <div class="section-title">Travelers (${travelers.length})</div>
        ${travelers.map(t => `
          <div class="row">
            <span class="row-label">${t.relationship || "Traveler"}</span>
            <span class="row-value">${t.full_name}${t.date_of_birth ? " · DOB: " + format(new Date(t.date_of_birth), "MM/dd/yyyy") : ""}</span>
          </div>
        `).join("")}
      </div>` : ""}

      ${loyalty && loyalty.length > 0 ? `
      <div class="section">
        <div class="section-title">Loyalty numbers</div>
        ${loyalty.map(l => `
          <div class="loyalty-row">
            <span class="loyalty-airline">${l.airline_or_cruise}</span>
            <span class="loyalty-num">${l.number}</span>
          </div>
        `).join("")}
      </div>` : ""}
    </div>

    <!-- Right column -->
    <div>
      ${upcoming.length > 0 ? `
      <div class="section">
        <div class="section-title">Upcoming trips (${upcoming.length})</div>
        ${upcoming.map(t => {
          const balance = Math.max(0, parseFloat(t.total_price||0) - parseFloat(t.amount_paid||0))
          return `
          <div class="trip-card">
            <div class="trip-dest">${t.destination}${t.occasion ? ` <span class="badge badge-blue">${t.occasion}</span>` : ""}</div>
            <div class="trip-dates">
              ${t.departure_date ? format(new Date(t.departure_date), "MMM d, yyyy") : "TBD"}
              ${t.return_date ? " → " + format(new Date(t.return_date), "MMM d, yyyy") : ""}
            </div>
            <div class="trip-meta">
              ${t.confirmation_number ? "Conf: " + t.confirmation_number + " · " : ""}
              ${t.traveler_count ? t.traveler_count + " travelers · " : ""}
              Total: $${parseFloat(t.total_price||0).toLocaleString()}
              ${balance > 0 ? `<span class="balance-due"> · $${balance.toLocaleString()} due</span>` : `<span class="paid-full"> · Paid in full</span>`}
            </div>
            ${t.notes ? `<div class="trip-meta" style="margin-top:4px;color:#888;">${t.notes}</div>` : ""}
          </div>`
        }).join("")}
      </div>` : '<div class="section"><div class="section-title">Upcoming trips</div><p style="font-size:11px;color:#aaa;font-family:Arial,sans-serif;">No upcoming trips booked.</p></div>'}

      ${past.length > 0 ? `
      <div class="section">
        <div class="section-title">Travel history</div>
        ${past.map(t => `
          <div class="row">
            <span class="row-label">${t.departure_date ? format(new Date(t.departure_date), "MMM yyyy") : "—"}</span>
            <span class="row-value">${t.destination}${t.occasion ? " · " + t.occasion : ""}</span>
          </div>
        `).join("")}
      </div>` : ""}

      ${client.preferences || client.notes ? `
      <div class="section">
        <div class="section-title">Notes & preferences</div>
        ${client.preferences ? `<p style="font-size:11px;color:#444;font-family:Arial,sans-serif;line-height:1.5;margin-bottom:6px;">${client.preferences}</p>` : ""}
        ${client.notes ? `<p style="font-size:11px;color:#666;font-family:Arial,sans-serif;line-height:1.5;font-style:italic;">${client.notes}</p>` : ""}
      </div>` : ""}
    </div>
  </div>

  <div class="footer">
    <p>ASA Destination Travel · Agent Management Platform</p>
    <p>Printed ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</p>
    <p>CONFIDENTIAL — For agent use only</p>
  </div>

</div>
</body>
</html>`

  // Open in new window and trigger print
  const win = window.open("", "_blank")
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print() }
}
