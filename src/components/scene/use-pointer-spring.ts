import { useEffect, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"

// Spring that eases a {x,y} value toward the pointer position. Tuned to feel
// heavily springed with medium damping: a soft stiffness so it lags the cursor,
// and an under-critical damping ratio so it slightly overshoots before settling.
const STIFFNESS = 40
const DAMPING = 6
// Clamp the timestep so a long frame (tab refocus, GC pause) can't blow the
// explicit integration up.
const MAX_DT = 1 / 30

export type PointerSpring = { x: number; y: number }

// Returns a ref whose .current.{x,y} spring toward the current pointer (each in
// roughly [-1, 1], origin at screen center, y up). Consumers read it inside their
// own frame loop and scale it into whatever rotation/offset they want.
//
// The target is read from a window-level pointermove listener rather than r3f's
// state.pointer: the scene canvas sits in a `fixed inset-0 z-0` div behind the
// foreground, so pointer events never reach r3f's event target and state.pointer
// would stay pinned at the origin. A global listener tracks the cursor wherever
// it is. Only refs are mutated, keeping the frame loop side-effect-clean.
export function usePointerSpring(): RefObject<PointerSpring> {
  const pos = useRef<PointerSpring>({ x: 0, y: 0 })
  const vel = useRef<PointerSpring>({ x: 0, y: 0 })
  const target = useRef<PointerSpring>({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      target.current.x = (event.clientX / window.innerWidth) * 2 - 1
      target.current.y = -(event.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_DT)
    const p = pos.current
    const v = vel.current
    const t = target.current
    v.x += (-STIFFNESS * (p.x - t.x) - DAMPING * v.x) * dt
    v.y += (-STIFFNESS * (p.y - t.y) - DAMPING * v.y) * dt
    p.x += v.x * dt
    p.y += v.y * dt
  })

  return pos
}
