const UA = { headers: { Accept: 'application/json' } }

async function getJson(url, timeout = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { ...UA, signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function fetchQuakes() {
  const data = await getJson(
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  )
  return (data.features || [])
    .map((f) => {
      const [lon, lat, depth] = f.geometry.coordinates
      return {
        id: f.id,
        mag: f.properties.mag,
        place: f.properties.place || 'Unknown',
        time: f.properties.time,
        tsunami: !!f.properties.tsunami,
        url: f.properties.url,
        lat,
        lon,
        depth: depth ?? 0,
      }
    })
    .filter((q) => q.mag != null)
    .sort((a, b) => b.mag - a.mag)
}

export async function fetchCatalog() {
  return getJson('/data/catalog.json')
}

export async function refreshStations() {
  try {
    return await getJson('/api/celestrak/stations', 8000)
  } catch {
    return null
  }
}

export async function fetchKp() {
  const rows = await getJson(
    'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
  )
  const last = rows[rows.length - 1]
  return {
    kp: last?.kp_index ?? 0,
    estimated: last?.estimated_kp ?? last?.kp_index ?? 0,
    label: last?.kp ?? String(last?.kp_index ?? '—'),
    time: last?.time_tag,
  }
}

export async function fetchSolarWind() {
  const rows = await getJson(
    'https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json',
  )
  const last = Array.isArray(rows) ? rows[rows.length - 1] : rows
  return {
    speed: last?.proton_speed ?? last?.speed ?? null,
    time: last?.time_tag,
  }
}

export async function fetchAurora() {
  const data = await getJson(
    'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
    20000,
  )
  const coords = data.coordinates || []
  const pts = []
  for (const c of coords) {
    const [lon0, lat, a] = c
    if (a < 12) continue
    let lon = lon0
    if (lon > 180) lon -= 360
    pts.push({ lon, lat, a })
  }
  return {
    time: data['Forecast Time'] || data['Observation Time'],
    points: pts,
  }
}

export async function fetchLaunches() {
  const data = await getJson(
    'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12',
  )
  return (data.results || [])
    .map((r) => {
      const pad = r.pad || {}
      const lat = pad.latitude != null ? Number(pad.latitude) : null
      const lon = pad.longitude != null ? Number(pad.longitude) : null
      return {
        id: r.id,
        name: r.name,
        net: r.net,
        status: r.status?.name || 'TBD',
        statusAbbrev: r.status?.abbrev || '',
        lsp: r.launch_service_provider?.name || r.lsp_name || '',
        pad: pad.name || '',
        location: pad.location?.name || '',
        lat,
        lon,
        image: r.image,
        mission: r.mission?.name || r.mission || '',
        orbit: r.mission?.orbit?.name || '',
      }
    })
    .filter((l) => l.lat != null && l.lon != null)
}

export async function fetchFlights() {
  const data = await getJson('/api/opensky', 15000)
  const states = data.states || []
  const out = []
  const stride = Math.max(1, Math.floor(states.length / 2800))
  for (let i = 0; i < states.length; i += stride) {
    const s = states[i]
    const lon = s[5]
    const lat = s[6]
    if (lat == null || lon == null || s[8]) continue
    out.push({
      icao: s[0],
      call: (s[1] || '').trim() || s[0],
      country: s[2],
      lon,
      lat,
      alt: s[13] || s[7] || 0,
      vel: s[9] || 0,
      track: s[10] || 0,
    })
  }
  return { total: states.length, sample: out, time: data.time }
}
