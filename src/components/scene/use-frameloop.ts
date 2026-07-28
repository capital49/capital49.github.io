import { useEffect, useState } from "react"

// Pause the render loop while the tab is hidden: switch the Canvas to on-demand
// (no RAF, no GPU work) when the page is backgrounded, back to continuous when it
// returns to the foreground.
//
// Deliberately starts on "always" and only reacts to visibilitychange — do NOT
// add an eager sync() that seeds from document.hidden on mount. ReadySignal
// dispatches "scene:ready" from the FIRST rendered frame, and Layout's overlay
// blocks the page reveal on that event. Seeding "demand" in a background tab
// means no first frame, so "scene:ready" never fires and every such load stalls
// on the overlay's 8s timeout instead. One wasted frame in a hidden tab is much
// cheaper than that.
export function useFrameloop(): "always" | "demand" {
  const [frameloop, setFrameloop] = useState<"always" | "demand">("always")
  useEffect(() => {
    const sync = () => setFrameloop(document.hidden ? "demand" : "always")
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])
  return frameloop
}
