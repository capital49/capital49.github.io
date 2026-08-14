// THE CONTINUUM — the point data behind the home page.
//
// One substance, continuously reformed. Every generator below returns the same
// `count * 3` layout so the vertex shader can morph between any two of them by
// index alone — the particle at index i is the same particle in the logo, in the
// Möbius strip, in the dipole and in the network globe.
//
// The counts are load-bearing: `count` is always 49 x PER_NODE, so the buffer
// can be read as "one cloud" (logo, Möbius) or as "49 nodes"
// (lattice, dipole field lines, network globe) without ever resizing.
//
// Pure numbers apart from `sampleLogo`, which needs a 2D canvas to read the
// real logotype.

export const GRID_SIDE = 7
export const NODE_COUNT = GRID_SIDE * GRID_SIDE // 49
export const DESKTOP_PER_NODE = 300 // 14,700 particles
export const MOBILE_PER_NODE = 100 // 4,900 particles

// World units. The camera sits at z = 12 with a 45° fov, so the visible height
// at z = 0 is ~9.94 units: every form below is authored to sit inside ~±3.1.
export const GRID_SPACING = 0.86 // the 7 x 7 lattice spans 5.16
export const GLYPH_WIDTH = 6.1
export const GLYPH_HEIGHT = 4.3
export const RING_RADIUS = 2.15
export const GLOBE_RADIUS = 2.72
// Mirrored in the vertex shader, which evaluates the Möbius per frame so the
// points flow along the strip instead of sitting on it.
export const MOBIUS_RADIUS = 2.05
export const MOBIUS_WIDTH = 0.62

const TAU = Math.PI * 2
// Golden angle — the phyllotaxis constant that spreads the rings and globe nodes.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// Deterministic PRNG (mulberry32). Each generator seeds its own, so the
// composition is art-directed and identical on every load, in any call order.
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function alloc(count: number): Float32Array {
  return new Float32Array(count * 3)
}

// ── THE LATTICE ─────────────────────────────────────────────────────────────
// The 49 points of 7 x 7. Both the intro's resting state and the waypoint every
// single morph detours through at its midpoint: forms are re-born from the
// identity rather than melted into one another.
export function buildLattice(count: number): Float32Array {
  const out = alloc(count)
  const perNode = count / NODE_COUNT
  const r = prng(4949)
  const half = (GRID_SIDE - 1) / 2

  for (let n = 0; n < NODE_COUNT; n++) {
    const gx = ((n % GRID_SIDE) - half) * GRID_SPACING
    const gy = (Math.floor(n / GRID_SIDE) - half) * GRID_SPACING
    for (let k = 0; k < perNode; k++) {
      const i = (n * perNode + k) * 3
      const a = r() * TAU
      const rad = Math.sqrt(r()) * 0.1
      out[i] = gx + Math.cos(a) * rad
      out[i + 1] = gy + Math.sin(a) * rad
      out[i + 2] = (r() - 0.5) * 0.12
    }
  }
  return out
}

// ── THE MARK · THE CAPITAL 49 LOGO ──────────────────────────────────────────
// The real logotype — the hexagram bars and "CAPITAL 49" — sampled into points
// from its PNG's alpha channel. Async: resolves once the image has decoded.
// Returns null if the image or the 2D context is unavailable, in which case the
// caller keeps whatever it seeded the attribute with.
export async function sampleLogo(count: number): Promise<Float32Array | null> {
  if (typeof document === "undefined") return null
  const image = new Image()
  image.src = "/logos/Capital49-logo-horizontal-white.png"
  try {
    await image.decode()
  } catch {
    return null
  }

  const w = image.naturalWidth
  const h = image.naturalHeight
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)

  // The PNG is white on transparent, so alpha is a perfect logo mask.
  const img = ctx.getImageData(0, 0, w, h).data
  const xs: number[] = []
  const ys: number[] = []
  const gap = 3
  let minX = w
  let maxX = 0
  let minY = h
  let maxY = 0
  for (let py = 0; py < h; py += gap) {
    for (let px = 0; px < w; px += gap) {
      if (img[(py * w + px) * 4 + 3] > 110) {
        xs.push(px)
        ys.push(py)
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (py < minY) minY = py
        if (py > maxY) maxY = py
      }
    }
  }
  if (xs.length === 0) return null

  // Deterministic shuffle, so which pixel a given particle lands on is fixed.
  const r = prng(1849)
  const order = new Uint32Array(xs.length)
  for (let i = 0; i < order.length; i++) order[i] = i
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }

  const bw = Math.max(1, maxX - minX)
  const bh = Math.max(1, maxY - minY)
  const scale = Math.min(GLYPH_WIDTH / bw, GLYPH_HEIGHT / bh)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const out = alloc(count)
  for (let i = 0; i < count; i++) {
    const s = order[i % order.length]
    const j = i * 3
    out[j] = (xs[s] - cx) * scale + (r() - 0.5) * 0.028
    out[j + 1] = -(ys[s] - cy) * scale + (r() - 0.5) * 0.028
    out[j + 2] = (r() - 0.5) * 0.32
  }
  return out
}

// ── MÖBIUS PARAMETERS ───────────────────────────────────────────────────────
// Only (u, v): the surface itself is evaluated in the vertex shader every frame,
// so the cloud runs along the strip — one edge, one side, no way back to where
// it started without turning over.
export function buildMobiusUV(count: number): Float32Array {
  const out = new Float32Array(count * 2)
  const r = prng(1121)
  for (let i = 0; i < count; i++) {
    // Stratified in u so the strip is evenly loaded, jittered so it is not a comb.
    out[i * 2] = ((i + r()) / count) * TAU
    out[i * 2 + 1] = r() * 2 - 1
  }
  return out
}

// ── THE DIPOLE ──────────────────────────────────────────────────────────────
// 49 field lines — 7 meridian planes x 7 shells — around a +Y axis, plus a dense
// core. The invisible force made legible: nothing is added, the substance simply
// arranges itself along a law.
export function buildDipole(count: number): Float32Array {
  const out = alloc(count)
  const r = prng(707)
  const perLine = Math.floor((count * 0.97) / NODE_COUNT)
  let idx = 0

  for (let m = 0; m < GRID_SIDE; m++) {
    const phi = (m / GRID_SIDE) * TAU
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    for (let shell = 0; shell < GRID_SIDE; shell++) {
      const L = 0.72 + shell * 0.29
      for (let k = 0; k < perLine && idx < count; k++) {
        const th = 0.16 + (Math.PI - 0.32) * (k / (perLine - 1))
        const st = Math.sin(th)
        const rad = L * st * st
        const rr = rad * st
        const j = idx * 3
        out[j] = rr * cp + (r() - 0.5) * 0.018
        out[j + 1] = rad * Math.cos(th) + (r() - 0.5) * 0.018
        out[j + 2] = rr * sp + (r() - 0.5) * 0.018
        idx++
      }
    }
  }
  // Whatever is left forms the core the lines run out of.
  while (idx < count) {
    const rad = 0.28 * Math.cbrt(r())
    const a = r() * TAU
    const b = Math.acos(2 * r() - 1)
    const j = idx * 3
    out[j] = rad * Math.sin(b) * Math.cos(a)
    out[j + 1] = rad * Math.cos(b)
    out[j + 2] = rad * Math.sin(b) * Math.sin(a)
    idx++
  }
  return out
}

// ── SEVEN RINGS ─────────────────────────────────────────────────────────────
// Seven interlocking rings, each in its own plane, normals Fibonacci-spread over
// a hemisphere so they weave through one another instead of converging.
export function buildRings(count: number): Float32Array {
  const out = alloc(count)
  const r = prng(3131)
  const perRing = count / GRID_SIDE

  for (let ring = 0; ring < GRID_SIDE; ring++) {
    const y = 1 - ((ring + 0.5) / GRID_SIDE) * 1.4
    const radial = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = ring * GOLDEN_ANGLE
    const nx = Math.cos(phi) * radial
    const ny = y
    const nz = Math.sin(phi) * radial

    // Orthonormal basis for the ring plane. `up` swaps axes near the pole so the
    // cross product never degenerates.
    const upX = Math.abs(ny) > 0.9 ? 1 : 0
    const upY = Math.abs(ny) > 0.9 ? 0 : 1
    let ux = -nz * upY
    let uy = nz * upX
    let uz = nx * upY - ny * upX
    const ul = Math.hypot(ux, uy, uz) || 1
    ux /= ul
    uy /= ul
    uz /= ul
    const vx = ny * uz - nz * uy
    const vy = nz * ux - nx * uz
    const vz = nx * uy - ny * ux

    for (let k = 0; k < perRing; k++) {
      const a = (k / perRing) * TAU
      const c = Math.cos(a) * RING_RADIUS
      const s = Math.sin(a) * RING_RADIUS
      const i = (ring * perRing + k) * 3
      out[i] = ux * c + vx * s + (r() - 0.5) * 0.07
      out[i + 1] = uy * c + vy * s + (r() - 0.5) * 0.07
      out[i + 2] = uz * c + vz * s + (r() - 0.5) * 0.07
    }
  }
  return out
}

// ── THE NETWORK GLOBE ───────────────────────────────────────────────────────
// The same 49 lattice points, lifted onto a sphere and wired: each node keeps a
// tight cluster and spends the rest of its share on a great-circle arc to its
// nearest neighbour — every seventh node throwing a chord clean through the
// middle instead, so the web reads as volume rather than skin.
export function buildGlobe(count: number): Float32Array {
  const out = alloc(count)
  const r = prng(200)
  const perNode = count / NODE_COUNT

  const nodes: Array<[number, number, number]> = []
  for (let n = 0; n < NODE_COUNT; n++) {
    const y = 1 - (2 * (n + 0.5)) / NODE_COUNT
    const radial = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = n * GOLDEN_ANGLE
    nodes.push([
      Math.cos(phi) * radial * GLOBE_RADIUS,
      y * GLOBE_RADIUS,
      Math.sin(phi) * radial * GLOBE_RADIUS,
    ])
  }

  const cluster = Math.max(8, Math.round(perNode * 0.32))
  const edge = perNode - cluster

  for (let n = 0; n < NODE_COUNT; n++) {
    const node = nodes[n] ?? [0, 0, 0]

    let partner = (n + 1) % NODE_COUNT
    const chord = n % GRID_SIDE === 0
    if (chord) {
      partner = (n + 24) % NODE_COUNT
    } else {
      let best = -Infinity
      for (let m = 0; m < NODE_COUNT; m++) {
        if (m === n) continue
        const other = nodes[m] ?? [0, 0, 0]
        const dot = node[0] * other[0] + node[1] * other[1] + node[2] * other[2]
        if (dot > best) {
          best = dot
          partner = m
        }
      }
    }
    const target = nodes[partner] ?? [0, 0, 0]

    for (let k = 0; k < perNode; k++) {
      const i = (n * perNode + k) * 3
      if (k < cluster) {
        const a = r() * TAU
        const b = Math.acos(2 * r() - 1)
        const rad = Math.cbrt(r()) * 0.11
        out[i] = node[0] + Math.sin(b) * Math.cos(a) * rad
        out[i + 1] = node[1] + Math.sin(b) * Math.sin(a) * rad
        out[i + 2] = node[2] + Math.cos(b) * rad
        continue
      }
      const u = (k - cluster) / Math.max(1, edge - 1)
      let ex = node[0] + (target[0] - node[0]) * u
      let ey = node[1] + (target[1] - node[1]) * u
      let ez = node[2] + (target[2] - node[2]) * u
      if (!chord) {
        // Project the chord back onto the sphere and lift it a little: a route,
        // not a wire.
        const len = Math.hypot(ex, ey, ez) || 1
        const lift = (GLOBE_RADIUS * (1 + 0.055 * Math.sin(Math.PI * u))) / len
        ex *= lift
        ey *= lift
        ez *= lift
      }
      out[i] = ex + (r() - 0.5) * 0.04
      out[i + 1] = ey + (r() - 0.5) * 0.04
      out[i + 2] = ez + (r() - 0.5) * 0.04
    }
  }
  return out
}

// ── THE INTRO CHAOS ─────────────────────────────────────────────────────────
// Where the substance comes from: a loose shell outside the frustum.
export function buildChaos(count: number): Float32Array {
  const out = alloc(count)
  const r = prng(1971)
  for (let i = 0; i < count; i++) {
    const a = r() * TAU
    const b = Math.acos(2 * r() - 1)
    const rad = 7 + r() * 5
    const j = i * 3
    out[j] = Math.sin(b) * Math.cos(a) * rad
    out[j + 1] = Math.sin(b) * Math.sin(a) * rad
    out[j + 2] = Math.cos(b) * rad * 0.5
  }
  return out
}

// Per-particle randomness: size and drift phase.
export function buildSeeds(count: number): Float32Array {
  const out = new Float32Array(count)
  const r = prng(77)
  for (let i = 0; i < count; i++) out[i] = r()
  return out
}

// Intro stagger, 0 -> 1 across the lattice diagonal, so the chaos resolves as a
// sweep. Constant within a node: each of the 49 points arrives as one piece.
export function buildStagger(count: number): Float32Array {
  const out = new Float32Array(count)
  const perNode = count / NODE_COUNT
  const last = GRID_SIDE - 1
  for (let n = 0; n < NODE_COUNT; n++) {
    const col = n % GRID_SIDE
    const row = Math.floor(n / GRID_SIDE)
    const t = (col + (last - row)) / (last * 2)
    for (let k = 0; k < perNode; k++) out[n * perNode + k] = t
  }
  return out
}
