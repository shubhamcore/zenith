import * as THREE from 'three'
import { EARTH_RADIUS, latLonToVec3 } from '../app/geo.js'

export function createLaunches() {
  const group = new THREE.Group()
  group.name = 'launches'

  function setData(list) {
    group.clear()
    for (const L of list || []) {
      const p = latLonToVec3(L.lat, L.lon, EARTH_RADIUS + 0.012)
      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.04, 6),
        new THREE.MeshBasicMaterial({ color: 0xe2c48e }),
      )
      pin.position.copy(p)
      pin.lookAt(p.clone().multiplyScalar(2))
      pin.rotateX(Math.PI / 2)
      pin.userData = { kind: 'launch', L }
      const spike = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0018, 0.0018, 0.16, 6),
        new THREE.MeshBasicMaterial({
          color: 0xe2c48e,
          transparent: true,
          opacity: 0.45,
        }),
      )
      const up = p.clone().normalize()
      spike.position.copy(p).add(up.multiplyScalar(0.08))
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize())
      spike.userData = { kind: 'launch', L }
      group.add(pin, spike)
    }
  }

  return { group, setData, pickables: () => group.children }
}
