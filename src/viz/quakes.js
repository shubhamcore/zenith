import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from '../app/geo.js'

export function createQuakes() {
  const group = new THREE.Group()
  group.name = 'quakes'
  const rings = []

  function setData(quakes) {
    group.clear()
    rings.length = 0
    for (const q of quakes) {
      const r = 0.01 + Math.max(0, q.mag - 2.5) * 0.012
      const mat = new THREE.MeshBasicMaterial({
        color: magColor(q.mag),
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(new THREE.RingGeometry(r * 0.45, r, 40), mat)
      const p = latLonToVec3(q.lat, q.lon, EARTH_RADIUS + 0.01)
      mesh.position.copy(p)
      mesh.lookAt(0, 0, 0)
      mesh.userData = { kind: 'quake', q }
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.006 + q.mag * 0.0022, 10, 8),
        new THREE.MeshBasicMaterial({ color: magColor(q.mag) }),
      )
      core.position.copy(p.clone().multiplyScalar(1.002))
      core.userData = { kind: 'quake', q }
      group.add(mesh, core)
      rings.push({ mesh, q, base: r, born: q.time })
    }
  }

  function tick(t) {
    for (const r of rings) {
      const u = (t * (0.28 + r.q.mag * 0.04) + r.q.mag) % 1
      r.mesh.scale.setScalar(0.55 + u * 2.1)
      r.mesh.material.opacity = (1 - u) * (0.18 + r.q.mag * 0.07)
    }
  }

  return { group, setData, tick, pickables: () => group.children }
}

function magColor(m) {
  if (m >= 6) return 0xff3b30
  if (m >= 5) return 0xff6b4a
  if (m >= 4) return 0xffb347
  return 0xe2c48e
}
