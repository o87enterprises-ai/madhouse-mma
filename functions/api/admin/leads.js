import { requireAdmin } from '../../_lib/auth.js'

// GET /api/admin/leads
// ?format=csv, ?status=, ?limit=, ?offset=, ?report=commission
// PATCH /api/admin/leads  body: { id, status }
export async function onRequestGet({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  const url = new URL(request.url)
  const format       = url.searchParams.get('format') || 'json'
  const statusFilter = url.searchParams.get('status') || null
  const limit        = Math.min(parseInt(url.searchParams.get('limit')  || '200', 10), 1000)
  const offset       = parseInt(url.searchParams.get('offset') || '0', 10)

  // Commission report — leads whose second payment has cleared
  if (url.searchParams.get('report') === 'commission') {
    const { results } = await env.DB.prepare(`
      SELECT l.id, l.name, l.phone, l.email, l.member_since, l.second_payment_at,
             l.utm_source, l.utm_campaign, l.gclid, l.fbclid,
             s.plan_name, s.payment_count, s.stripe_subscription_id
      FROM leads l
      LEFT JOIN subscriptions s ON s.lead_id = l.id
      WHERE l.second_payment_at IS NOT NULL
      ORDER BY l.second_payment_at DESC
    `).all()
    return new Response(JSON.stringify({ commission_leads: results, count: results.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let query = 'SELECT * FROM leads'
  const bindings = []
  if (statusFilter) {
    query += ' WHERE status = ?'
    bindings.push(statusFilter)
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  bindings.push(limit, offset)

  let rows
  try {
    const result = await env.DB.prepare(query).bind(...bindings).all()
    rows = result.results
  } catch (err) {
    console.error('[admin/leads] query error:', err)
    return new Response('Database error', { status: 500 })
  }

  if (format !== 'csv') {
    return new Response(JSON.stringify({ leads: rows, count: rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const COLS = [
    'id','created_at','name','phone','email','who','goal','experience',
    'program_interest','preferred_times','note',
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'gclid','fbclid','referrer','landing_path',
    'status','member_since','second_payment_at',
  ]
  const esc = (v) => {
    if (v == null) return ''
    const s = String(v)
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [COLS.join(','), ...rows.map(r => COLS.map(c => esc(r[c])).join(','))].join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="grove-leads-${new Date().toISOString().slice(0,10)}.csv"`,
    },
  })
}

export async function onRequestPatch({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  let body
  try { body = await request.json() }
  catch { return new Response('Invalid JSON', { status: 400 }) }

  const { id, status } = body
  const VALID = ['new','contacted','booked','attended','joined','lost']
  if (!id) return new Response('id required', { status: 400 })
  if (!VALID.includes(status)) {
    return new Response(`status must be one of: ${VALID.join(', ')}`, { status: 400 })
  }

  await env.DB.prepare(`UPDATE leads SET status=? WHERE id=?`).bind(status, id).run()
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
