import * as THREE from 'three'
import * as satellite from 'satellite.js'
import { EARTH_RADIUS, latLonToVec3, smallCircle, azName } from '../app/geo.js'

const CLASS_COLOR = {
  station: 0xffffff,
  science: 0x6ee7d8,
  weather: 0x8ab4ff,
  visual: 0xe2c48e,
  nav: 0xb8f27a,
  geo: 0xc9a227,
  starlink: 0x6b8cff,
}

function ommToSatrec(o) {
  try {
    return satellite.json2satrec(o)
  } catch {
    return null
  }
}

export function propagate(satrec, date) {
  const gmst = satellite.gstime(date)
  const pv = satellite.propagate(satrec, date)
  if (!pv.position) return null
  const geo = satellite.eciToGeodetic(pv.position, gmst)
  const lat = satellite.degreesLat(geo.latitude)
  const lon = satellite.degreesLong(geo.longitude)
  const alt = geo.height
  const vel = pv.velocity
    ? Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z)
    : 0
  return { lat, lon, alt, vel }
}

export function createCraft() {
  const group = new THREE.Group()
  group.name = 'craft'
  const satGroup = new THREE.Group()
  const stationGroup = new THREE.Group()
  const orbitGroup = new THREE.Group()
  const beacon = new THREE.Group()
  const tracks = new THREE.Group()
  group.add(satGroup, stationGroup, orbitGroup, beacon, tracks)

  const trackLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x6ee7d8,
      transparent: true,
      opacity: 0.55,
    }),
  )
  trackLine.frustumCulled = false
  const trailLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    }),
  )
  trailLine.frustumCulled = false
  const passLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xe2c48e,
      transparent: true,
      opacity: 0.9,
    }),
  )
  passLine.frustumCulled = false
  tracks.add(trackLine, trailLine, passLine)

  const trail = []
  let lastTrack = 0

  function addBeacon(lat, lon) {
    beacon.clear()
    const p = latLonToVec3(lat, lon, EARTH_RADIUS + 0.012)
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x6ee7d8 }),
    )
    pin.position.copy(p)
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x6ee7d8,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    )
    glow.position.copy(p)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.04, 40),
      new THREE.MeshBasicMaterial({
        color: 0xe2c48e,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.position.copy(p)
    ring.lookAt(0, 0, 0)
    const up = p.clone().normalize()
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0022, 0.0022, 0.28, 8),
      new THREE.MeshBasicMaterial({
        color: 0x6ee7d8,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    )
    beam.position.copy(p).add(up.clone().multiplyScalar(0.14))
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)

    const footprint = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(smallCircle(lat, lon, 2200, 80)),
      new THREE.LineBasicMaterial({
        color: 0x6ee7d8,
        transparent: true,
        opacity: 0.28,
      }),
    )
    footprint.frustumCulled = false

    beacon.add(pin, glow, ring, beam, footprint)
    beacon.userData.ring = ring
    beacon.userData.beam = beam
    beacon.userData.foot = footprint
    beacon.userData.lat = lat
    beacon.userData.lon = lon
  }

  function issRec() {
    return stations.find((s) => s.o.OBJECT_NAME.includes('ISS'))?.rec
  }

  function lookNow(lat, lon, date = new Date()) {
    const rec = issRec()
    if (!rec) return null
    const pv = satellite.propagate(rec, date)
    if (!pv?.position) return null
    const gmst = satellite.gstime(date)
    const gd = {
      latitude: satellite.degreesToRadians(lat),
      longitude: satellite.degreesToRadians(lon),
      height: 0.06,
    }
    const look = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst))
    const el = look.elevation * (180 / Math.PI)
    const az = (((look.azimuth * 180) / Math.PI) + 360) % 360
    return {
      el,
      az,
      azName: azName(az),
      range: look.rangeSat,
      visible: el >= 10,
    }
  }

  function passesOver(lat, lon, hours = 24) {
    const rec = issRec()
    if (!rec) return []
    const gd = {
      latitude: satellite.degreesToRadians(lat),
      longitude: satellite.degreesToRadians(lon),
      height: 0.06,
    }
    const start = Date.now()
    const out = []
    let cur = null
    for (let t = start; t <= start + hours * 3600000; t += 30000) {
      const date = new Date(t)
      const pv = satellite.propagate(rec, date)
      if (!pv?.position) continue
      const gmst = satellite.gstime(date)
      const look = satellite.ecfToLookAngles(gd, satellite.eciToEcf(pv.position, gmst))
      const el = look.elevation * (180 / Math.PI)
      const az = (((look.azimuth * 180) / Math.PI) + 360) % 360
      if (el >= 10) {
        if (!cur) cur = { t0: t, t1: t, maxEl: el, tmax: t, az, azName: azName(az) }
        else {
          cur.t1 = t
          if (el > cur.maxEl) {
            cur.maxEl = el
            cur.tmax = t
            cur.az = az
            cur.azName = azName(az)
          }
        }
      } else if (cur) {
        out.push(cur)
        cur = null
      }
    }
    if (cur) out.push(cur)
    return out
  }

  function setPass(pass) {
    const rec = issRec()
    if (!rec || !pass) return
    const pts = []
    const t0 = pass.t0
    const t1 = pass.t1 || pass.tmax
    const n = 48
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n
      const p = propagate(rec, new Date(t))
      if (!p) continue
      const altR = EARTH_RADIUS * (1 + p.alt / 6371)
      pts.push(latLonToVec3(p.lat, p.lon, altR))
    }
    if (pts.length > 1) {
      passLine.geometry.dispose()
      passLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
    }
  }

  function rebuildTrack(date) {
    const rec = issRec()
    if (!rec) return
    const pts = []
    for (let i = 0; i <= 96; i++) {
      const d = new Date(date.getTime() + (i / 96) * 92 * 60000)
      const p = propagate(rec, d)
      if (!p) continue
      pts.push(latLonToVec3(p.lat, p.lon, EARTH_RADIUS * 1.012))
    }
    if (pts.length > 1) {
      trackLine.geometry.dispose()
      trackLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
    }
  }

  let records = []
  let positions = null
  let colors = null
  let points = null
  let stations = []

  function setCatalog(objects) {
    records = []
    stations = []
    satGroup.clear()
    stationGroup.clear()
    orbitGroup.clear()
    trail.length = 0

    const satObjs = []
    for (const o of objects) {
      const rec = ommToSatrec(o)
      if (!rec) continue
      const item = { o, rec, klass: o.CLASS || 'visual' }
      if (item.klass === 'station') stations.push(item)
      else satObjs.push(item)
      records.push(item)
    }

    const n = satObjs.length
    positions = new Float32Array(n * 3)
    colors = new Float32Array(n * 3)
    const col = new THREE.Color()
    satObjs.forEach((s, i) => {
      col.setHex(CLASS_COLOR[s.klass] || 0x88aacc)
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
      s.index = i
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      sizeAttenuation: true,
    })
    points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.userData.kind = 'sats'
    satGroup.add(points)
    satGroup.userData.list = satObjs

    for (const s of stations) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      )
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 16, 12),
        new THREE.MeshBasicMaterial({
          color: s.o.OBJECT_NAME.includes('ISS') ? 0x6ee7d8 : 0xe2c48e,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      )
      const g = new THREE.Group()
      g.add(mesh, glow)
      g.userData = { kind: 'station', item: s }
      s.mesh = g
      stationGroup.add(g)
      s.orbit = drawOrbit(s.rec, s.o.OBJECT_NAME.includes('ISS') ? 0x6ee7d8 : 0xe2c48e)
      orbitGroup.add(s.orbit)
    }
  }

  function drawOrbit(satrec, color, minutes = 95, samples = 128) {
    const pts = []
    const t0 = new Date()
    for (let i = 0; i <= samples; i++) {
      const d = new Date(t0.getTime() + (i / samples) * minutes * 60000)
      const p = propagate(satrec, d)
      if (!p) continue
      const altR = EARTH_RADIUS * (1 + p.alt / 6371)
      pts.push(latLonToVec3(p.lat, p.lon, altR))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    return new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
      }),
    )
  }

  function update(date) {
    const satObjs = satGroup.userData.list || []
    if (points && positions) {
      for (const s of satObjs) {
        const p = propagate(s.rec, date)
        if (!p) continue
        s.pos = p
        const altR = EARTH_RADIUS * (1 + Math.max(p.alt, 200) / 6371)
        const v = latLonToVec3(p.lat, p.lon, altR)
        positions[s.index * 3] = v.x
        positions[s.index * 3 + 1] = v.y
        positions[s.index * 3 + 2] = v.z
      }
      points.geometry.attributes.position.needsUpdate = true
    }
    const live = { iss: null, tiangong: null }
    for (const s of stations) {
      const p = propagate(s.rec, date)
      if (!p) continue
      s.pos = p
      const altR = EARTH_RADIUS * (1 + p.alt / 6371)
      const v = latLonToVec3(p.lat, p.lon, altR)
      s.mesh.position.copy(v)
      const name = s.o.OBJECT_NAME
      if (name.includes('ISS')) {
        live.iss = { ...p, name: 'ISS (Zarya)', rec: s }
        trail.push(v.clone())
        if (trail.length > 56) trail.shift()
        if (trail.length > 2) {
          trailLine.geometry.dispose()
          trailLine.geometry = new THREE.BufferGeometry().setFromPoints(trail)
        }
      }
      if (name.includes('TIANHE') || name.includes('CSS')) {
        live.tiangong = { ...p, name: 'Tiangong', rec: s }
      }
    }
    if (date.getTime() - lastTrack > 2500) {
      lastTrack = date.getTime()
      rebuildTrack(date)
    }
    return live
  }

  function setVisible({ sats, iss, orbits }) {
    satGroup.visible = sats
    stationGroup.visible = iss
    orbitGroup.visible = orbits && iss
    tracks.visible = iss
  }

  function nearestSat(worldPoint) {
    const list = satGroup.userData.list || []
    let best = null
    let bestD = 0.12
    const tmp = new THREE.Vector3()
    for (const s of list) {
      if (!s.pos) continue
      const altR = EARTH_RADIUS * (1 + Math.max(s.pos.alt, 200) / 6371)
      tmp.copy(latLonToVec3(s.pos.lat, s.pos.lon, altR))
      const d = tmp.distanceTo(worldPoint)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    return best
  }

  return {
    group,
    setCatalog,
    update,
    setVisible,
    nearestSat,
    addBeacon,
    passesOver,
    lookNow,
    setPass,
    tickBeacon(t, visible) {
      const ring = beacon.userData.ring
      const beam = beacon.userData.beam
      const foot = beacon.userData.foot
      const speed = visible ? 4.2 : 2.2
      if (ring) ring.scale.setScalar(1 + 0.16 * Math.sin(t * speed))
      if (beam) beam.material.opacity = visible ? 0.7 : 0.35
      if (foot) foot.material.opacity = visible ? 0.7 : 0.22
    },
    pickables: () => [...stationGroup.children, ...(points ? [points] : [])],
    get records() {
      return records
    },
  }
}
