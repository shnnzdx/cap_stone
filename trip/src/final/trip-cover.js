const safeCoverImageUrl = value => {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!candidate || /[\n\r\t]/.test(candidate)) return null
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate

  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null
  } catch {
    return null
  }
}

// Trip covers are trip-level presentation data. They must never fall back to a
// place/activity photo because that can show the wrong city on the dashboard.
export const resolveTripCover = (trip = {}) => {
  const imageUrl = safeCoverImageUrl(trip.coverImageUrl || trip.cover_image_url)
  const attributionUrl = safeCoverImageUrl(trip.coverAttributionUrl || trip.cover_attribution_url)
  const sourceUrl = safeCoverImageUrl(trip.coverSourceUrl || trip.cover_source_url)
  const attributionName = typeof (trip.coverAttributionName || trip.cover_attribution_name) === 'string'
    ? (trip.coverAttributionName || trip.cover_attribution_name).trim()
    : ''
  const hasAttribution = Boolean(imageUrl && attributionName && attributionUrl && sourceUrl)
  return {
    imageUrl,
    kind: imageUrl ? 'image' : 'neutral',
    label: imageUrl ? `${trip.destination || 'Trip'} cover` : 'Travel cover',
    attribution: hasAttribution ? {
      name: attributionName,
      photographerUrl: attributionUrl,
      sourceUrl,
    } : null,
  }
}

export const tripCoverImageUrlForVariant = (imageUrl, variant = 'compact') => {
  const safe = safeCoverImageUrl(imageUrl)
  if (!safe) return null
  const isRelative = safe.startsWith('/')
  const parsed = new URL(safe, 'http://localhost')
  if (!['http:', 'https:'].includes(parsed.protocol)) return null
  const featured = variant === 'featured'
  parsed.searchParams.set('auto', 'format')
  parsed.searchParams.set('fit', 'crop')
  parsed.searchParams.set('crop', 'entropy')
  parsed.searchParams.set('w', featured ? '1000' : '360')
  parsed.searchParams.set('h', featured ? '560' : '220')
  parsed.searchParams.set('q', '80')
  return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString()
}
