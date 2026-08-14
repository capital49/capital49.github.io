import { useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { NoToneMapping } from "three"
import { CAMERA_Z, ContinuumField, FOV } from "./continuum-field"

// One persistent scene, one THREE.Points, one draw call, behind the whole page.
//
// Nothing loads asynchronously except the rasterized "49", which resolves into
// an already-allocated attribute — so there is no Suspense and no first-frame
// gap. Unlit additive points on a transparent canvas: the page's own black is
// the only backdrop the sculpture needs.
function hasWebGL(): boolean {
  try {
    const probe = document.createElement("canvas")
    return Boolean(
      probe.getContext("webgl2") ??
        probe.getContext("webgl") ??
        probe.getContext("experimental-webgl")
    )
  } catch {
    return false
  }
}

export default function ContinuumCanvas() {
  // Reduced motion and WebGL failure both get no canvas at all. `html.live` is
  // set pre-paint by an inline probe in the page; clearing it here hands the
  // page back to its designed static mark instead of leaving an empty hole.
  const [enabled, setEnabled] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const ok =
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      hasWebGL()
    setEnabled(ok)
    if (!ok) document.documentElement.classList.remove("live")
  }, [])

  useEffect(() => {
    if (!enabled) return
    const onVisibility = () => setPaused(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [enabled])

  if (!enabled) return null

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={paused ? "never" : "always"}
      camera={{ position: [0, 0, CAMERA_Z], fov: FOV }}
      gl={{ antialias: false, toneMapping: NoToneMapping }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={({ gl }) => {
        document.documentElement.classList.add("live")
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault()
          document.documentElement.classList.remove("live")
        })
        gl.domElement.addEventListener("webglcontextrestored", () => {
          document.documentElement.classList.add("live")
        })
      }}
    >
      <ContinuumField />
    </Canvas>
  )
}
