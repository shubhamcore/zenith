import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EARTH_RADIUS, latLonToVec3, vec3ToLatLon, sunDirection, HOME } from '../app/geo.js'
import { createEarth } from './earth.js'
import { createStars } from './stars.js'

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.setClearColor(0x050508, 1)
  canvas.style.cursor = 'grab'

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)
  scene.fog = new THREE.FogExp2(0x050508, 0.01)

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.05,
    400,
  )
  camera.position.copy(latLonToVec3(HOME.lat, HOME.lon, 7.4))

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = EARTH_RADIUS + 0.18
  controls.maxDistance = 14
  controls.enablePan = false
  controls.rotateSpeed = 0.55
  controls.zoomSpeed = 0.85
  controls.target.set(0, 0, 0)
  controls.autoRotate = false

  const stars = createStars()
  scene.add(stars)
  const earth = createEarth(renderer)
  scene.add(earth.group)

  const layers = new THREE.Group()
  layers.name = 'layers'
  scene.add(layers)

  const sun = new THREE.DirectionalLight(0xfff4e0, 0.0)
  scene.add(sun)
  scene.add(new THREE.AmbientLight(0x1a2030, 0.35))

  const clock = new THREE.Clock()
  let fly = null
  let moonState = null
  let slowFrames = 0

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', resize)

  function flyTo(lat, lon, distance = 2.6, ms = 1600) {
    const dest = latLonToVec3(lat, lon, distance)
    fly = {
      from: camera.position.clone(),
      to: dest,
      t: 0,
      dur: ms / 1000,
    }
    controls.target.set(0, 0, 0)
  }

  function lookFrom(vec, damp = 0.08) {
    camera.position.lerp(vec, damp)
    controls.target.set(0, 0, 0)
  }

  function tick(now) {
    const dt = Math.min(clock.getDelta(), 0.05)
    const sunDir = sunDirection(now)
    earth.setSun(sunDir)
    earth.tick(dt)
    moonState = earth.setMoon(now)
    sun.position.copy(sunDir).multiplyScalar(20)
    stars.rotation.y += dt * 0.0035
    if (stars.userData.mat) stars.userData.mat.uniforms.time.value += dt

    if (dt > 0.033) slowFrames++
    else slowFrames = Math.max(0, slowFrames - 1)
    if (slowFrames > 45) {
      renderer.setPixelRatio(1)
      slowFrames = 0
    }

    if (fly) {
      fly.t += dt
      const u = Math.min(1, fly.t / fly.dur)
      const e = 1 - Math.pow(1 - u, 3)
      camera.position.lerpVectors(fly.from, fly.to, e)
      if (u >= 1) fly = null
    }

    controls.update()
    renderer.render(scene, camera)
    return dt
  }

  function pick(ndcX, ndcY, objects) {
    const ray = new THREE.Raycaster()
    ray.params.Points = { threshold: 0.06 }
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    const hits = ray.intersectObjects(objects, true)
    return hits[0] || null
  }

  function cameraInfo() {
    const look = vec3ToLatLon(camera.position)
    const alt = (camera.position.length() - EARTH_RADIUS) * 6371
    return { ...look, alt }
  }

  canvas.addEventListener('pointerdown', () => {
    canvas.style.cursor = 'grabbing'
  })
  canvas.addEventListener('pointerup', () => {
    canvas.style.cursor = 'grab'
  })

  return {
    renderer,
    scene,
    camera,
    controls,
    earth,
    layers,
    flyTo,
    lookFrom,
    tick,
    pick,
    cameraInfo,
    get moon() {
      return moonState
    },
  }
}
