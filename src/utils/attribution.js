const KEY = 'mh_attr'

// Call on app mount. Reads UTMs from the current URL and persists them on
// first touch only — subsequent visits without UTMs don't overwrite the record.
export function captureAttribution() {
  try {
    const params = new URLSearchParams(window.location.search)
    const hasUtm = params.has('utm_source') || params.has('gclid') || params.has('fbclid')

    const current = {
      utm_source:   params.get('utm_source'),
      utm_medium:   params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_term:     params.get('utm_term'),
      utm_content:  params.get('utm_content'),
      gclid:        params.get('gclid'),
      fbclid:       params.get('fbclid'),
      referrer:     document.referrer || null,
      landing_path: window.location.pathname + window.location.search,
      first_visit:  new Date().toISOString(),
    }

    const stored = getAttribution()
    // Overwrite only if this is first visit or this visit brought tracked params
    if (!stored || hasUtm) {
      localStorage.setItem(KEY, JSON.stringify(current))
      return current
    }
    return stored
  } catch {
    return {}
  }
}

export function getAttribution() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
