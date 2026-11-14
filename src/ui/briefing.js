import {
  describePlace,
  fmtAgo,
  dawnCities,
  fmtIST,
  HOME,
  moonPhaseName,
} from '../app/geo.js'

function kpWord(kp) {
  if (kp == null) return 'unknown'
  if (kp < 2) return 'quiet'
  if (kp < 4) return 'unsettled'
  if (kp < 5) return 'active'
  if (kp < 7) return 'storm conditions'
  return 'severe storm'
}

export function writeBriefing(data) {
  const now = new Date()
  const quakes = data.quakes || []
  const strongest = quakes[0]
  const launches = data.launches || []
  const upcoming = launches.find((l) => new Date(l.net) > now) || launches[0]
  const iss = data.iss
  const kp = data.kp
  const sw = data.solarWind?.speed
  const flights = data.flightsCount

  const parts = []
  parts.push(
    `<p>Public feeds at <b>${now.toISOString().slice(11, 19)} UTC</b> · <b>${fmtIST(now)} IST</b>. Nothing here is classified.</p>`,
  )

  const dawn = dawnCities(now)
  parts.push(`<h4>DAWN LINE</h4>`)
  parts.push(
    dawn.length
      ? `<p>Sunrise is crossing <b>${dawn.join(' · ')}</b> this minute — cities on the dawn terminator.</p>`
      : `<p>Dawn is over open ocean this minute.</p>`,
  )

  const pass = (data.passes || [])[0]
  const look = data.look
  parts.push(`<h4>BEACON · ${HOME.name.toUpperCase()}</h4>`)
  if (look?.visible) {
    parts.push(
      `<p><b>ISS is visible over ${HOME.name} right now</b> — ${look.el.toFixed(0)}° elevation, ${look.azName}, ${look.range.toFixed(0)} km. Look ${look.azName} of the zenith.</p>`,
    )
  } else if (pass) {
    const when = new Date(pass.tmax)
    parts.push(
      `<p>Next ISS over ${HOME.name}: <b>${fmtIST(when)} IST</b>, max ${pass.maxEl.toFixed(0)}° ${pass.azName || ''} of zenith. Press <kbd>G</kbd> home, <kbd>P</kbd> to ride the pass.</p>`,
    )
  } else {
    parts.push(`<p>Computing ISS look-angles over ${HOME.name} from the live TLE…</p>`)
  }

  if (data.moon) {
    parts.push(`<h4>MOON</h4>`)
    parts.push(
      `<p>${moonPhaseName(data.moon.illum)} · ${Math.round(data.moon.illum * 100)}% lit. Sub-lunar point over <b>${describePlace(data.moon.lat, data.moon.lon)}</b>.</p>`,
    )
  }

  if (data.pulse != null) {
    parts.push(`<h4>PLANET PULSE</h4>`)
    parts.push(
      `<p>Seismic energy index <b>${data.pulse}</b> — the atmosphere glow is driven by real USGS magnitudes, not a texture loop.</p>`,
    )
  }

  parts.push(`<h4>SPACE WEATHER</h4>`)
  if (kp) {
    parts.push(
      `<p>Geomagnetic field is <b>${kpWord(kp.kp)}</b> (Kp ${kp.label}). ${
        kp.kp < 3
          ? 'The auroral oval is contracted toward the poles.'
          : 'Aurora may spill to lower latitudes tonight.'
      }${sw ? ` Solar wind ~${Math.round(sw)} km/s.` : ''}</p>`,
    )
  } else {
    parts.push(`<p>Waiting on NOAA SWPC.</p>`)
  }

  parts.push(`<h4>ORBITAL</h4>`)
  if (iss) {
    parts.push(
      `<p>ISS is over <b>${describePlace(iss.lat, iss.lon)}</b> at ${iss.alt.toFixed(0)} km, ${iss.vel.toFixed(2)} km/s. ${
        data.tiangong
          ? `Tiangong is over ${describePlace(data.tiangong.lat, data.tiangong.lon)}.`
          : ''
      } Catalog: ${data.catalogCount || '—'} objects propagated with SGP4. Teal ribbon is the next 92 minutes of ground track.</p>`,
    )
  } else {
    parts.push(`<p>Propagating the CelesTrak snapshot…</p>`)
  }

  parts.push(`<h4>SEISMIC</h4>`)
  if (strongest) {
    parts.push(
      `<p>${quakes.length} events M2.5+ in 24h. Strongest: <b>M${strongest.mag.toFixed(1)}</b> · ${strongest.place} · ${fmtAgo(Date.now() - strongest.time)}.</p>`,
    )
  } else {
    parts.push(`<p>USGS feed not in yet.</p>`)
  }

  parts.push(`<h4>LAUNCH WINDOW</h4>`)
  if (upcoming) {
    const when = new Date(upcoming.net)
    const delta = when - now
    const eta =
      delta > 0
        ? `T−${Math.max(0, Math.round(delta / 3600000))}h`
        : `T+${Math.round(-delta / 3600000)}h`
    parts.push(
      `<p>Next on the board: <b>${upcoming.name}</b> · ${upcoming.status} · ${eta} · ${upcoming.location || upcoming.pad}.</p>`,
    )
  } else {
    parts.push(`<p>Launch Library is quiet or unreachable.</p>`)
  }

  if (flights != null) {
    parts.push(`<h4>AIR PICTURE</h4>`)
    parts.push(
      `<p>${flights.toLocaleString()} airborne contacts from OpenSky (sampled on the globe). Positions are public ADS-B, not radar.</p>`,
    )
  }

  return parts.join('')
}
