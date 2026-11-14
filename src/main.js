import './style.css'
import { createState } from './app/state.js'
import {
  EARTH_RADIUS,
  latLonToVec3,
  subsolar,
  HOME,
  fmtIST,
  fmtLatLon,
} from './app/geo.js'
import { createEngine } from './scene/engine.js'
import { createQuakes } from './viz/quakes.js'
import { createCraft } from './viz/craft.js'
import { createAurora } from './viz/aurora.js'
import { createFlights } from './viz/flights.js'
import { createLaunches } from './viz/launches.js'
import {
  fetchQuakes,
  fetchCatalog,
  fetchKp,
  fetchSolarWind,
  fetchAurora,
  fetchLaunches,
  fetchFlights,
  refreshStations,
} from './data/sources.js'
import { bindHud, trackView } from './ui/hud.js'

const state = createState()
const engine = createEngine(document.getElementById('globe'))
const quakes = createQuakes()
const craft = createCraft()
const aurora = createAurora()
const flights = createFlights()
const launches = createLaunches()

engine.layers.add(quakes.group)
engine.layers.add(craft.group)
engine.layers.add(aurora.group)
engine.layers.add(flights.group)
engine.layers.add(launches.group)

let keysOpen = false
let cinemaTimer = 0
let cinemaIndex = 0
let lastSatUpdate = 0
let lastEventsSec = -1
let lastPassSec = -1
let pointerDown = null
let briefedIss = false
let lastHover = 0

const hud = bindHud(state, {
  toggleLayer,
  setMode,
  openEvent,
  nextQuake,
  flyHome,
  snapshot,
  ridePass,
})

try {
  craft.addBeacon(HOME.lat, HOME.lon)
} catch (e) {
  console.warn(e)
}

function toggleLayer(id) {
  state.layers[id] = !state.layers[id]
  applyLayers()
  hud.layers(state)
}

function applyLayers() {
  engine.earth.setClouds(state.layers.clouds)
  quakes.group.visible = state.layers.quakes
  aurora.group.visible = state.layers.aurora
  flights.group.visible = state.layers.flights
  launches.group.visible = state.layers.launches
  craft.setVisible({
    sats: state.layers.sats,
    iss: state.layers.iss,
    orbits: state.layers.orbits,
  })
}

function setMode(mode) {
  state.mode = mode
  state.paused = false
  engine.controls.autoRotate = mode === 'cinema' || mode === 'free'
  engine.controls.autoRotateSpeed = mode === 'cinema' ? 0.35 : 0.18
  if (mode === 'iss' && state.data.iss) {
    state.track = { kind: 'iss', payload: state.data.iss }
    hud.track(trackView('iss', state.data.iss, { look: state.data.look }))
  }
  if (mode === 'free') {
    engine.controls.enabled = true
  }
  hud.modes(mode)
}

function openEvent(kind, id) {
  if (kind === 'iss') {
    setMode('iss')
    return
  }
  if (kind === 'home') {
    flyHome()
    return
  }
  if (kind === 'quake') {
    const q = state.data.quakes.find((x) => x.id === id)
    if (!q) return
    state.track = { kind: 'quake', payload: q }
    hud.track(trackView('quake', q))
    setMode('free')
    engine.flyTo(q.lat, q.lon, 2.15, 1400)
  }
  if (kind === 'launch') {
    const L = state.data.launches.find((x) => x.id === id)
    if (!L) return
    state.track = { kind: 'launch', payload: L }
    hud.track(trackView('launch', L))
    setMode('free')
    engine.flyTo(L.lat, L.lon, 2.2, 1400)
  }
}

function nextQuake() {
  if (!state.data.quakes.length) return
  const cur = state.track?.kind === 'quake' ? state.track.payload.id : null
  const i = Math.max(0, state.data.quakes.findIndex((q) => q.id === cur))
  const q = state.data.quakes[(i + 1) % state.data.quakes.length]
  openEvent('quake', q.id)
}

function flyHome() {
  setMode('free')
  engine.flyTo(HOME.lat, HOME.lon, 2.2, 1400)
}

function snapshot() {
  try {
    const src = engine.renderer.domElement
    const c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const ctx = c.getContext('2d')
    ctx.drawImage(src, 0, 0)
    const top = ctx.createLinearGradient(0, 0, 0, 96)
    top.addColorStop(0, 'rgba(5,5,8,0.78)')
    top.addColorStop(1, 'rgba(5,5,8,0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, c.width, 96)
    const bot = ctx.createLinearGradient(0, c.height - 90, 0, c.height)
    bot.addColorStop(0, 'rgba(5,5,8,0)')
    bot.addColorStop(1, 'rgba(5,5,8,0.78)')
    ctx.fillStyle = bot
    ctx.fillRect(0, c.height - 90, c.width, 90)
    ctx.fillStyle = '#e8e4dc'
    ctx.font = '700 28px system-ui, sans-serif'
    ctx.fillText('ZENITH', 32, 44)
    ctx.font = '12px ui-monospace, Menlo, monospace'
    ctx.fillStyle = '#e2c48e'
    const now = new Date()
    const info = engine.cameraInfo()
    ctx.fillText(fmtLatLon(info.lat, info.lon), 32, c.height - 48)
    ctx.fillText(
      `${now.toISOString().slice(0, 19).replace('T', ' ')} UTC  ·  ${fmtIST(now)} IST  ·  public telemetry`,
      32,
      c.height - 28,
    )
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `zenith-${Date.now()}.png`
    a.click()
    hud.toast('Snapshot saved')
  } catch (e) {
    console.warn(e)
    hud.toast('Snapshot failed')
  }
}

function ridePass() {
  const p = state.data.passes?.[0]
  const now = Date.now()
  if (p && now >= p.t0 && now <= p.tmax + 8 * 60000) {
    setMode('iss')
    return
  }
  flyHome()
}

function nextLaunch() {
  if (!state.data.launches.length) return
  const cur = state.track?.kind === 'launch' ? state.track.payload.id : null
  const i = Math.max(0, state.data.launches.findIndex((l) => l.id === cur))
  const L = state.data.launches[(i + 1) % state.data.launches.length]
  openEvent('launch', L.id)
}

function applyTrackCamera(now) {
  if (state.mode === 'iss' && state.data.iss) {
    const p = state.data.iss
    const r = EARTH_RADIUS * (1 + p.alt / 6371) + 0.55
    const v = latLonToVec3(p.lat, p.lon, r)
    engine.lookFrom(v, 0.08)
    engine.controls.enabled = false
    hud.track(trackView('iss', p, { look: state.data.look }))
    return
  }
  if (state.mode === 'terminator') {
    const s = subsolar(now)
    const v = latLonToVec3(s.lat, s.lon + 90, 3.1)
    engine.lookFrom(v, 0.05)
    engine.controls.enabled = false
    return
  }
  engine.controls.enabled = true
}

function cinemaStep(dt) {
  if (state.mode !== 'cinema' || state.paused) return
  cinemaTimer += dt
  if (cinemaTimer < 7) return
  cinemaTimer = 0
  const stops = []
  if (state.data.iss) stops.push(() => setMode('iss'))
  if (state.data.quakes[cinemaIndex % 3]) {
    const q = state.data.quakes[cinemaIndex % Math.min(5, state.data.quakes.length)]
    stops.push(() => openEvent('quake', q.id))
  }
  if (state.data.launches[0]) {
    stops.push(() => openEvent('launch', state.data.launches[0].id))
  }
  stops.push(() => {
    state.mode = 'cinema'
    hud.modes('cinema')
    engine.controls.autoRotate = true
    engine.flyTo(HOME.lat, HOME.lon + cinemaIndex * 40, 4.2, 2000)
  })
  const fn = stops[cinemaIndex % stops.length]
  cinemaIndex++
  fn()
  state.mode = 'cinema'
  hud.modes('cinema')
}

function onPointer(ev) {
  const rect = engine.renderer.domElement.getBoundingClientRect()
  const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
  const objs = [
    ...quakes.pickables(),
    ...craft.pickables(),
    ...launches.pickables(),
  ]
  const hit = engine.pick(x, y, objs)
  if (!hit) return
  const ud = hit.object.userData
  if (ud.kind === 'quake') {
    openEvent('quake', ud.q.id)
    return
  }
  if (ud.kind === 'launch') {
    openEvent('launch', ud.L.id)
    return
  }
  if (ud.kind === 'station') {
    setMode('iss')
    return
  }
  if (ud.kind === 'sats') {
    const sat = craft.nearestSat(hit.point)
    if (sat) {
      state.track = { kind: 'sat', payload: sat }
      hud.track(trackView('sat', sat))
      if (sat.pos) engine.flyTo(sat.pos.lat, sat.pos.lon, 2.8, 1200)
    }
    return
  }
  if (flights.group.visible) {
    const f = flights.nearest(hit.point)
    if (f) {
      state.track = { kind: 'flight', payload: f }
      hud.track(trackView('flight', f))
    }
  }
}

engine.renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) pointerDown = { x: e.clientX, y: e.clientY }
})
engine.renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !pointerDown) return
  const dx = e.clientX - pointerDown.x
  const dy = e.clientY - pointerDown.y
  pointerDown = null
  if (dx * dx + dy * dy > 16) return
  onPointer(e)
})
engine.renderer.domElement.addEventListener('pointermove', (e) => {
  const t = performance.now()
  if (t - lastHover < 90) return
  lastHover = t
  const rect = engine.renderer.domElement.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  const objs = [
    ...quakes.pickables(),
    ...craft.pickables(),
    ...launches.pickables(),
  ]
  const hit = engine.pick(x, y, objs)
  engine.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
})

window.addEventListener('keydown', (e) => {
  if (e.target?.matches?.('input, textarea')) return
  const k = e.key.toLowerCase()
  if (k === '1') setMode('free')
  if (k === '2') setMode('iss')
  if (k === '3') setMode('terminator')
  if (k === '4') setMode('cinema')
  if (k === 'g') flyHome()
  if (k === 'p') ridePass()
  if (k === 's' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    snapshot()
  }
  if (k === 'c') toggleLayer('clouds')
  if (k === 'a') toggleLayer('aurora')
  if (k === 'q') nextQuake()
  if (k === 'l') nextLaunch()
  if (k === 'h') {
    state.hud = !state.hud
    hud.hud(state.hud)
  }
  if (k === 'r') {
    setMode('free')
    engine.flyTo(HOME.lat, HOME.lon, 4.3, 1200)
  }
  if (k === ' ') {
    e.preventDefault()
    state.paused = !state.paused
    engine.controls.autoRotate = !state.paused && (state.mode === 'cinema' || state.mode === 'free')
  }
  if (k === '?' || (e.shiftKey && k === '/')) {
    keysOpen = !keysOpen
    hud.keys(keysOpen)
  }
  if (k === 'escape') {
    keysOpen = false
    hud.keys(false)
  }
})

async function boot() {
  hud.setBoot(0.08, 'loading catalog')
  const catalogP = fetchCatalog().catch(() => ({ objects: [] }))
  hud.setBoot(0.18, 'listening to the ground')
  const quakesP = fetchQuakes().catch(() => [])
  hud.setBoot(0.28, 'space weather')
  const kpP = fetchKp().catch(() => null)
  const swP = fetchSolarWind().catch(() => null)
  hud.setBoot(0.55, 'launch windows')
  const launchesP = fetchLaunches().catch(() => [])

  const [catalog, qk, kp, sw, ln] = await Promise.all([
    catalogP, quakesP, kpP, swP, launchesP,
  ])

  hud.setBoot(0.82, 'propagating orbits')
  state.data.catalog = catalog.objects || []
  craft.setCatalog(state.data.catalog)
  state.counts.sats = state.data.catalog.length

  state.data.quakes = qk
  quakes.setData(qk)
  state.counts.quakes = qk.length
  state.data.pulse = Math.round(qk.reduce((s, q) => s + q.mag * q.mag, 0))
  engine.earth.setPulse(state.data.pulse)

  state.data.kp = kp
  state.data.solarWind = sw

  state.data.launches = ln
  launches.setData(ln)
  state.counts.launches = ln.length

  applyLayers()
  hud.layers(state)
  hud.vitals(state)
  hud.events(state)
  hud.briefing(state)
  hud.modes(state.mode)
  hud.setBoot(1, 'on station')

  setTimeout(() => {
    hud.hideBoot()
    state.boot = false
    engine.flyTo(HOME.lat, HOME.lon, 2.55, 2800)
    setTimeout(() => {
      if (state.mode === 'free' && !state.paused) {
        engine.controls.autoRotate = true
        engine.controls.autoRotateSpeed = 0.18
      }
    }, 3000)
  }, 420)

  fetchAurora()
    .then((au) => {
      state.data.aurora = au.points || []
      aurora.setData(state.data.aurora)
      state.counts.aurora = state.data.aurora.length
      hud.layers(state)
      hud.briefing(state)
    })
    .catch(() => {})

  fetchFlights()
    .then((fl) => {
      if (!fl) {
        state.layers.flights = false
        applyLayers()
        hud.layers(state)
        return
      }
      flights.setData(fl.sample)
      state.counts.flights = fl.sample.length
      state.counts.flightsTotal = fl.total
      hud.layers(state)
      hud.briefing(state)
    })
    .catch(() => {
      state.layers.flights = false
      applyLayers()
      hud.layers(state)
    })

  refreshStations()
    .then((live) => {
      if (!Array.isArray(live) || !live.length) return
      const byId = new Map(live.map((o) => [o.NORAD_CAT_ID, o]))
      let changed = false
      for (const o of state.data.catalog) {
        const n = byId.get(o.NORAD_CAT_ID)
        if (n) {
          Object.assign(o, n)
          changed = true
        }
      }
      if (changed) craft.setCatalog(state.data.catalog)
    })
    .catch(() => {})

  setInterval(() => {
    fetchQuakes()
      .then((list) => {
        state.data.quakes = list
        quakes.setData(list)
        state.counts.quakes = list.length
        state.data.pulse = Math.round(list.reduce((s, q) => s + q.mag * q.mag, 0))
        engine.earth.setPulse(state.data.pulse)
        hud.vitals(state)
        hud.events(state)
        hud.briefing(state)
        hud.layers(state)
      })
      .catch(() => {})
  }, 120000)

  setInterval(() => {
    Promise.all([fetchKp().catch(() => null), fetchSolarWind().catch(() => null)]).then(
      ([k, s]) => {
        if (k) state.data.kp = k
        if (s) state.data.solarWind = s
        hud.vitals(state)
        hud.briefing(state)
      },
    )
  }, 60000)

  setInterval(() => {
    fetchFlights()
      .then((f) => {
        if (!f) return
        flights.setData(f.sample)
        state.counts.flights = f.sample.length
        state.counts.flightsTotal = f.total
        hud.layers(state)
        hud.briefing(state)
      })
      .catch(() => {})
  }, 45000)
}

function loop() {
  requestAnimationFrame(loop)
  const now = new Date()
  const dt = engine.tick(now)
  quakes.tick(now.getTime() / 1000)

  if (now.getTime() - lastSatUpdate > 250) {
    lastSatUpdate = now.getTime()
    const live = craft.update(now)
    state.data.iss = live.iss
    state.data.tiangong = live.tiangong
    try {
      state.data.look = craft.lookNow(HOME.lat, HOME.lon, now)
    } catch {
      state.data.look = null
    }
    if (live.iss && !briefedIss) {
      briefedIss = true
      setTimeout(() => {
        try {
          state.data.passes = craft.passesOver(HOME.lat, HOME.lon)
          const p = state.data.passes?.[0]
          if (p) craft.setPass(p)
        } catch {
          state.data.passes = []
        }
        hud.briefing(state)
        hud.events(state)
        hud.vitals(state)
        hud.pass(state, now)
      }, 0)
    }
  }
  try {
    craft.tickBeacon(now.getTime() / 1000, !!state.data.look?.visible)
  } catch {
    /* beacon optional */
  }

  applyTrackCamera(now)
  cinemaStep(dt)

  hud.clock(now)
  hud.telemetry(engine.cameraInfo(), subsolar(now))
  const sec = now.getSeconds()
  if (sec !== lastPassSec) {
    lastPassSec = sec
    hud.pass(state, now)
    state.data.moon = engine.moon
  }
  if (!state.boot && sec % 5 === 0 && sec !== lastEventsSec) {
    lastEventsSec = sec
    hud.events(state)
    hud.briefing(state)
  }
}

engine.controls.autoRotate = false
applyLayers()
hud.layers(state)
hud.modes(state.mode)
boot()
loop()

window.__zenith = { state, engine }
