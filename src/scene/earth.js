import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3, moonPole } from '../app/geo.js'
import {
  earthVert,
  earthFrag,
  atmosVert,
  atmosFrag,
  cloudVert,
  cloudFrag,
  moonVert,
  moonFrag,
} from './shaders.js'

export function createEarth(renderer) {
  const tex = new THREE.TextureLoader()
  const maxAniso = renderer.capabilities.getMaxAnisotropy()

  const dayMap = tex.load('/textures/earth-day.jpg')
  const nightMap = tex.load('/textures/earth-night.png')
  const specMap = tex.load('/textures/earth-spec.jpg')
  const cloudMap = tex.load('/textures/earth-clouds.png')

  for (const t of [dayMap, nightMap, cloudMap]) {
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = maxAniso
  }
  specMap.anisotropy = maxAniso

  const group = new THREE.Group()
  group.name = 'earth'

  const geo = new THREE.SphereGeometry(EARTH_RADIUS, 96, 64)

  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      specMap: { value: specMap },
      cloudMap: { value: cloudMap },
      sunDir: { value: new THREE.Vector3(1, 0.2, 0.1) },
      time: { value: 0 },
    },
    vertexShader: earthVert,
    fragmentShader: earthFrag,
  })
  const globe = new THREE.Mesh(geo, earthMat)
  group.add(globe)

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      cloudMap: { value: cloudMap },
      sunDir: { value: new THREE.Vector3(1, 0.2, 0.1) },
      opacity: { value: 0.85 },
    },
    vertexShader: cloudVert,
    fragmentShader: cloudFrag,
    transparent: true,
    depthWrite: false,
  })
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.008, 96, 64),
    cloudMat,
  )
  clouds.name = 'clouds'
  group.add(clouds)

  const atmosMat = new THREE.ShaderMaterial({
    uniforms: {
      sunDir: { value: new THREE.Vector3(1, 0.2, 0.1) },
      intensity: { value: 1.15 },
    },
    vertexShader: atmosVert,
    fragmentShader: atmosFrag,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 64, 48),
    atmosMat,
  )
  group.add(atmos)

  const TERM_N = 193
  const termPos = new Float32Array(TERM_N * 3)
  const termGeo = new THREE.BufferGeometry()
  termGeo.setAttribute('position', new THREE.BufferAttribute(termPos, 3))
  const terminator = new THREE.Line(
    termGeo,
    new THREE.LineBasicMaterial({
      color: 0xe2c48e,
      transparent: true,
      opacity: 0.55,
    }),
  )
  terminator.frustumCulled = false
  group.add(terminator)

  const subsolarMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffc14a }),
  )
  const subsolarGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0xff8a1a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  )
  group.add(subsolarMark, subsolarGlow)

  const moonMat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: new THREE.Vector3(1, 0.2, 0.1) } },
    vertexShader: moonVert,
    fragmentShader: moonFrag,
  })
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), moonMat)
  moon.name = 'moon'
  group.add(moon)

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xfff1c2,
      transparent: true,
      opacity: 0.95,
    }),
  )
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  )
  group.add(sunDisc, sunHalo)

  let pulse = 40
  const tmp = new THREE.Vector3()
  const tmp2 = new THREE.Vector3()
  const tmp3 = new THREE.Vector3()

  function buildTerminator(dir) {
    const up = dir.clone().normalize()
    const a = Math.abs(up.y) < 0.92 ? tmp.set(0, 1, 0) : tmp.set(1, 0, 0)
    const x = tmp2.crossVectors(up, a).normalize()
    const y = tmp3.crossVectors(up, x).normalize()
    const r = EARTH_RADIUS * 1.006
    for (let i = 0; i < TERM_N; i++) {
      const t = (i / (TERM_N - 1)) * Math.PI * 2
      const cx = Math.cos(t) * r
      const cy = Math.sin(t) * r
      termPos[i * 3] = x.x * cx + y.x * cy
      termPos[i * 3 + 1] = x.y * cx + y.y * cy
      termPos[i * 3 + 2] = x.z * cx + y.z * cy
    }
    terminator.geometry.attributes.position.needsUpdate = true
  }

  return {
    group,
    clouds,
    setSun(dir) {
      earthMat.uniforms.sunDir.value.copy(dir)
      cloudMat.uniforms.sunDir.value.copy(dir)
      atmosMat.uniforms.sunDir.value.copy(dir)
      moonMat.uniforms.sunDir.value.copy(dir)
      buildTerminator(dir)
      const p = dir.clone().normalize().multiplyScalar(EARTH_RADIUS * 1.012)
      subsolarMark.position.copy(p)
      subsolarGlow.position.copy(p)
      sunDisc.position.copy(dir).normalize().multiplyScalar(28)
      sunHalo.position.copy(sunDisc.position)
    },
    setClouds(on) {
      clouds.visible = on
    },
    setPulse(n) {
      pulse = n
      atmosMat.uniforms.intensity.value = 1.05 + Math.min(0.55, n * 0.012)
    },
    setMoon(date) {
      try {
        const m = moonPole(date)
        const dir = latLonToVec3(m.lat, m.lon, 1)
        moon.position.copy(dir).multiplyScalar(12.5)
        moon.lookAt(0, 0, 0)
        return m
      } catch {
        return null
      }
    },
    tick(dt) {
      clouds.rotation.y += dt * 0.004
      earthMat.uniforms.time.value += dt
      const throb = 1 + 0.045 * Math.sin(earthMat.uniforms.time.value * 1.15)
      atmosMat.uniforms.intensity.value =
        (1.05 + Math.min(0.55, pulse * 0.012)) * throb
      const s = 1 + 0.08 * Math.sin(earthMat.uniforms.time.value * 2.1)
      subsolarGlow.scale.setScalar(s)
    },
  }
}
