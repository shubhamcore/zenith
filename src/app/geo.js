import * as THREE from 'three'

export const DEG = Math.PI / 180
export const EARTH_RADIUS = 1.6

export function latLonToVec3(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * DEG
  const theta = (lon + 180) * DEG
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

export function vec3ToLatLon(v) {
  const r = v.length() || 1
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(v.y / r, -1, 1)) / DEG
  let lon = Math.atan2(v.z, -v.x) / DEG - 180
  if (lon < -180) lon += 360
  if (lon > 180) lon -= 360
  return { lat, lon }
}

/** Approximate subsolar point for a UTC date. */
export function subsolar(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const day = (date.getTime() - start) / 86400000
  const decl = -23.44 * Math.cos((360 / 365) * (day + 10) * DEG)
  const utc =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lon = 15 * (utc - 12)
  let L = ((lon + 180) % 360) - 180
  if (L < -180) L += 360
  return { lat: decl, lon: L }
}

export function sunDirection(date) {
  const s = subsolar(date)
  return latLonToVec3(s.lat, s.lon, 1)
}

export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5
}

function wrap360(x) {
  return ((x % 360) + 360) % 360
}

export function wrapLon(lon) {
  let L = ((lon + 180) % 360) - 180
  if (L < -180) L += 360
  return L
}

function lonDelta(a, b) {
  return Math.abs(wrapLon(a - b))
}

/**
 * Low-precision geocentric Moon (Meeus-lite). Good enough to put a
 * correctly-phased Moon in the sky and a sub-lunar point on Earth.
 */
export function moonPole(date = new Date()) {
  const T = (julianDate(date) - 2451545.0) / 36525
  const Lp = (218.3164477 + 481267.88123421 * T) * DEG
  const M = (134.9633964 + 477198.8675055 * T) * DEG
  const F = (93.272095 + 483202.0175233 * T) * DEG
  const lon = Lp + 6.289 * DEG * Math.sin(M)
  const lat = 5.128 * DEG * Math.sin(F)
  const eps = 23.439291 * DEG
  const cl = Math.cos(lat)
  const x = cl * Math.cos(lon)
  const y = Math.cos(eps) * cl * Math.sin(lon) - Math.sin(eps) * Math.sin(lat)
  const z = Math.sin(eps) * cl * Math.sin(lon) + Math.cos(eps) * Math.sin(lat)
  const ra = Math.atan2(y, x)
  const dec = Math.asin(Math.max(-1, Math.min(1, z)))
  const d = julianDate(date) - 2451545.0
  const gmst = wrap360(280.46061837 + 360.98564736629 * d) * DEG
  const moonLat = dec / DEG
  const moonLon = wrapLon((ra - gmst) / DEG)
  const sun = subsolar(date)
  const s = latLonToVec3(sun.lat, sun.lon, 1)
  const m = latLonToVec3(moonLat, moonLon, 1)
  const elong = Math.acos(THREE.MathUtils.clamp(s.dot(m), -1, 1))
  const illum = 0.5 * (1 - Math.cos(elong))
  return { lat: moonLat, lon: moonLon, illum, elong }
}

export function moonPhaseName(illum) {
  if (illum < 0.03) return 'New'
  if (illum < 0.35) return 'Crescent'
  if (illum < 0.65) return 'Quarter'
  if (illum < 0.97) return 'Gibbous'
  return 'Full'
}

export function fmtLatLon(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns}  ${Math.abs(lon).toFixed(2)}°${ew}`
}

const OCEANS = [
  { name: 'the Arctic Ocean', lat: [70, 90], lon: [-180, 180] },
  { name: 'the Southern Ocean', lat: [-90, -55], lon: [-180, 180] },
  { name: 'the North Atlantic', lat: [0, 70], lon: [-80, 0] },
  { name: 'the South Atlantic', lat: [-55, 0], lon: [-70, 20] },
  { name: 'the North Pacific', lat: [0, 65], lon: [140, 180] },
  { name: 'the North Pacific', lat: [0, 65], lon: [-180, -100] },
  { name: 'the South Pacific', lat: [-55, 0], lon: [150, 180] },
  { name: 'the South Pacific', lat: [-55, 0], lon: [-180, -70] },
  { name: 'the Indian Ocean', lat: [-55, 25], lon: [40, 120] },
]

const LAND = [
  { name: 'Greenland', lat: [60, 84], lon: [-73, -12] },
  { name: 'Alaska', lat: [54, 72], lon: [-170, -130] },
  { name: 'Canada', lat: [49, 70], lon: [-140, -55] },
  { name: 'the contiguous United States', lat: [25, 49], lon: [-125, -67] },
  { name: 'Mexico', lat: [15, 32], lon: [-117, -87] },
  { name: 'Central America', lat: [7, 18], lon: [-93, -77] },
  { name: 'the Caribbean', lat: [10, 27], lon: [-85, -59] },
  { name: 'Brazil', lat: [-34, 5], lon: [-74, -35] },
  { name: 'the Andes', lat: [-45, 10], lon: [-80, -62] },
  { name: 'West Africa', lat: [4, 20], lon: [-18, 15] },
  { name: 'the Sahara', lat: [16, 32], lon: [-16, 35] },
  { name: 'Southern Africa', lat: [-35, -10], lon: [10, 41] },
  { name: 'East Africa', lat: [-12, 12], lon: [28, 52] },
  { name: 'Europe', lat: [36, 71], lon: [-10, 40] },
  { name: 'the Mediterranean', lat: [30, 45], lon: [-6, 36] },
  { name: 'the Middle East', lat: [12, 42], lon: [34, 62] },
  { name: 'Central Asia', lat: [35, 55], lon: [50, 87] },
  { name: 'Siberia', lat: [50, 75], lon: [60, 180] },
  { name: 'the Indian subcontinent', lat: [6, 36], lon: [68, 97] },
  { name: 'Southeast Asia', lat: [-8, 22], lon: [95, 130] },
  { name: 'China', lat: [22, 50], lon: [100, 125] },
  { name: 'Japan', lat: [30, 46], lon: [128, 146] },
  { name: 'Australia', lat: [-44, -11], lon: [113, 154] },
  { name: 'New Zealand', lat: [-47, -34], lon: [166, 179] },
  { name: 'Antarctica', lat: [-90, -63], lon: [-180, 180] },
]

export function describePlace(lat, lon) {
  for (const b of LAND) {
    if (lat >= b.lat[0] && lat <= b.lat[1] && lon >= b.lon[0] && lon <= b.lon[1]) {
      return b.name
    }
  }
  for (const b of OCEANS) {
    if (lat >= b.lat[0] && lat <= b.lat[1] && lon >= b.lon[0] && lon <= b.lon[1]) {
      return b.name
    }
  }
  return 'open ocean'
}

export function fmtKm(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k km`
  return `${n.toFixed(0)} km`
}

export const HOME = { name: 'Bihta', lat: 25.561, lon: 84.87 }

const CITIES = [
  { name: 'Bihta', lat: 25.56, lon: 84.87 },
  { name: 'Patna', lat: 25.61, lon: 85.14 },
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36 },
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Lagos', lat: 6.52, lon: 3.38 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Moscow', lat: 55.76, lon: 37.62 },
]

/** Cities sitting on the sunrise line right now. */
export function dawnCities(date = new Date()) {
  const sun = subsolar(date)
  const dawnLon = wrapLon(sun.lon - 90)
  return CITIES.filter((c) => lonDelta(c.lon, dawnLon) < 14).map((c) => c.name)
}

export function fmtIST(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function fmtAgo(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function fmtCountdown(ms) {
  const sign = ms < 0 ? '+' : '−'
  const s = Math.abs(Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const body =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`
  return `T${sign}${body}`
}

export function azName(deg) {
  const dirs = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ]
  const i = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16
  return dirs[i]
}

/** Local small-circle around a lat/lon, radius in km. */
export function smallCircle(lat, lon, radiusKm, n = 72, radius = EARTH_RADIUS + 0.01) {
  const d = radiusKm / 6371
  const lat1 = lat * DEG
  const lon1 = lon * DEG
  const pts = []
  for (let i = 0; i <= n; i++) {
    const brng = (i / n) * Math.PI * 2
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
    )
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      )
    pts.push(latLonToVec3(lat2 / DEG, lon2 / DEG, radius))
  }
  return pts
}
