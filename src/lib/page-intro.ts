import gsap from "gsap"
import { prefersReducedMotion } from "@/lib/reduced-motion"

// Page-intro choreography: the loading overlay reveals the page, the hero's
// border lines draw, then the hero panels slide in and "hero:reveal" fires for
// anything that animates in alongside them (notably the 3D scene).

// Run `callback` once Layout's loading overlay has revealed the page. If the
// reveal already happened, fire immediately; otherwise wait for "page:revealed".
// Returns an unsubscribe so a page leaving before the reveal can drop the pending
// listener.
export function whenPageRevealed(callback: () => void): () => void {
  if (window.__pageRevealed) {
    callback()
    return () => {}
  }
  window.addEventListener("page:revealed", callback, { once: true })
  return () => window.removeEventListener("page:revealed", callback)
}

// initPageIntro draws the hero's border lines, then sets window.__heroRevealed
// and fires "hero:reveal". Anything that animates in with the hero subscribes
// here; if the reveal already happened, the callback runs immediately. Returns an
// unsubscribe function.
export function onHeroReveal(callback: () => void): () => void {
  if (window.__heroRevealed) {
    callback()
    return () => {}
  }
  window.addEventListener("hero:reveal", callback, { once: true })
  return () => window.removeEventListener("hero:reveal", callback)
}

// Draw the hero's border lines: horizontals first (left→right, together), then
// verticals (top→bottom, together), ~1s total. Returns the timeline so callers
// can chain their own reveal beats (panel fades, a hold, the "hero:reveal" event)
// off its completion.
export function drawHeroLines(): gsap.core.Timeline {
  const horizontals = gsap.utils.toArray<HTMLElement>('[data-hero-line="h"]')
  const verticals = gsap.utils.toArray<HTMLElement>('[data-hero-line="v"]')

  const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
  // Reduced motion: snap the border lines to drawn (no left→right / top→bottom
  // sweep). The empty timeline still resolves immediately, so callers' chained
  // reveal beats (panel fades, the "hero:reveal" dispatch) fire as usual.
  if (prefersReducedMotion()) {
    gsap.set([...horizontals, ...verticals], { scaleX: 1, scaleY: 1 })
    return tl
  }
  if (horizontals.length)
    tl.fromTo(horizontals, { scaleX: 0 }, { scaleX: 1, duration: 0.6 })
  if (verticals.length)
    tl.fromTo(verticals, { scaleY: 0 }, { scaleY: 1, duration: 0.4 })
  return tl
}

// Slide the hero panels in together. `data-hero-reveal="top"` comes down from
// above, `="bottom"` comes up from below, anything else drifts up a shorter
// distance. All fade in on the same beat.
function playHeroPanels(): gsap.core.Timeline {
  const panels = gsap.utils.toArray<HTMLElement>("[data-hero-reveal]")

  const tl = gsap.timeline({ defaults: { duration: 1, ease: "power3.out" } })
  if (!panels.length) return tl

  // Reduced motion: fade the panels in place — no vertical slide.
  if (prefersReducedMotion()) {
    tl.fromTo(panels, { opacity: 0 }, { opacity: 1 }, 0)
    return tl
  }

  for (const panel of panels) {
    const from = panel.dataset.heroReveal
    const y = from === "top" ? -64 : from === "bottom" ? 64 : 32
    tl.fromTo(panel, { y, opacity: 0 }, { y: 0, opacity: 1 }, 0)
  }
  return tl
}

// Wired via onEveryPage, so this runs on every route and must fully tear down.
// Returns a teardown that drops the pending reveal listener and kills any
// in-flight tweens.
export function initPageIntro(): () => void {
  let lines: gsap.core.Timeline | null = null
  let panels: gsap.core.Timeline | null = null

  // Border lines draw first; hold on the finished frame for a beat, then the
  // panels slide in and "hero:reveal" fires. The event is dispatched even under
  // reduced motion — the 3D scene's opacity fade is gated on it and still has to
  // run.
  const start = (): void => {
    lines = drawHeroLines()
      .to({}, { duration: 0.2 })
      .eventCallback("onComplete", () => {
        window.__heroRevealed = true
        window.dispatchEvent(new CustomEvent("hero:reveal"))
        panels = playHeroPanels()
      })
  }

  // Hold off until Layout's loading overlay has fully revealed the page,
  // otherwise the reveal plays hidden behind the overlay.
  const stop = whenPageRevealed(start)

  return () => {
    stop()
    lines?.kill()
    panels?.kill()
  }
}
