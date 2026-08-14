import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  ShaderMaterial,
  Vector3,
} from "three"
import {
  DESKTOP_PER_NODE,
  MOBILE_PER_NODE,
  MOBIUS_RADIUS,
  MOBIUS_WIDTH,
  NODE_COUNT,
  buildChaos,
  buildDipole,
  buildGlobe,
  buildLattice,
  buildMobiusUV,
  buildRings,
  buildSeeds,
  buildStagger,
  sampleLogo,
} from "./continuum-shapes"

gsap.registerPlugin(ScrollTrigger)

export const CAMERA_Z = 12
export const FOV = 45

// The six stages of the continuum, in order. The same particles the whole way:
//
//   0 logo  ·  1 Möbius  ·  2 dipole  ·  3 seven rings  ·  4 network globe  ·  5 logo
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
// Vertical offset, world units. The hero lifts the mark clear of the centred
// headline beneath it.
const LIFT = [1.85, 0, 0, 0, 0, 0] as const
// The closing "49" opens out past the centred footer copy.
const SCALE = [0.92, 1, 1, 1, 1, 1.34] as const
// ...and dims as it opens, so centred type still wins on contrast.
const STAGE_ALPHA = [1, 1, 1, 1, 1, 0.55] as const
// X-axis rake. The Möbius is authored in XY, the dipole around +Y.
const TILT = [0, 0.52, 0.3, 0.22, 0.17, 0] as const
// Y-axis spin, radians per second. Zero on both logos: the mark has to read as a
// mark, so it holds and takes only the sway, the drift and pointer parallax.
const SPIN = [0, 0.11, 0.15, 0.2, 0.07, 0] as const

const vertexShader = /* glsl */ `
  attribute vec3 aLattice;
  attribute vec3 aGlyph;
  attribute vec3 aDipole;
  attribute vec3 aRings;
  attribute vec3 aGlobe;
  attribute vec3 aChaos;
  attribute vec2 aMobiusUV;
  attribute float aSeed;
  attribute float aStagger;

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
  vec3 mobiusAt(float t) {
    float u = aMobiusUV.x + t * 0.2;
    float v = aMobiusUV.y;
    float hu = u * 0.5;
    float r = ${MOBIUS_RADIUS.toFixed(3)} + v * ${MOBIUS_WIDTH.toFixed(3)} * cos(hu);
    return vec3(r * cos(u), r * sin(u), v * ${MOBIUS_WIDTH.toFixed(3)} * sin(hu));
  }

  vec3 pick(float i, vec3 mobius) {
    return aGlyph  * (eq(i, 0.0) + eq(i, 5.0))
         + mobius  * eq(i, 1.0)
         + aDipole * eq(i, 2.0)
         + aRings  * eq(i, 3.0)
         + aGlobe  * eq(i, 4.0);
  }

  void main() {
    vec3 mobius = mobiusAt(uTime);

    float s = clamp(uStage, 0.0, 5.0);
    float i0 = floor(s);
    float f = s - i0;
    vec3 p = mix(pick(i0, mobius), pick(min(i0 + 1.0, 5.0), mobius), smoother(f));

    // Every form is born from the 49 points and resolves back into them: the
    // midpoint of each transition is pulled home to the lattice.
    p = mix(p, aLattice, sin(PI * f) * uThrough);

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
    vAlpha = (0.3 + aSeed * 0.7) * uOpacity * uStageAlpha * (1.0 - g * 0.4);
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
    geo.setAttribute("aDipole", new BufferAttribute(buildDipole(total), 3))
    geo.setAttribute("aRings", new BufferAttribute(buildRings(total), 3))
    geo.setAttribute("aGlobe", new BufferAttribute(buildGlobe(total), 3))
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
          start: "top 88%",
          end: "top 18%",
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
      const sampled = await sampleLogo(count)
      if (cancelled) return
      if (sampled) {
        glyph.set(sampled)
        glyphAttr.needsUpdate = true
      }

      timeline = gsap.timeline()
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
    const { viewport, size, gl, camera } = state

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
      ((pointerNdc.current.x * viewport.width) / 2 - target.x) *
      Math.min(1, dt * 7)
    target.y +=
      ((pointerNdc.current.y * viewport.height) / 2 - target.y) *
      Math.min(1, dt * 7)
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
    spin.current += sample(SPIN, s) * dt
    uniforms.uStageAlpha.value = sample(STAGE_ALPHA, s)

    // Narrow viewports have no room to sit a form beside a column of text, so
    // the sculpture moves above the copy instead of beside it.
    const narrow = size.width < 900
    const fit = Math.min(Math.max(viewport.width / 9, 0.55), 1)
    group.scale.setScalar(fit * sample(SCALE, s))
    group.position.x = narrow
      ? 0
      : sample(SIDE, s) * Math.min(viewport.width * 0.19, 5)
    group.position.y = narrow ? viewport.height * 0.17 : sample(LIFT, s)

    // The sway is what keeps the held "49" from reading as a still image.
    const sway = Math.sin(uniforms.uTime.value * 0.13) * 0.055
    group.rotation.y = spin.current + sway + pointerNdc.current.x * 0.1 * parallax
    group.rotation.x = sample(TILT, s) - pointerNdc.current.y * 0.07 * parallax
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
