import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { resetSceneScroll, setSceneProgress } from "@/lib/scroll-bridge"

gsap.registerPlugin(ScrollTrigger)

// Scrub the `[data-scene-scroll]` element's scroll range into the frame-state
// bridge that the R3F scene reads inside useFrame.
//
// This deliberately lives on the DOM side rather than inside the Canvas: the
// canvas is persistent across navigations (`transition:persist`) while the
// scroll track element is swapped per route, so the trigger's lifetime belongs to
// the page, not the scene. Wiring it through `onPage` also means teardown runs on
// `astro:before-swap` — while the trigger's target is still mounted — which a
// React effect fundamentally cannot do, since its cleanup only runs after the
// swap has already removed the element (leaving ScrollTrigger measuring a
// detached node).
//
// Routes without a `[data-scene-scroll]` element reset progress to 0 rather than
// leaving the scene frozen wherever the previous route's scroll left it.
export function initSceneScroll(): () => void {
  const track = document.querySelector<HTMLElement>("[data-scene-scroll]")
  if (!track) {
    resetSceneScroll()
    return () => {}
  }

  const trigger = ScrollTrigger.create({
    trigger: track,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => setSceneProgress(self.progress),
    onLeaveBack: () => setSceneProgress(0),
  })

  return () => {
    trigger.kill()
    resetSceneScroll()
  }
}
