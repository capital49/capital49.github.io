import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Euler,
  Group,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three"
import {
  DESKTOP_PER_NODE,
  MOBILE_PER_NODE,
  MOBIUS_A,
  MOBIUS_B,
  MOBIUS_LIFT,
  MOBIUS_WIDTH,
  NODE_COUNT,
  buildChaos,
  buildNetGrid,
  buildLattice,
  buildMobiusUV,
  buildRingUV,
  buildSeeds,
  buildStagger,
  buildVortex,
  RING_MAJOR,
  RING_MINOR,
  sampleLogo,
  VORTEX_BASE_Y,
} from "./continuum-shapes"

// The Villarceau plane's tilt against the torus equator, precomputed for the
// shader: sin = MINOR / MAJOR.
const RING_COS = Math.sqrt(1 - (RING_MINOR / RING_MAJOR) ** 2)
const RING_SIN = RING_MINOR / RING_MAJOR

gsap.registerPlugin(ScrollTrigger)

export const CAMERA_Z = 12
export const FOV = 45
// The design reference: a 16:9 viewport. On desktop the camera pins the visible
// width at z = 0 to what 16:9 shows, dollying back as the window gets
// relatively shorter — so the sculpture's on-screen size follows page width
// alone and ignores window height. Narrow viewports keep the height-fit camera:
// their layout stacks the sculpture above the copy instead.
export const REF_ASPECT = 16 / 9

// The six stages of the continuum, in order. The same particles the whole way:
//
//   0 logo  ·  1 Möbius  ·  2 vortex  ·  3 seven rings  ·  4 network globe  ·  5 logo
//
// The page closes on the form it opened with, so stage 5 reads the same
// attribute as stage 0 — only larger, dimmer, and with the type inside it.
//
// Every array below is sampled at the *fractional* stage, so each value moves
// continuously with the morph instead of snapping at a section boundary.

// Which side of the viewport the form counter-weights to, as a fraction of
// viewport width. Copy zigzags centre/left/right/left/right/centre; the
// sculpture takes the vacated side and never shares one with the type.
const SIDE = [0, 1, -1, 1, -1, 0] as const
// Vertical offset, world units. A small hero lift centres the mark in the
// framed window, which sits a touch above the viewport centre; the closing
// logo rides a little higher, filling the footer page above its centred copy.
const LIFT = [0.15, 0, 0, 0, 0, 0.55] as const
// Narrow viewports pin every form at the same height above the copy; the hero
// icon alone sits a touch lower, back into the framed window.
const NARROW_DROP = [0.45, 0, 0, 0, 0, 0] as const
// The hero holds the logo large; the closing one opens out past the centred
// footer copy.
const SCALE = [1.9, 1, 1, 1, 1, 1.5] as const
// ...and dims as it opens, so centred type still wins on contrast.
const STAGE_ALPHA = [1, 1, 1, 1, 1, 0.55] as const
// X-axis rake. The Möbius eight is authored in XY; ~60° leans it back into
// the low three-quarter view where both lobes and the crossover read. The
// vortex grows up +Y and stays nearly upright.
// The network grid is flat and face-on: no rake, no spin — only the sway, the
// drift and pointer parallax, like the logos.
const TILT = [0, 1.05, 0.12, 0.22, 0, 0] as const
// Y-axis spin, radians per second. Zero on both logos: the mark has to read as a
// mark, so it holds and takes only the sway, the drift and pointer parallax.
const SPIN = [0, 0.11, 0.15, 0.2, 0, 0] as const
// The spin is an accumulator that never unwinds, so the logos also need its
// accumulated angle eased out entirely — otherwise whatever residual built up
// mid-page comes back to the hero as a permanent yaw offset.
const SPIN_MIX = [0, 1, 1, 1, 0, 0] as const

const vertexShader = /* glsl */ `
  attribute vec3 aLattice;
  attribute vec3 aGlyph;
  attribute vec3 aVortex;
  attribute vec2 aRingUV;
  attribute vec3 aNet;
  attribute vec3 aChaos;
  attribute vec2 aMobiusUV;
  attribute float aSeed;
  attribute float aStagger;
  attribute float aGrow;
  attribute vec3 aStrandA;
  attribute vec2 aStrandB;

  uniform float uStage;          // 0..5, continuous
  uniform float uIntro;          // 1 -> 0 on load, once
  uniform float uTime;
  uniform float uThrough;        // how far each morph detours via the lattice
  uniform vec3 uPointer;         // world space, on the z = 0 plane
  uniform float uPointerStrength;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uHeightScale;
  uniform float uOpacity;
  uniform float uStageAlpha;
  uniform mat4 uMobiusFrame;   // pins the strip to its own placement mid-suck

  varying float vAlpha;

  const float PI = 3.14159265;

  // 1.0 when a == b, 0.0 for any other integer pair — attribute selection
  // without dynamic indexing.
  float eq(float a, float b) { return 1.0 - min(abs(a - b), 1.0); }

  float smoother(float x) {
    x = clamp(x, 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  // The one live formation: the strip is evaluated per frame, so the cloud runs
  // along it. One edge, one surface — you cannot get back without turning over.
  // A Möbius band swept along a figure-eight: the centre line is a Gerono
  // lemniscate lifted out of plane at the crossover, and the ribbon offset
  // rotates by a half-turn per circuit in the curve's own moving frame.
  vec3 mobiusAt(float t) {
    float u = aMobiusUV.x + t * 0.2;
    float v = aMobiusUV.y;
    vec3 c = vec3(
      ${MOBIUS_A.toFixed(3)} * cos(u),
      ${MOBIUS_B.toFixed(3)} * sin(u) * cos(u),
      ${MOBIUS_LIFT.toFixed(3)} * sin(u)
    );
    vec3 dc = vec3(
      -${MOBIUS_A.toFixed(3)} * sin(u),
      ${MOBIUS_B.toFixed(3)} * cos(2.0 * u),
      ${MOBIUS_LIFT.toFixed(3)} * cos(u)
    );
    vec3 tng = normalize(dc);
    vec3 n1 = normalize(cross(tng, vec3(0.0, 0.0, 1.0)));
    vec3 n2 = cross(tng, n1);
    float hu = u * 0.5;
    return c + (cos(hu) * n1 + sin(hu) * n2) * (v * ${MOBIUS_WIDTH.toFixed(3)});
  }

  // Three Villarceau circles of one torus, evaluated per frame so the cloud
  // orbits along its own ring. Every circle threads through every other — the
  // wreath reads as a woven torus knot, not a globe of hoops.
  vec3 ringsAt(float time) {
    float t = aRingUV.y + time * 0.35;
    vec3 p = vec3(
      ${(RING_MAJOR * RING_COS).toFixed(4)} * cos(t),
      ${RING_MINOR.toFixed(3)} + ${RING_MAJOR.toFixed(3)} * sin(t),
      ${(RING_MAJOR * RING_SIN).toFixed(4)} * cos(t)
    );
    float cp = cos(aRingUV.x);
    float sp = sin(aRingUV.x);
    p = vec3(p.x * cp - p.y * sp, p.x * sp + p.y * cp, p.z);
    return p + vec3(sin(aSeed * 47.0), sin(aSeed * 89.0), sin(aSeed * 173.0)) * 0.2;
  }

  vec3 pick(float i, vec3 mobius, vec3 rings) {
    return aGlyph  * (eq(i, 0.0) + eq(i, 5.0))
         + mobius  * eq(i, 1.0)
         + aVortex * eq(i, 2.0)
         + rings   * eq(i, 3.0)
         + aNet    * eq(i, 4.0);
  }

  void main() {
    vec3 mobius = mobiusAt(uTime);
    vec3 rings = ringsAt(uTime);

    float s = clamp(uStage, 0.0, 5.0);
    float i0 = floor(s);
    float f = s - i0;
    vec3 p;
    float fade = 1.0;
    if (i0 == 1.0) {
      // Möbius -> vortex, in two acts.
      vec3 origin = vec3(0.0, ${VORTEX_BASE_Y.toFixed(2)}, 0.0);
      // Act 1 — suction: particles peel off the strip one by one (aSeed
      // staggers the release) and accelerate into the origin on the ground.
      // The group already sits at the vortex's placement; uMobiusFrame warps
      // the strip back to its own stage-1 placement, so the strip holds still
      // and only the released particles travel to the drain.
      vec3 strip = (uMobiusFrame * vec4(mobius, 1.0)).xyz;
      float c = min(f / 0.45, 1.0);
      float fall = pow(clamp((c - aSeed * 0.7) / 0.3, 0.0, 1.0), 1.6);
      // Not a straight line: a particle's offset from the drain is swirled
      // around the vertical axis while it shrinks, and bows outward
      // mid-flight — the streams corkscrew into the point like a whirlpool
      // feeding the vortex, instead of darting straight at it.
      vec3 rel = strip - origin;
      float swirl = fall * (2.2 + aSeed * 2.6);
      float cs = cos(swirl);
      float sn = sin(swirl);
      rel = vec3(rel.x * cs - rel.z * sn, rel.y, rel.x * sn + rel.z * cs);
      // Super-linear contraction keeps the streams hugging the drain — a
      // tight funnel with only a whisper of an arc, not a wide sweep.
      float shrink = pow(1.0 - fall, 1.7) * (1.0 + 0.06 * sin(PI * fall));
      vec3 sucked = origin + rel * shrink;
      // Act 2 — growth: each particle rides its own strand out of the origin
      // (aStrandA/B hold the helix constants), retracing the positions of the
      // particles ahead of it — the substance extends along the branches
      // instead of flying straight to its seat.
      float g = smoother(clamp((f - 0.45) / 0.55, 0.0, 1.0));
      float t = max(aGrow * g, 1.0e-4);
      float ang = aStrandA.x + aStrandA.y * t;
      float rad = aStrandA.z * pow(t, aStrandB.x);
      vec3 branch = vec3(
        cos(ang) * rad,
        ${VORTEX_BASE_Y.toFixed(2)} + aStrandB.y * t,
        sin(ang) * rad
      );
      p = mix(sucked, mix(branch, aVortex, g), min(g * 8.0, 1.0));
      // The drain swallows light too: each particle dims as it falls and is
      // gone at the point; the substance then re-kindles, staggered, as the
      // tree extends — nothing visibly teleports between the two acts. A 0.1
      // floor keeps the cloud faintly present through the drain rather than
      // going fully dark.
      float vanish = 1.0 - smoother(clamp(fall / 0.65, 0.0, 1.0));
      float reveal = smoother(clamp((g - 0.06 - aSeed * 0.2) / 0.5, 0.0, 1.0));
      fade = max(max(vanish, reveal), 0.1);
    } else if (i0 == 2.0) {
      // Vortex -> rings: the drain's whirlpool flow without the drain. Each
      // particle peels off in its own time (aSeed staggers the release) and
      // corkscrews around the vertical axis on its way to its ring seat; the
      // swirl and the slight inward breath both vanish at the endpoints, so
      // the two forms land exactly.
      float w = smoother(clamp((f - aSeed * 0.22) / 0.78, 0.0, 1.0));
      vec3 pm = mix(aVortex, rings, w);
      float arc = sin(PI * w);
      float swirl = arc * (1.6 + aSeed * 1.8);
      float cs = cos(swirl);
      float sn = sin(swirl);
      pm = vec3(pm.x * cs - pm.z * sn, pm.y, pm.x * sn + pm.z * cs);
      pm.xz *= 1.0 - 0.18 * arc;
      p = pm;
    } else {
      p = mix(pick(i0, mobius, rings), pick(min(i0 + 1.0, 5.0), mobius, rings), smoother(f));
      // Every other form is born from the 49 points and resolves back into
      // them: the midpoint of its transition is pulled home to the lattice.
      p = mix(p, aLattice, sin(PI * f) * uThrough);
    }

    // Barely-there drift. A held form is never completely dead.
    float t = uTime + aSeed * 6.2831853;
    p += vec3(sin(t * 0.33), cos(t * 0.27), sin(t * 0.21)) * 0.035;

    // The intro, once and off the scrollbar: chaos -> the logo, one move.
    float g = clamp(uIntro * 1.35 - aStagger * 0.35, 0.0, 1.0);
    p = mix(p, aChaos, smoother(g));

    // Pointer well in world space, after the group transform, so the dent tracks
    // the cursor rather than the object.
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec2 d = world.xy - uPointer.xy;
    float fall = exp(-dot(d, d) * 0.75) * uPointerStrength;
    world.xy += normalize(d + vec2(1e-4)) * fall * 0.8;
    world.z += fall * 0.45;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, uSize * uPixelRatio * (0.55 + aSeed * 0.9) * (uHeightScale / -mv.z));
    vAlpha = (0.3 + aSeed * 0.7) * uOpacity * uStageAlpha * (1.0 - g * 0.4) * fade;
  }
`

const fragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    gl_FragColor = vec4(vec3(1.0), smoothstep(0.25, 0.02, d) * vAlpha);
  }
`

// Sample a per-stage constant at a fractional stage, smootherstepped so the
// value eases exactly like the morph it accompanies.
function sample(values: readonly number[], stage: number): number {
  const clamped = Math.min(Math.max(stage, 0), values.length - 1)
  const i = Math.floor(clamped)
  const f = clamped - i
  const a = values[i] ?? 0
  const b = values[Math.min(i + 1, values.length - 1)] ?? 0
  return a + (b - a) * (f * f * f * (f * (f * 6 - 15) + 10))
}

export function ContinuumField() {
  const groupRef = useRef<Group>(null!)

  // Scroll writes the target, the frame loop chases it. One source of truth, so
  // the load-in and the scrub can never fight over the uniform — and the lag is
  // what gives the sculpture weight.
  const stageTarget = useRef(0)
  const stage = useRef(0)
  const spin = useRef(0)

  // NDC pointer, filled from window events — the canvas is pointer-events: none
  // so the page underneath stays clickable.
  const pointerNdc = useRef({ x: 0, y: 0, active: false })
  const pointerWorld = useRef(new Vector3(0, 0, 0))
  const pointerStrength = useRef(0)

  // Scratch objects for the strip-pinning matrix, allocated once.
  const scratch = useMemo(
    () => ({
      pos: new Vector3(),
      scl: new Vector3(),
      euler: new Euler(),
      quat: new Quaternion(),
      m1: new Matrix4(),
      m2: new Matrix4(),
    }),
    []
  )

  const { geometry, material, uniforms, glyph, glyphAttr, count } = useMemo(() => {
    const perNode =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
        ? MOBILE_PER_NODE
        : DESKTOP_PER_NODE
    const total = NODE_COUNT * perNode

    const lattice = buildLattice(total)
    // Seeded with the lattice: if fonts or the 2D raster fail, the mark simply
    // stays the 49 points rather than collapsing to the origin.
    const glyphArray = lattice.slice()
    const glyphAttribute = new BufferAttribute(glyphArray, 3)

    const geo = new BufferGeometry()
    geo.setAttribute("position", new BufferAttribute(lattice.slice(), 3))
    geo.setAttribute("aLattice", new BufferAttribute(lattice, 3))
    geo.setAttribute("aGlyph", glyphAttribute)
    const vortex = buildVortex(total)
    geo.setAttribute("aVortex", new BufferAttribute(vortex.positions, 3))
    geo.setAttribute("aGrow", new BufferAttribute(vortex.grow, 1))
    geo.setAttribute("aStrandA", new BufferAttribute(vortex.strandA, 3))
    geo.setAttribute("aStrandB", new BufferAttribute(vortex.strandB, 2))
    geo.setAttribute("aRingUV", new BufferAttribute(buildRingUV(total), 2))
    geo.setAttribute("aNet", new BufferAttribute(buildNetGrid(total), 3))
    geo.setAttribute("aChaos", new BufferAttribute(buildChaos(total), 3))
    geo.setAttribute("aMobiusUV", new BufferAttribute(buildMobiusUV(total), 2))
    geo.setAttribute("aSeed", new BufferAttribute(buildSeeds(total), 1))
    geo.setAttribute("aStagger", new BufferAttribute(buildStagger(total), 1))
    geo.setDrawRange(0, total)

    const u = {
      uStage: { value: 0 },
      uIntro: { value: 1 },
      uTime: { value: 0 },
      uThrough: { value: 0.42 },
      uPointer: { value: new Vector3(0, 0, 0) },
      uPointerStrength: { value: 0 },
      uSize: { value: perNode === MOBILE_PER_NODE ? 0.03 : 0.021 },
      uPixelRatio: { value: 1 },
      uHeightScale: { value: 1000 },
      uOpacity: { value: 0 },
      uStageAlpha: { value: 1 },
      uMobiusFrame: { value: new Matrix4() },
    }

    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: u,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })

    return {
      geometry: geo,
      material: mat,
      uniforms: u,
      glyph: glyphArray,
      glyphAttr: glyphAttribute,
      count: total,
    }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // ── Pointer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      pointerNdc.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerNdc.current.y = -(event.clientY / window.innerHeight) * 2 + 1
      pointerNdc.current.active = true
    }
    const onLeave = () => {
      pointerNdc.current.active = false
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("pointerleave", onLeave)
    window.addEventListener("blur", onLeave)
    return () => {
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerleave", onLeave)
      window.removeEventListener("blur", onLeave)
    }
  }, [])

  // ── Scroll: one trigger per section, each owning exactly one morph ─────────
  // A section scrubs the stage from (n-1) to n as it rises into view, then holds
  // while it is on screen. Section heights can differ without the timing
  // drifting, which a single page-length trigger could not survive.
  useEffect(() => {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-stage]")
    )
      .map((el) => {
        const target = Number(el.dataset.stage)
        if (!Number.isFinite(target) || target < 1) return null
        return ScrollTrigger.create({
          trigger: el,
          // A section can stretch its morph over a longer scroll run with
          // data-stage-start / data-stage-end.
          start: el.dataset.stageStart ?? "top 88%",
          end: el.dataset.stageEnd ?? "top 18%",
          scrub: true,
          onUpdate: (self) => {
            stageTarget.current = target - 1 + self.progress
          },
        })
      })
      .filter((trigger): trigger is ScrollTrigger => trigger !== null)

    ScrollTrigger.refresh()
    return () => triggers.forEach((trigger) => trigger.kill())
  }, [])

  // ── Load: the logo is sampled from its PNG, then the intro runs ────────────
  useEffect(() => {
    let cancelled = false
    // A reload partway down the page has no intro to protect: the substance is
    // already mid-continuum, so it simply appears in whatever form it is in.
    const deep = window.scrollY > window.innerHeight * 0.5
    let timeline: gsap.core.Timeline | null = null

    const run = async (): Promise<void> => {
      // On phones the full logotype packs too small to read as particles, so
      // the substance condenses into the bars icon alone.
      const iconOnly = window.matchMedia("(max-width: 900px)").matches
      const sampled = await sampleLogo(count, iconOnly)
      if (cancelled) return
      if (sampled) {
        glyph.set(sampled)
        glyphAttr.needsUpdate = true
      }

      // The page chrome holds itself hidden (html.intro-hold) until the
      // substance has finished forming — signalled here, not timed, so a slow
      // asset load can never let the type arrive before the logo.
      timeline = gsap.timeline({
        onComplete: () => window.dispatchEvent(new Event("continuum:formed")),
      })
      if (deep) {
        uniforms.uIntro.value = 0
        timeline.to(uniforms.uOpacity, {
          value: 1,
          duration: 0.9,
          ease: "power2.out",
        })
        return
      }
      timeline
        .to(uniforms.uOpacity, { value: 1, duration: 1.5, ease: "power2.out" }, 0)
        .to(uniforms.uIntro, { value: 0, duration: 3.2, ease: "power3.inOut" }, 0)
    }

    void run()
    return () => {
      cancelled = true
      timeline?.kill()
    }
  }, [count, glyph, glyphAttr, uniforms])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const { size, gl, camera } = state

    const aspect = size.width / size.height
    const narrow = size.width < 900
    // Width-fit camera: dolly (not zoom, so perspective never warps) until the
    // frustum at z = 0 is exactly REF_ASPECT's width. Floored so an ultra-wide
    // window cannot push the camera into the sculpture.
    camera.position.z = narrow
      ? CAMERA_Z
      : Math.max(7, CAMERA_Z * (REF_ASPECT / aspect))
    // The visible plane at z = 0, in world units.
    const vh = 2 * camera.position.z * Math.tan((FOV * Math.PI) / 360)
    const vw = vh * aspect

    uniforms.uTime.value += dt
    uniforms.uPixelRatio.value = gl.getPixelRatio()
    uniforms.uHeightScale.value =
      size.height / (2 * Math.tan((FOV * Math.PI) / 360))

    // Chase the scrubbed target: what turns a scroll position into motion with
    // mass, and doubles as the ease on every stage change.
    stage.current += (stageTarget.current - stage.current) * Math.min(1, dt * 5)
    uniforms.uStage.value = stage.current

    // Pointer, in world units on the z = 0 plane.
    const active = pointerNdc.current.active ? 1 : 0
    pointerStrength.current +=
      (active - pointerStrength.current) * Math.min(1, dt * 4)
    uniforms.uPointerStrength.value = pointerStrength.current
    const target = pointerWorld.current
    target.x +=
      ((pointerNdc.current.x * vw) / 2 - target.x) * Math.min(1, dt * 7)
    target.y +=
      ((pointerNdc.current.y * vh) / 2 - target.y) * Math.min(1, dt * 7)
    uniforms.uPointer.value.copy(target)

    // Camera parallax — small, lerped, always looking at the origin so the
    // sculpture is turned rather than slid.
    const parallax = pointerStrength.current
    camera.position.x +=
      (pointerNdc.current.x * 0.34 * parallax - camera.position.x) * 0.045
    camera.position.y +=
      (pointerNdc.current.y * 0.22 * parallax - camera.position.y) * 0.045
    camera.lookAt(0, 0, 0)

    const group = groupRef.current
    if (!group) return

    const s = stage.current
    // For the whole Möbius -> vortex morph the group sits at the vortex's
    // placement, so the drain point and the growing tree never move. The strip
    // is warped back to its own stage-1 placement inside the shader
    // (uMobiusFrame), so it also holds still while its particles leave it.
    const inSuck = s >= 1 && s < 2
    let sc = inSuck ? 2 : s
    // Vortex -> rings: hold the composition for the first fifth of the scrub
    // so the whirlpool is already turning before the group starts its travel —
    // swirl first, slide second.
    if (s >= 2 && s < 3) sc = 2 + Math.max(0, s - 2.2) / 0.8
    // Wrapping keeps the residual under one turn, so easing it out across a
    // transition is a single graceful counter-rotation at most.
    spin.current = (spin.current + sample(SPIN, sc) * dt) % (Math.PI * 2)
    uniforms.uStageAlpha.value = sample(STAGE_ALPHA, sc)

    // Narrow viewports have no room to sit a form beside a column of text, so
    // the sculpture moves above the copy instead of beside it.
    const fit = Math.min(Math.max(vw / 9, 0.55), 1)
    // The sway is what keeps a held form from reading as a still image.
    const sway = Math.sin(uniforms.uTime.value * 0.13) * 0.055
    // The composition for a given stage — one formula for both the group and
    // the strip's pinning matrix, so the two can never drift apart.
    const placeAt = (k: number) => ({
      scl: fit * sample(SCALE, k),
      px: narrow ? 0 : sample(SIDE, k) * Math.min(vw * 0.19, 5),
      py: narrow ? vh * 0.17 - sample(NARROW_DROP, k) : sample(LIFT, k),
      rx: sample(TILT, k) - pointerNdc.current.y * 0.07 * parallax,
      ry:
        spin.current * sample(SPIN_MIX, k) +
        sway +
        pointerNdc.current.x * 0.1 * parallax,
    })
    const here = placeAt(sc)
    group.scale.setScalar(here.scl)
    group.position.x = here.px
    group.position.y = here.py
    group.rotation.y = here.ry
    group.rotation.x = here.rx

    const frame = uniforms.uMobiusFrame.value
    if (inSuck) {
      // frame = (vortex placement)⁻¹ · (strip placement): what the pinned
      // group must apply to the strip so it renders exactly where stage 1
      // would have put it.
      const compose = (t: ReturnType<typeof placeAt>, m: Matrix4) =>
        m.compose(
          scratch.pos.set(t.px, t.py, 0),
          scratch.quat.setFromEuler(scratch.euler.set(t.rx, t.ry, 0)),
          scratch.scl.set(t.scl, t.scl, t.scl)
        )
      compose(here, scratch.m2)
      compose(placeAt(1), scratch.m1)
      frame.copy(scratch.m2).invert().multiply(scratch.m1)
    } else {
      frame.identity()
    }
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
