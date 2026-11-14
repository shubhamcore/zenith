export const LAYERS = [
  { id: 'clouds', label: 'Clouds', color: '#d9d4cc', defaultOn: true },
  { id: 'quakes', label: 'Earthquakes', color: '#ff6b4a', defaultOn: true },
  { id: 'iss', label: 'Space stations', color: '#ffffff', defaultOn: true },
  { id: 'sats', label: 'Satellites', color: '#6ee7d8', defaultOn: true },
  { id: 'aurora', label: 'Aurora oval', color: '#ff7eb6', defaultOn: true },
  { id: 'launches', label: 'Launch pads', color: '#e2c48e', defaultOn: true },
  { id: 'flights', label: 'Air picture', color: '#8ab4ff', defaultOn: true },
  { id: 'orbits', label: 'Orbit traces', color: '#c9a227', defaultOn: true },
]

export function createState() {
  const layers = Object.fromEntries(LAYERS.map((l) => [l.id, l.defaultOn]))
  return {
    layers,
    mode: 'free', // free | iss | terminator | cinema
    hud: true,
    track: null,
    paused: false,
    boot: true,
    data: {
      quakes: [],
      catalog: [],
      launches: [],
      flights: [],
      aurora: [],
      kp: null,
      kpLabel: '—',
      solarWind: null,
      iss: null,
      tiangong: null,
      updated: {},
    },
    counts: {},
    listeners: new Set(),
  }
}

export function emit(state, type, payload) {
  for (const fn of state.listeners) fn(type, payload)
}

export function on(state, fn) {
  state.listeners.add(fn)
  return () => state.listeners.delete(fn)
}
