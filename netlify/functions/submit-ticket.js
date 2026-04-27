// ─────────────────────────────────────────────────────────────────────────────
// Required Netlify environment variables:
//   RESEND_API_KEY              — from Resend → API Keys
//   VITE_SUPABASE_URL           — same URL the frontend uses
//   SUPABASE_SERVICE_ROLE_KEY   — Supabase → Project Settings → API → service_role
//                                 (NOT the anon key — this bypasses RLS, never expose
//                                  it to the browser; only used in this serverless fn)
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require("@supabase/supabase-js")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const PRIORITY_COLOR = {
  Urgent: "#dc2626",
  High:   "#d97706",
  Medium: "#2563eb",
  Low:    "#64748b",
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

function buildEmail({ ticketId, name, email, subject, category, priority, description, timestamp, isReminder }) {
  const priColor = PRIORITY_COLOR[priority] || "#64748b"
  const headerLabel = isReminder ? "Ticket Reminder" : "New IT Support Ticket"
  const reminderBanner = isReminder
    ? `<tr>
        <td style="background:#fef3c7;border-bottom:1px solid #fde68a;padding:12px 24px;color:#92400e;font-size:13px;font-weight:600;">
          🔔 This is a follow-up reminder on an existing ticket.
        </td>
      </tr>`
    : ""

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:#8B1A4A;padding:20px 24px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">ASA Destination Travel</div>
          <div style="font-size:18px;font-weight:600;margin-top:4px;">${escapeHtml(headerLabel)}</div>
          ${ticketId ? `<div style="font-size:12px;opacity:.85;margin-top:4px;">Ticket #${escapeHtml(ticketId)}</div>` : ""}
        </td>
      </tr>
      ${reminderBanner}
      <tr>
        <td style="padding:24px;">
          <div style="margin-bottom:16px;">
            <span style="display:inline-block;background:${priColor};color:#ffffff;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${escapeHtml(priority)} priority</span>
            <span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-left:6px;">${escapeHtml(category)}</span>
          </div>
          <h2 style="margin:0 0 20px;font-size:18px;color:#0f172a;">${escapeHtml(subject)}</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;width:120px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">From</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Email</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;"><a href="mailto:${escapeHtml(email)}" style="color:#8B1A4A;text-decoration:none;">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Category</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${escapeHtml(category)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Priority</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${escapeHtml(priority)}</td>
            </tr>
            ${ticketId ? `<tr>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Ticket ID</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(ticketId)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:8px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">${isReminder ? "Reminder sent" : "Submitted"}</td>
              <td style="padding:8px 0;font-size:14px;color:#0f172a;">${escapeHtml(timestamp)}</td>
            </tr>
          </table>
          <div style="margin-top:24px;">
            <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Description</div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:14px;line-height:1.6;color:#1e293b;white-space:pre-wrap;">${escapeHtml(description)}</div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = `${isReminder ? "Ticket Reminder (follow-up on existing ticket)" : "New IT Support Ticket"}
---------------------
${ticketId ? `Ticket ID:   ${ticketId}\n` : ""}From:        ${name} <${email}>
Category:    ${category}
Priority:    ${priority}
Subject:     ${subject}
${isReminder ? "Reminder:   " : "Submitted:  "} ${timestamp}

Description:
${description}
`

  return { html, text }
}

async function sendEmail({ resendKey, fromEmail, subjectLine, html, text }) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "inquiries@asamanagementgroup.com",
      to: ["sidney.swan@asamanagementgroup.com"],
      reply_to: fromEmail,
      subject: subjectLine,
      html,
      text,
    }),
  })
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" }
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" })
  }

  try {
    const body = JSON.parse(event.body || "{}")
    const isReminder = body.reminder === true

    // Reminder requests pull the user fields from either the original schema
    // (submitted_by_name/email) or the new-ticket schema (name/email).
    const name        = body.name        || body.submitted_by_name
    const email       = body.email       || body.submitted_by_email
    const { subject, category, priority, description, user_id, ticket_id } = body

    if (!name || !email || !subject || !category || !priority || !description) {
      return json(400, { error: "Missing required fields" })
    }

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return json(500, { error: "Email service not configured" })

    // ── Reminder branch: skip Supabase insert, just send the follow-up email ──
    if (isReminder) {
      const timestamp = new Date().toISOString()
      const { html, text } = buildEmail({
        ticketId: ticket_id, name, email, subject, category, priority, description, timestamp, isReminder: true,
      })
      const resp = await sendEmail({
        resendKey,
        fromEmail: email,
        subjectLine: `[REMINDER] ${priority} — ${subject}`,
        html,
        text,
      })
      if (!resp.ok) {
        const detail = await resp.text()
        return json(500, { error: "Failed to send reminder", detail })
      }
      return json(200, { success: true, reminder: true, ticket_id, timestamp })
    }

    // ── New-ticket branch: insert into Supabase, then send the email ──
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return json(500, { error: "Supabase not configured" })

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: ticket, error: insertError } = await supabase
      .from("tickets")
      .insert({
        submitted_by_name:  name,
        submitted_by_email: email,
        user_id:            user_id || null,
        category,
        priority,
        subject,
        description,
        status:             "Open",
      })
      .select()
      .single()

    if (insertError) {
      return json(500, { error: "Failed to save ticket", detail: insertError.message })
    }

    const timestamp = ticket.created_at || new Date().toISOString()
    const { html, text } = buildEmail({
      ticketId: ticket.id, name, email, subject, category, priority, description, timestamp, isReminder: false,
    })

    const resp = await sendEmail({
      resendKey,
      fromEmail: email,
      subjectLine: `[IT Ticket] ${priority} — ${subject}`,
      html,
      text,
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return json(500, { error: "Ticket saved but email failed", detail, ticket_id: ticket.id })
    }

    return json(200, { success: true, ticket_id: ticket.id, timestamp })
  } catch (err) {
    return json(500, { error: err.message || "Unknown error" })
  }
}
