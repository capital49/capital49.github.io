import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { BoxGeometry, Group, MeshStandardMaterial } from "three"
import { getSceneScroll } from "@/lib/scroll-bridge"
import { prefersReducedMotion } from "@/lib/reduced-motion"
import { onHeroReveal } from "@/lib/page-intro"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  BAR_DEPTH,
  BAR_HEIGHT,
  MARK_WIDTH,
  POINTER_PITCH,
  POINTER_YAW,
  SCENE_POSES,
  SCROLL_Z_TRAVEL,
  buildBars,
} from "./scene-config"
import { usePointerSpring } from "./use-pointer-spring"
import { useAstroRoute } from "./use-astro-route"

const REVEAL_SCALE = 0.86
const REVEAL_DURATION = 1.1
const POSE_DURATION = 1.2

// The Capital49 mark — hexagram 49 built from eight boxes.
//
// Four nested groups, one per driver, so the four things that move this object
// never write to the same transform:
//
//   parallaxRef  <- pointer spring       (useFrame)
//     poseRef    <- route target         (gsap, keyed on pathname)
//       scrollRef <- scroll-bridge       (useFrame: rotation.y, position.z)
//         revealRef <- one-shot scale-in (gsap, keyed on hero:reveal)
//
// Flattening any two of these would mean a tween and a per-frame write fighting
// over the same Euler, which reads as jitter.
export function Hexagram() {
  const parallaxRef = useRef<Group>(null!)
  const poseRef = useRef<Group>(null!)
  const scrollRef = useRef<Group>(null!)
  const revealRef = useRef<Group>(null!)

  const pathname = useAstroRoute()
  const pointer = usePointerSpring()
  const isMobile = useIsMobile()

  // window.matchMedia isn't available during SSR, and the frame loop shouldn't
  // re-query it 120 times a second, so latch it once on the client.
  const reduced = useRef(false)
  useEffect(() => {
    reduced.current = prefersReducedMotion()
  }, [])

  const bars = useMemo(() => buildBars(), [])

  // One geometry and one material for all eight bars. Sharing the material is
  // what makes the reveal a single opacity tween instead of eight.
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#888888",
        metalness: 0,
        roughness: 1,
        transparent: true,
        opacity: 0,
      }),
    []
  )
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Start already parked at the pose for the route we loaded on, so the first
  // pose tween below has nothing to do and the mark doesn't slide in from origin.
  const initialPose = useRef(SCENE_POSES[pathname] ?? SCENE_POSES["/"]).current

  // ── Reveal: one-shot scale + fade in, together with the hero ──
  // Deliberately NOT keyed on pathname. With a persistent canvas the mark stays
  // visible across navigation, so it reveals exactly once per session — the route
  // pose tween below IS the navigation motion, not a second reveal.
  useGSAP((_context, contextSafe) => {
    if (!contextSafe) return
    const play = contextSafe(() => {
      const duration = prefersReducedMotion() ? 0 : REVEAL_DURATION
      gsap.to(revealRef.current.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration,
        ease: "power3.out",
      })
      gsap.to(material, { opacity: 1, duration, ease: "power3.out" })
    })
    return onHeroReveal(play)
  }, [])

  // ── Route pose: tween toward wherever this page wants the mark ──
  // Deliberately NOT `revertOnUpdate`: reverting would snap the group back to the
  // previous route's pose before tweening, so the mark would jump and then move.
  // It has to travel from wherever it currently is — mid-flight included.
  useGSAP(
    () => {
      const pose = SCENE_POSES[pathname] ?? SCENE_POSES["/"]
      const duration = prefersReducedMotion() ? 0 : POSE_DURATION
      const ease = "power3.inOut"
      gsap.to(poseRef.current.position, {
        x: pose.position[0],
        y: pose.position[1],
        z: pose.position[2],
        duration,
        ease,
      })
      gsap.to(poseRef.current.rotation, {
        x: pose.rotation[0],
        y: pose.rotation[1],
        z: pose.rotation[2],
        duration,
        ease,
      })
      gsap.to(poseRef.current.scale, {
        x: pose.scale,
        y: pose.scale,
        z: pose.scale,
        duration,
        ease,
      })
    },
    { dependencies: [pathname] }
  )

  // ── Frame loop: scroll turn + pointer parallax ──
  // One useFrame, no allocations, no state. Reduced motion drops both; mobile
  // drops the parallax (no cursor to follow, and the spring is pure overhead).
  useFrame(() => {
    if (reduced.current) return

    const progress = getSceneScroll().progress
    scrollRef.current.rotation.y = progress * Math.PI * 2
    scrollRef.current.position.z = progress * SCROLL_Z_TRAVEL

    if (isMobile) return
    const spring = pointer.current
    parallaxRef.current.rotation.y = spring.x * POINTER_YAW
    parallaxRef.current.rotation.x = -spring.y * POINTER_PITCH
  })

  return (
    <group ref={parallaxRef}>
      <group
        ref={poseRef}
        position={initialPose.position}
        rotation={initialPose.rotation}
        scale={initialPose.scale}
      >
        <group ref={scrollRef}>
          <group ref={revealRef} scale={REVEAL_SCALE}>
            {bars.map((bar) => (
              <mesh
                key={bar.key}
                geometry={geometry}
                material={material}
                position={[bar.x * MARK_WIDTH, bar.y * MARK_WIDTH, 0]}
                scale={[
                  bar.width * MARK_WIDTH,
                  BAR_HEIGHT * MARK_WIDTH,
                  BAR_DEPTH * MARK_WIDTH,
                ]}
              />
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}
