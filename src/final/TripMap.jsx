import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const NOMINATIM_CACHE_KEY = 'tripsync:nominatim-cache'
const NOMINATIM_DELAY_MS = 1100

let geocodeChain = Promise.resolve()
let lastGeocodeAt = 0

const readCache = () => {
  try {
    return JSON.parse(window.localStorage.getItem(NOMINATIM_CACHE_KEY)) || {}
  } catch {
    return {}
  }
}

const writeCache = cache => {
  try {
    window.localStorage.setItem(NOMINATIM_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Cache is best-effort. The map still works with provided coords.
  }
}

const sleep = ms => new Promise(resolve => window.setTimeout(resolve, ms))

const geocodePlace = ({ place, destination }) => {
  const query = [place, destination].filter(Boolean).join(', ')
  if (!query) return Promise.resolve(null)

  geocodeChain = geocodeChain.then(async () => {
    const cache = readCache()
    if (cache[query]) return cache[query]

    const wait = Math.max(0, NOMINATIM_DELAY_MS - (Date.now() - lastGeocodeAt))
    if (wait) await sleep(wait)
    lastGeocodeAt = Date.now()

    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      q: query,
    })
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Nominatim failed: ${response.status}`)
    const [match] = await response.json()
    if (!match) return null
    const coords = [Number(match.lat), Number(match.lon)]
    writeCache({ ...cache, [query]: coords })
    return coords
  }).catch(() => null)

  return geocodeChain
}

const flattenDays = days => {
  let globalIndex = 0
  return days.flatMap(day => day.items.map((item, index) => ({
    ...item,
    dayLabel: day.label,
    dayDate: day.date,
    stopNumber: days.length > 1 ? ++globalIndex : index + 1,
  })))
}

const markerIcon = (item, selected) => L.divIcon({
  className: `leafletTripMarker${selected ? ' selected' : ''}`,
  html: `<span><b>${item.stopNumber}</b></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 26],
})

const curvedRoute = points => {
  if (points.length < 2) return points
  return points.slice(0, -1).flatMap((start, index) => {
    const end = points[index + 1]
    const direction = index % 2 === 0 ? 1 : -1
    const dx = end[1] - start[1]
    const dy = end[0] - start[0]
    const control = [
      (start[0] + end[0]) / 2 - dx * 0.18 * direction,
      (start[1] + end[1]) / 2 + dy * 0.18 * direction,
    ]
    return Array.from({ length: 18 }, (_, step) => {
      const t = step / 18
      const oneMinus = 1 - t
      return [
        oneMinus * oneMinus * start[0] + 2 * oneMinus * t * control[0] + t * t * end[0],
        oneMinus * oneMinus * start[1] + 2 * oneMinus * t * control[1] + t * t * end[1],
      ]
    })
  }).concat([points[points.length - 1]])
}

export default function TripMap({ days, destination, selectedItemId, onSelectItem, compact = false, variant = 'sketch' }) {
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const containerRef = useRef(null)
  const baseItems = useMemo(() => flattenDays(days), [days])
  const [resolvedCoords, setResolvedCoords] = useState({})

  useEffect(() => {
    let cancelled = false
    const missing = baseItems.filter(item => !item.coords && !resolvedCoords[item.id])
    missing.forEach(item => {
      geocodePlace({ place: item.place, destination }).then(coords => {
        if (!cancelled && coords) setResolvedCoords(current => ({ ...current, [item.id]: coords }))
      })
    })
    return () => { cancelled = true }
  }, [baseItems, destination, resolvedCoords])

  const mappedItems = useMemo(() => baseItems
    .map(item => ({ ...item, coords: item.coords || resolvedCoords[item.id] }))
    .filter(item => Array.isArray(item.coords) && item.coords.length === 2),
  [baseItems, resolvedCoords])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: !compact,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: !compact,
      doubleClickZoom: !compact,
      boxZoom: !compact,
      keyboard: !compact,
      tap: !compact,
    })
    map.attributionControl.setPrefix(false)
    if (variant === 'real') {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
    } else {
      map.attributionControl.addAttribution('Geocoding &copy; OpenStreetMap contributors')
    }
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [compact, variant])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    window.setTimeout(() => map.invalidateSize(), 80)
    layer.clearLayers()

    if (!mappedItems.length) {
      map.setView([41.8781, -87.6298], 12)
      return
    }

    const points = mappedItems.map(item => item.coords)
    mappedItems.forEach(item => {
      L.marker(item.coords, { icon: markerIcon(item, item.id === selectedItemId) })
        .addTo(layer)
        .bindTooltip(`${item.time} · ${item.title}`, {
          className: 'handDrawnMapLabel',
          direction: compact ? 'top' : 'right',
          offset: compact ? [0, -20] : [16, -16],
          permanent: !compact,
        })
        .on('click', () => onSelectItem?.(item.id))
    })

    if (points.length > 1) L.polyline(curvedRoute(points), {
      className: 'handDrawnRouteLine',
      color: '#2f2a22',
      weight: compact ? 2 : 3,
      opacity: variant === 'real' ? 0.78 : 0.62,
      dashArray: variant === 'real' ? '6 8' : '8 10',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer)

    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: compact ? [20, 20] : [34, 34], maxZoom: compact ? 14 : 13 })
  }, [compact, mappedItems, onSelectItem, selectedItemId, variant])

  return <div className={cx('tripLeafletMap', variant === 'real' ? 'realMap' : 'handDrawn', compact && 'compact')} ref={containerRef}/>
}

const cx = (...classes) => classes.filter(Boolean).join(' ')
