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
export const NETGRID_SPACING = 0.84 // the network's 7 x 7 grid spans 5.04
// Mirrored in the vertex shader, which evaluates the Möbius per frame so the
// points flow along the strip instead of sitting on it. The centre line is a
// figure-eight (Gerono lemniscate): x = A cos u, y = B sin u cos u, lifted
// ±LIFT out of plane so the two strands clear each other at the crossover.
export const MOBIUS_A = 2.5 // half-span of the eight
export const MOBIUS_B = 1.7 // lobe height = B / 2
export const MOBIUS_LIFT = 0.4
export const MOBIUS_WIDTH = 0.8 // band half-width

const TAU = Math.PI * 2

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
export async function sampleLogo(
  count: number,
  iconOnly = false,
): Promise<Float32Array | null> {
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

  // The bars icon sits left of the wordmark, separated by the widest empty
  // column run in the image. With iconOnly, everything right of it is dropped.
  let cutoff = w
  if (iconOnly) {
    const occupied = new Uint8Array(w)
    for (let px = 0; px < w; px++) {
      for (let py = 0; py < h; py++) {
        if (img[(py * w + px) * 4 + 3] > 110) {
          occupied[px] = 1
          break
        }
      }
    }
    let started = false
    let run = 0
    let gapStart = 0
    const minRun = Math.max(4, Math.round(w * 0.025))
    for (let px = 0; px < w && cutoff === w; px++) {
      if (occupied[px]) {
        started = true
        run = 0
      } else if (started) {
        if (run === 0) gapStart = px
        run++
        if (run >= minRun) cutoff = gapStart
      }
    }
  }

  const xs: number[] = []
  const ys: number[] = []
  const gap = 3
  let minX = w
  let maxX = 0
  let minY = h
  let maxY = 0
  for (let py = 0; py < h; py += gap) {
    for (let px = 0; px < cutoff; px += gap) {
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
  // Stratified slots keep the strip evenly loaded; the shuffle decorrelates the
  // slot from the particle index. Without it, each 49th of the index range (one
  // lattice/logo cluster) owns one contiguous arc, and the morphs read as 49
  // chunks flying to 49 segments instead of one cloud dissolving onto the strip.
  const order = new Uint32Array(count)
  for (let i = 0; i < count; i++) order[i] = i
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  for (let i = 0; i < count; i++) {
    out[i * 2] = ((order[i] + r()) / count) * TAU
    out[i * 2 + 1] = r() * 2 - 1
  }
  return out
}

// ── THE VORTEX ──────────────────────────────────────────────────────────────
// 49 strands growing out of a single point on the ground. Each one is a helix
// that hugs the stem, then flares into its own sweeping arc — a few never
// leave the floor and lay flat loops around the base instead. One origin,
// many trajectories: the dawn.
//
// Mirrored in the vertex shader: the Möbius -> vortex morph collapses into
// this point before growing back out.
export const VORTEX_BASE_Y = -2.6

// Returns the positions plus, for the shader's growth animation: each
// particle's parameter along its strand (grow: 0 = the origin, 1 = the tip)
// and its strand's helix constants (strandA: phase, turns in radians, radius;
// strandB: flare exponent, height) — so the shader can re-evaluate the strand
// at any parameter and walk a particle *along* its branch.
export function buildVortex(count: number): {
  positions: Float32Array
  grow: Float32Array
  strandA: Float32Array
  strandB: Float32Array
} {
  const out = alloc(count)
  const grow = new Float32Array(count)
  const strandA = new Float32Array(count * 3)
  const strandB = new Float32Array(count * 2)
  const r = prng(303)
  const perLine = count / NODE_COUNT

  for (let n = 0; n < NODE_COUNT; n++) {
    const grounded = r() < 0.16
    const phase = r() * TAU
    const turns = grounded ? 1 + r() * 0.8 : 1.6 + r() * 1.9
    const height = grounded ? 0.15 + r() * 0.3 : 2.2 + r() * 3.1
    const radius = grounded ? 2.2 + r() * 1.4 : 1.1 + r() * 2.6
    // How long the strand hugs the stem before flaring out.
    const flare = grounded ? 0.45 : 1.9 + r() * 1.3

    for (let k = 0; k < perLine; k++) {
      const u = (k + r()) / perLine
      // Sampling biased toward t = 0, so the shared origin reads as a dense stem.
      const t = Math.pow(u, 1.35)
      const a = phase + turns * TAU * t
      const rad = radius * Math.pow(t, flare)
      const idx = n * perLine + k
      const i = idx * 3
      grow[idx] = t
      strandA[i] = phase
      strandA[i + 1] = turns * TAU
      strandA[i + 2] = radius
      strandB[idx * 2] = flare
      strandB[idx * 2 + 1] = height
      out[i] = Math.cos(a) * rad + (r() - 0.5) * 0.03
      out[i + 1] = VORTEX_BASE_Y + height * t + (r() - 0.5) * 0.03
      out[i + 2] = Math.sin(a) * rad + (r() - 0.5) * 0.03
    }
  }
  return { positions: out, grow, strandA, strandB }
}

// ── THREE RINGS · VILLARCEAU WREATH ─────────────────────────────────────────
// Three Villarceau circles of one torus. Every such circle threads through
// every other, so the three interlock as a woven torus knot rather than a
// globe of hoops. Only (ring angle, orbit angle) is stored — the circle
// itself is evaluated per frame in the vertex shader, so the particles orbit
// along their own rings.
export const RING_COUNT = 3
export const RING_MAJOR = 2.3 // Villarceau radius = the torus' major radius
export const RING_MINOR = 1.15 // tube radius; sin(plane tilt) = MINOR / MAJOR
export function buildRingUV(count: number): Float32Array {
  const out = new Float32Array(count * 2)
  const r = prng(3131)
  const perRing = count / RING_COUNT
  // Stratified slots keep each ring evenly loaded; the shuffle decorrelates
  // ring and arc position from the particle index, so morphs read as one
  // cloud dissolving onto the rings rather than clusters flying to segments.
  const order = new Uint32Array(count)
  for (let i = 0; i < count; i++) order[i] = i
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  for (let i = 0; i < count; i++) {
    // Which of the three circles, as its rotation around the torus axis...
    out[i * 2] = (Math.floor(order[i] / perRing) / RING_COUNT) * TAU
    // ...and where on it — stratified so the ring is evenly loaded, jittered
    // so it is not a comb.
    out[i * 2 + 1] = (((order[i] % perRing) + r()) / perRing) * TAU
  }
  return out
}

// ── THE NETWORK GRID ────────────────────────────────────────────────────────
// The 49 lattice points as a flat 7 x 7 grid facing the camera: a small
// wireframe cube sits on every intersection, and the rest of each node's share
// runs along the grid lines to its right and lower neighbours, so the lines
// tile into a complete net with no doubled edges.
export function buildNetGrid(count: number): Float32Array {
  const out = alloc(count)
  const r = prng(200)
  const perNode = count / NODE_COUNT
  const half = 0.1 // cube half-side
  const mid = (GRID_SIDE - 1) / 2
  const cube = Math.max(8, Math.round(perNode * 0.45))

  for (let n = 0; n < NODE_COUNT; n++) {
    const col = n % GRID_SIDE
    const row = Math.floor(n / GRID_SIDE)
    const cx = (col - mid) * NETGRID_SPACING
    const cy = (mid - row) * NETGRID_SPACING

    const links: Array<[number, number]> = []
    if (col < GRID_SIDE - 1) links.push([cx + NETGRID_SPACING, cy])
    if (row < GRID_SIDE - 1) links.push([cx, cy - NETGRID_SPACING])

    for (let k = 0; k < perNode; k++) {
      const i = (n * perNode + k) * 3
      if (k < cube || links.length === 0) {
        // One of the cube's 12 edges: pick the axis it runs along, fix the
        // other two at a face, slide along it.
        const axis = Math.floor(r() * 3)
        const sa = r() < 0.5 ? -half : half
        const sb = r() < 0.5 ? -half : half
        const t = (r() * 2 - 1) * half
        out[i] = cx + (axis === 0 ? t : sa)
        out[i + 1] = cy + (axis === 1 ? t : axis === 0 ? sa : sb)
        out[i + 2] = axis === 2 ? t : sb
        continue
      }
      const link = links[Math.floor(r() * links.length)] ?? [cx, cy]
      const u = r()
      out[i] = cx + (link[0] - cx) * u + (r() - 0.5) * 0.02
      out[i + 1] = cy + (link[1] - cy) * u + (r() - 0.5) * 0.02
      out[i + 2] = (r() - 0.5) * 0.02
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
