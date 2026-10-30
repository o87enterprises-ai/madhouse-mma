import { requireAdmin } from '../../_lib/auth.js'
import { json } from '../../_lib/cors.js'

export async function onRequestGet({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  const url    = new URL(request.url)
  const format = url.searchParams.get('format') || 'json'
  const status = url.searchParams.get('status') || null
  const type   = url.searchParams.get('type')   || null
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '200', 10), 1000)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  let query = 'SELECT * FROM payments'
  const binds = []
  const where = []
  if (status) { where.push('status=?'); binds.push(status) }
  if (type)   { where.push('type=?');   binds.push(type)   }
  if (where.length) query += ' WHERE ' + where.join(' AND ')
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  binds.push(limit, offset)

  const { results } = await env.DB.prepare(query).bind(...binds).all()

  const { results: [commission] } = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_members,
      SUM(CASE WHEN commission_eligible=1 THEN 1 ELSE 0 END) as eligible_for_commission
    FROM subscriptions WHERE status='active'
  `).all()

  if (format === 'csv') {
    const COLS = ['id','created_at','customer_name','customer_email','amount_cents','type',
      'status','provider','provider_id','product_name','reference_code','manual_method',
      'marked_paid_at','is_first_payment','is_second_payment','lead_id']
    const esc = v => v == null ? '' : String(v).includes(',') ? `"${String(v).replace(/"/g,'""')}"` : String(v)
    const csv = [COLS.join(','), ...results.map(r => COLS.map(c => esc(r[c])).join(','))].join('\n')
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="grove-payments-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return json({ payments: results, count: results.length, commission })
}
