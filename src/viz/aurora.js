import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from '../app/geo.js'
import { auroraVert, auroraFrag } from '../scene/shaders.js'

export function createAurora() {
  const group = new THREE.Group()
  group.name = 'aurora'
  let points = null

  function setData(list) {
    group.clear()
    points = null
    if (!list?.length) return
    const stride = Math.max(1, Math.floor(list.length / 4500))
    const filtered = []
    for (let i = 0; i < list.length; i += stride) filtered.push(list[i])
    const n = filtered.length
    const pos = new Float32Array(n * 3)
    const inten = new Float32Array(n)
    const normals = new Float32Array(n * 3)
    filtered.forEach((p, i) => {
      const h = EARTH_RADIUS * 1.03 + p.a * 0.00035
      const v = latLonToVec3(p.lat, p.lon, h)
      pos[i * 3] = v.x
      pos[i * 3 + 1] = v.y
      pos[i * 3 + 2] = v.z
      inten[i] = p.a
      const nrm = v.clone().normalize()
      normals[i * 3] = nrm.x
      normals[i * 3 + 1] = nrm.y
      normals[i * 3 + 2] = nrm.z
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('intensity', new THREE.BufferAttribute(inten, 1))
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    const mat = new THREE.ShaderMaterial({
      vertexShader: auroraVert,
      fragmentShader: auroraFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    group.add(points)
  }

  return { group, setData }
}
