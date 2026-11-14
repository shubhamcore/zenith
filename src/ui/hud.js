import { LAYERS } from '../app/state.js'
import {
  fmtLatLon,
  fmtKm,
  describePlace,
  fmtAgo,
  fmtIST,
  fmtCountdown,
  azName,
  moonPhaseName,
} from '../app/geo.js'
import { writeBriefing } from './briefing.js'

function on(id, ev, fn) {
  document.getElementById(id)?.addEventListener(ev, fn)
}

function el(id) {
  return document.getElementById(id)
}

export function bindHud(state, handlers) {
  const layersEl = el('layers')
  layersEl.innerHTML = LAYERS.map(
    (l) => `
    <button class="layer" data-layer="${l.id}">
      <span class="swatch" style="background:${l.color};color:${l.color}"></span>
      <span>${l.label}</span>
      <span class="count" data-count="${l.id}"></span>
    </button>`,
  ).join('')

  layersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.layer')
    if (!btn) return
    handlers.toggleLayer(btn.dataset.layer)
  })

  el('modes')?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]')
    if (b) handlers.setMode(b.dataset.mode)
  })

  el('events')?.addEventListener('click', (e) => {
    const b = e.target.closest('.event')
    if (b) handlers.openEvent(b.dataset.kind, b.dataset.id)
  })

  el('keys-close')?.addEventListener('click', () => {
    el('keys')?.classList.add('hidden')
  })

  on('chip-kp', 'click', () => handlers.setMode('terminator'))
  on('chip-qk', 'click', () => handlers.nextQuake())
  on('chip-sat', 'click', () => handlers.setMode('iss'))
  on('btn-shot', 'click', () => handlers.snapshot?.())
  on('chip-pulse', 'click', () => handlers.flyHome?.())
  on('pass-ribbon', 'click', () => handlers.ridePass?.())

  let toastTimer = 0

  return {
    setBoot(p, msg) {
      const fill = el('boot-fill')
      if (fill) fill.style.width = `${p * 100}%`
      if (msg && el('boot-sub')) el('boot-sub').textContent = msg
    },
    hideBoot() {
      el('boot')?.classList.add('out')
    },
    clock(d) {
      const utc = el('clock-utc')
      const meta = el('clock-date')
      if (utc) utc.textContent = d.toISOString().slice(11, 19)
      if (meta) {
        meta.textContent =
          d.toISOString().slice(0, 10).replace(/-/g, ' · ') +
          '  UTC  ·  ' +
          fmtIST(d) +
          ' IST'
      }
    },
    vitals(s) {
      const set = (id, v) => {
        const n = el(id)
        if (n) n.textContent = v
      }
      set('val-kp', s.data.kp?.label ?? '—')
      set('val-sw', s.data.solarWind?.speed ? `${Math.round(s.data.solarWind.speed)}` : '—')
      set('val-qk', s.data.quakes.length || '—')
      set('val-sat', s.counts.sats ?? '—')
      set('val-pulse', s.data.pulse ?? '—')
    },
    layers(s) {
      for (const l of LAYERS) {
        const btn = layersEl.querySelector(`[data-layer="${l.id}"]`)
        if (!btn) continue
        btn.classList.toggle('off', !s.layers[l.id])
        const c = btn.querySelector('.count')
        const n = s.counts[l.id]
        if (c) c.textContent = n == null ? '' : n
      }
    },
    modes(mode) {
      for (const b of document.querySelectorAll('#modes button')) {
        b.classList.toggle('on', b.dataset.mode === mode)
      }
      const tm = el('track-mode')
      if (tm) tm.textContent = mode === 'free' ? 'free camera' : mode
      el('app')?.classList.toggle('cinema', mode === 'cinema')
    },
    events(s) {
      const items = []
      const pass = (s.data.passes || [])[0]
      if (pass) {
        items.push({
          kind: 'home',
          id: 'bihta',
          k: 'BIHTA',
          t: `ISS pass · ${pass.maxEl.toFixed(0)}° el · ${pass.azName || azName(pass.az || 0)}`,
          s: fmtIST(new Date(pass.tmax)) + ' IST',
        })
      }
      const q = s.data.quakes[0]
      if (q) {
        items.push({
          kind: 'quake',
          id: q.id,
          k: `M${q.mag.toFixed(1)}`,
          t: q.place,
          s: fmtAgo(Date.now() - q.time),
        })
      }
      if (s.data.iss) {
        items.push({
          kind: 'iss',
          id: 'iss',
          k: 'ISS',
          t: describePlace(s.data.iss.lat, s.data.iss.lon),
          s: `${s.data.iss.alt.toFixed(0)} km`,
        })
      }
      const now = Date.now()
      const L = s.data.launches.find((x) => new Date(x.net).getTime() > now) || s.data.launches[0]
      if (L) {
        items.push({
          kind: 'launch',
          id: L.id,
          k: L.statusAbbrev || 'LAUNCH',
          t: L.name,
          s: L.location || L.pad,
        })
      }
      const q2 = s.data.quakes[1]
      if (q2) {
        items.push({
          kind: 'quake',
          id: q2.id,
          k: `M${q2.mag.toFixed(1)}`,
          t: q2.place,
          s: fmtAgo(Date.now() - q2.time),
        })
      }
      const ec = el('events-count')
      if (ec) ec.textContent = `${s.data.quakes.length} quakes`
      const box = el('events')
      if (box) {
        box.innerHTML = items
          .map(
            (it) => `
        <button class="event" data-kind="${it.kind}" data-id="${it.id}">
          <div class="k">${it.k}</div>
          <div class="t">${it.t}</div>
          <div class="s">${it.s}</div>
        </button>`,
          )
          .join('')
      }
    },
    track(obj) {
      const card = el('track-card')
      if (!card) return
      if (!obj) {
        card.innerHTML =
          '<div class="track-empty">Click a satellite, quake, or launch — or press <kbd>2</kbd> to ride the ISS.</div>'
        return
      }
      card.innerHTML = `
        <h3>${obj.title}</h3>
        <div class="kv">
          ${obj.rows.map((r) => `<span>${r.k}</span><b>${r.v}</b>`).join('')}
        </div>`
    },
    briefing(s) {
      const b = el('briefing')
      if (!b) return
      b.innerHTML = writeBriefing({
        ...s.data,
        catalogCount: s.counts.sats,
        flightsCount: s.counts.flightsTotal,
      })
    },
    telemetry(info, sun) {
      const a = el('t-look')
      const b = el('t-alt')
      const c = el('t-sun')
      if (a) a.textContent = fmtLatLon(info.lat, info.lon)
      if (b) b.textContent = fmtKm(info.alt)
      if (c) c.textContent = fmtLatLon(sun.lat, sun.lon)
    },
    pass(s, now) {
      const ribbon = el('pass-ribbon')
      if (!ribbon) return
      const eta = el('pass-eta')
      const meta = el('pass-meta')
      const look = s.data.look
      const pass = (s.data.passes || [])[0]
      ribbon.classList.toggle('live', !!(look && look.visible))
      if (look?.visible) {
        if (eta) eta.textContent = 'LIVE'
        if (meta) {
          meta.textContent = `${look.el.toFixed(0)}° el · ${look.azName} · ${look.range.toFixed(0)} km`
        }
        return
      }
      if (pass) {
        if (eta) eta.textContent = fmtCountdown(pass.t0 - now.getTime())
        if (meta) {
          meta.textContent = `${pass.maxEl.toFixed(0)}° max · ${pass.azName || ''} · ${fmtIST(new Date(pass.tmax))} IST`
        }
        return
      }
      if (eta) eta.textContent = 'T−—'
      if (meta) meta.textContent = 'computing ISS look-angles'
    },
    toast(msg) {
      const n = el('toast')
      if (!n) return
      n.textContent = msg
      n.classList.remove('hidden')
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => n.classList.add('hidden'), 2400)
    },
    keys(open) {
      el('keys')?.classList.toggle('hidden', !open)
    },
    hud(on) {
      el('app')?.classList.toggle('hud-off', !on)
    },
  }
}

export function trackView(kind, payload, extra) {
  if (kind === 'iss' || kind === 'station') {
    const p = payload
    const rows = [
      { k: 'WHERE', v: describePlace(p.lat, p.lon) },
      { k: 'LAT/LON', v: fmtLatLon(p.lat, p.lon) },
      { k: 'ALT', v: `${p.alt.toFixed(1)} km` },
      { k: 'VEL', v: `${p.vel.toFixed(2)} km/s` },
    ]
    if (extra?.look) {
      rows.push({
        k: 'BIHTA',
        v: extra.look.visible
          ? `${extra.look.el.toFixed(0)}° ${extra.look.azName}`
          : 'below horizon',
      })
    }
    return { title: p.name || 'Station', rows }
  }
  if (kind === 'quake') {
    const q = payload
    return {
      title: `M${q.mag.toFixed(1)}`,
      rows: [
        { k: 'PLACE', v: q.place },
        { k: 'LAT/LON', v: fmtLatLon(q.lat, q.lon) },
        { k: 'DEPTH', v: `${q.depth.toFixed(0)} km` },
        { k: 'WHEN', v: fmtAgo(Date.now() - q.time) },
      ],
    }
  }
  if (kind === 'launch') {
    const L = payload
    return {
      title: L.name,
      rows: [
        { k: 'STATUS', v: L.status },
        { k: 'NET', v: new Date(L.net).toISOString().slice(0, 16).replace('T', ' ') + 'Z' },
        { k: 'PAD', v: L.pad || '—' },
        { k: 'SITE', v: L.location || '—' },
      ],
    }
  }
  if (kind === 'sat') {
    const s = payload
    return {
      title: s.o.OBJECT_NAME,
      rows: [
        { k: 'CLASS', v: s.klass },
        { k: 'NORAD', v: String(s.o.NORAD_CAT_ID) },
        { k: 'LAT/LON', v: s.pos ? fmtLatLon(s.pos.lat, s.pos.lon) : '—' },
        { k: 'ALT', v: s.pos ? `${s.pos.alt.toFixed(0)} km` : '—' },
      ],
    }
  }
  if (kind === 'flight') {
    const f = payload
    return {
      title: f.call,
      rows: [
        { k: 'COUNTRY', v: f.country || '—' },
        { k: 'LAT/LON', v: fmtLatLon(f.lat, f.lon) },
        { k: 'ALT', v: `${Math.round(f.alt)} m` },
        { k: 'SPD', v: `${Math.round((f.vel || 0) * 3.6)} km/h` },
      ],
    }
  }
  if (kind === 'moon') {
    const m = payload
    return {
      title: `Moon · ${moonPhaseName(m.illum)}`,
      rows: [
        { k: 'PHASE', v: `${Math.round(m.illum * 100)}% lit` },
        { k: 'SUBPOINT', v: fmtLatLon(m.lat, m.lon) },
        { k: 'WHERE', v: describePlace(m.lat, m.lon) },
      ],
    }
  }
  return null
}
