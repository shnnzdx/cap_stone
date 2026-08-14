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
  return {
    imageUrl,
    kind: imageUrl ? 'image' : 'neutral',
    label: imageUrl ? `${trip.destination || 'Trip'} cover` : 'Travel cover',
  }
}

