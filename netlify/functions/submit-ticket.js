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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" }
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    }
  }

  try {
    const { name, email, subject, category, priority, description } = JSON.parse(event.body || "{}")

    if (!name || !email || !subject || !category || !priority || !description) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      }
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Email service not configured" }),
      }
    }

    const timestamp = new Date().toISOString()
    const priColor = PRIORITY_COLOR[priority] || "#64748b"

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr>
        <td style="background:#8B1A4A;padding:20px 24px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85;">ASA Destination Travel</div>
          <div style="font-size:18px;font-weight:600;margin-top:4px;">New IT Support Ticket</div>
        </td>
      </tr>
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
            <tr>
              <td style="padding:8px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Submitted</td>
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

    const text = `New IT Support Ticket
---------------------
From:        ${name} <${email}>
Category:    ${category}
Priority:    ${priority}
Subject:     ${subject}
Submitted:   ${timestamp}

Description:
${description}
`

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "inquiries@asamanagementgroup.com",
        to: ["sidney.swan@asamanagementgroup.com"],
        reply_to: email,
        subject: `[IT Ticket] ${priority} — ${subject}`,
        html,
        text,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to send email", detail }),
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, timestamp }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Unknown error" }),
    }
  }
}
