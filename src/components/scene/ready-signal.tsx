import { useRef } from "react"
import { useFrame } from "@react-three/fiber"

// Fires once on the first rendered frame so the rest of the page (Layout's
// loading overlay) knows the scene is live.
//
// With the persistent canvas this fires exactly ONCE for the whole session, not
// once per page: the component mounts on the first page load and survives every
// subsequent navigation. The Layout's overlay gate depends on that — it must treat
// `window.__sceneReady` as the durable record and not wait for a fresh
// "scene:ready" event after a client-side navigation.
export function ReadySignal() {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    window.__sceneReady = true
    window.dispatchEvent(new CustomEvent("scene:ready"))
  })
  return null
}
