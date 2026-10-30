// POST /api/lead — accepts a new lead, validates, inserts into D1, fires alerts.
// Env vars (all optional except DB):
//   DB                — D1 binding (required)
//   TURNSTILE_SECRET  — Cloudflare Turnstile secret key
//   ALERT_WEBHOOK_URL — Discord / Slack / ntfy webhook
//   RESEND_API_KEY    — Resend.com API key
//   ALERT_EMAIL_TO    — comma-separated recipient list (e.g. "gym@example.com")
//   ALERT_EMAIL_FROM  — sender address (default: leads@grovemma.example)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  // ── Parse body ──────────────────────────────────────────────────────
  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  // ── Honeypot ────────────────────────────────────────────────────────
  // Silently accept — never let bots know they were caught
  if (body._hp) return json({ ok: true })

  // ── Time-to-submit gate (< 2 s is bot-speed) ────────────────────────
  if (body._t && (Date.now() - Number(body._t)) < 2000) {
    return json({ ok: true })
  }

  // ── Turnstile verification ───────────────────────────────────────────
  if (env.TURNSTILE_SECRET && body.turnstile_token) {
    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: body.turnstile_token }),
      }
    )
    const verifyData = await verifyRes.json()
    if (!verifyData.success) return json({ error: 'Challenge failed. Please try again.' }, 400)
  }

  // ── Validate ─────────────────────────────────────────────────────────
  const name  = (body.name  || '').trim()
  const phone = (body.phone || '').trim()
  const email = (body.email || '').trim() || null

  if (!name)  return json({ error: 'Name is required.'         }, 400)
  if (!phone) return json({ error: 'Phone number is required.' }, 400)

  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) return json({ error: 'Please enter a valid US phone number.' }, 400)

  // ── D1 insert ────────────────────────────────────────────────────────
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  try {
    await env.DB.prepare(`
      INSERT INTO leads
        (id, name, phone, email, who, goal, experience, program_interest,
         preferred_times, note,
         utm_source, utm_medium, utm_campaign, utm_term, utm_content,
         gclid, fbclid, referrer, landing_path)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      id,
      name,
      normalizedPhone,
      email,
      body.who              || null,
      body.goal             || null,
      body.experience       || null,
      body.program_interest || null,
      body.preferred_times?.length ? JSON.stringify(body.preferred_times) : null,
      (body.note || '').trim() || null,
      body.utm_source   || null,
      body.utm_medium   || null,
      body.utm_campaign || null,
      body.utm_term     || null,
      body.utm_content  || null,
      body.gclid        || null,
      body.fbclid       || null,
      body.referrer     || null,
      body.landing_path || null,
    ).run()
  } catch (err) {
    console.error('[lead] D1 insert error:', err)
    return json({ error: 'A server error occurred. Please call us at 541-390-6334.' }, 500)
  }

  // ── Alerts (fire-and-forget — don't delay the response) ──────────────
  env.DB && fireAlerts(env, {
    id, name, phone: normalizedPhone, email,
    program: body.program_interest,
    who: body.who,
    goal: body.goal,
  }).catch(err => console.error('[lead] alert error:', err))

  return json({ ok: true, id })
}

// ─── helpers ────────────────────────────────────────────────────────────

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return null
}

async function fireAlerts(env, lead) {
  const lines = [
    `🥊 New Grove lead!`,
    `👤 ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.email  ? `✉️  ${lead.email}` : null,
    lead.who    ? `👥 Who: ${lead.who}` : null,
    lead.goal   ? `🎯 Goal: ${lead.goal}` : null,
    lead.program ? `📋 Program: ${lead.program}` : null,
    `🔑 ID: ${lead.id}`,
  ].filter(Boolean).join('\n')

  const tasks = []

  if (env.ALERT_WEBHOOK_URL) {
    const url = env.ALERT_WEBHOOK_URL
    // Detect format by URL
    let payload
    if (url.includes('hooks.slack.com')) {
      payload = { text: lines }
    } else if (url.includes('ntfy.sh')) {
      // ntfy: POST body is the message text
      tasks.push(
        fetch(url, { method: 'POST', body: lines, headers: { 'Content-Type': 'text/plain' } })
      )
    } else {
      // Discord (and most others): {"content":"..."}
      payload = { content: lines }
    }
    if (payload) {
      tasks.push(fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
    }
  }

  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    const from = env.ALERT_EMAIL_FROM || 'leads@grovemma.example'
    const to = env.ALERT_EMAIL_TO.split(',').map(s => s.trim()).filter(Boolean)
    tasks.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject: `New lead: ${lead.name}`,
        text: lines,
      }),
    }))
  }

  await Promise.allSettled(tasks)
}
