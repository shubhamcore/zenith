import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from '../app/geo.js'

export function createFlights() {
  const group = new THREE.Group()
  group.name = 'flights'
  let points = null
  let sample = []

  function setData(list) {
    sample = list || []
    group.clear()
    points = null
    if (!sample.length) return
    const n = sample.length
    const pos = new Float32Array(n * 3)
    sample.forEach((f, i) => {
      const altR = EARTH_RADIUS + Math.max(f.alt, 8000) / 6371000 * EARTH_RADIUS * 4.2
      const v = latLonToVec3(f.lat, f.lon, altR)
      pos[i * 3] = v.x
      pos[i * 3 + 1] = v.y
      pos[i * 3 + 2] = v.z
      f.index = i
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: 0x8ab4ff,
      size: 0.018,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    })
    points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    points.userData.kind = 'flights'
    group.add(points)
  }

  function nearest(worldPoint) {
    let best = null
    let bestD = 0.08
    const tmp = new THREE.Vector3()
    for (const f of sample) {
      const altR = EARTH_RADIUS + Math.max(f.alt, 8000) / 6371000 * EARTH_RADIUS * 4.2
      tmp.copy(latLonToVec3(f.lat, f.lon, altR))
      const d = tmp.distanceTo(worldPoint)
      if (d < bestD) {
        bestD = d
        best = f
      }
    }
    return best
  }

  return { group, setData, nearest, get sample() { return sample } }
}
