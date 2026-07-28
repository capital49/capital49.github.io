import { Canvas } from "@react-three/fiber"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { NoToneMapping } from "three"
import { useIsMobile } from "@/hooks/use-mobile"
import { useFrameloop } from "./use-frameloop"
import { ReadySignal } from "./ready-signal"
import { Hexagram } from "./hexagram"

// Registered once at module scope so GSAP's context tracks every useGSAP call in
// the scene tree.
gsap.registerPlugin(useGSAP)

// The full-screen WebGL backdrop. Mounted once, under `transition:persist`, so it
// survives client-side navigation and the mark travels between routes instead of
// reloading.
//
// The canvas background stays transparent — no scene background, no clear colour —
// so the page's own background shows through and the DOM above it composites
// normally.
//
// There is no <Suspense> because nothing here loads asynchronously: the mark is
// parametric BoxGeometry, so it exists on the very first frame. That is the real
// dividend of building it from measurements rather than an SVG or a GLB.
export default function SceneCanvas() {
  // Stop rendering entirely while the tab is backgrounded.
  const frameloop = useFrameloop()
  // Lower the DPR ceiling on phones.
  const isMobile = useIsMobile()

  return (
    <Canvas
      frameloop={frameloop}
      dpr={isMobile ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 8], fov: 45 }}
      gl={{
        antialias: true,
        toneMapping: NoToneMapping,
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 6, 6]} intensity={1.4} />
      <directionalLight position={[-5, -3, 4]} intensity={0.6} />
      <directionalLight position={[0, -6, 3]} intensity={0.35} />
      <ReadySignal />
      <Hexagram />
    </Canvas>
  )
}
