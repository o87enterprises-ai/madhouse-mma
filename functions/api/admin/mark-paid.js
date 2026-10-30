import { requireAdmin } from '../../_lib/auth.js'
import { json } from '../../_lib/cors.js'

export async function onRequestPost({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const { referenceCode, note, leadId } = body
  if (!referenceCode) return json({ error: 'referenceCode is required' }, 400)

  const existing = await env.DB.prepare(
    `SELECT id, status FROM payments WHERE reference_code=?`
  ).bind(referenceCode).first()

  if (!existing) return json({ error: 'Payment not found' }, 404)
  if (existing.status === 'completed') return json({ error: 'Already marked as paid' }, 409)

  await env.DB.prepare(`
    UPDATE payments
    SET status='completed', marked_paid_at=datetime('now'), marked_paid_by=?,
        lead_id=COALESCE(lead_id, ?), is_first_payment=1
    WHERE reference_code=?
  `).bind(note || null, leadId || null, referenceCode).run()

  if (leadId) {
    await env.DB.prepare(
      `UPDATE leads SET status='joined', member_since=datetime('now') WHERE id=?`
    ).bind(leadId).run()
  }

  return json({ ok: true, referenceCode })
}
