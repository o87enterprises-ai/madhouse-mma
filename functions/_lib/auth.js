// Returns null if authorized, or a 401 Response if not.
export function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return new Response('ADMIN_TOKEN not configured', { status: 401 })
  const header = request.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (token !== env.ADMIN_TOKEN) return new Response('Unauthorized', { status: 401 })
  return null
}
