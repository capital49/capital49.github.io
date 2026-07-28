// Lenis smooth scrolling, desktop only, paused for trackpad use.
//
// The site drives every scroll-linked animation through GSAP ScrollTrigger with
// pinned sections, so Lenis is wired into GSAP's ticker (not its own RAF loop)
// and pushes ScrollTrigger.update on each scroll — otherwise pins and
// scroll-progress timelines lag behind the smoothed scroll position.
//
// Touch/coarse-pointer devices keep native scrolling (desktop media query gate).
// On desktop, smoothing is ON by default (so notched mouse wheels — including
// fractional / high-res wheels — always get it) and only switches OFF when a
// trackpad is detected: there's no device API, but a vertical mouse wheel emits
// deltaX === 0, whereas trackpad gestures almost always carry a horizontal
// component. Purely-vertical trackpad scrolling can't be told apart and will
// keep smoothing on — an accepted limitation.

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"

gsap.registerPlugin(ScrollTrigger)

const DESKTOP = "(min-width: 768px)"
// Ignore vertical-only frames for this long after horizontal movement, so a
// trackpad flick's momentum tail (which dips to deltaX === 0) doesn't re-enable
// smoothing mid-gesture.
const TRACKPAD_HOLD_MS = 500

let lenis: Lenis | null = null
// While the loading overlay covers the screen we lock scrolling (see
// lockScroll). Gate start/stop on it so the trackpad/mouse detector can't
// create or destroy the Lenis instance mid-lock.
let locked = false

function raf(time: number): void {
  // GSAP ticker time is in seconds; Lenis expects milliseconds.
  lenis?.raf(time * 1000)
}

function start(): void {
  if (lenis || locked) return
  lenis = new Lenis({ autoRaf: false })
  lenis.on("scroll", ScrollTrigger.update)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)
}

function stop(): void {
  if (!lenis || locked) return
  gsap.ticker.remove(raf)
  lenis.destroy()
  lenis = null
}

// Freeze scrolling while the page-transition overlay is up. The scroll-linked
// scene animation is driven by ScrollTriggers whose positions are only accurate
// after a post-navigation ScrollTrigger.refresh(); letting the user scroll before
// that refresh maps their scroll onto stale trigger ranges and advances the scene
// at the wrong spot. Lock both the smoothed (Lenis) and native scroll paths.
export function lockScroll(): void {
  if (locked) return
  locked = true
  lenis?.stop()
  document.documentElement.style.overflow = "hidden"
}

export function unlockScroll(): void {
  if (!locked) return
  locked = false
  document.documentElement.style.overflow = ""
  lenis?.start()
}

// Runs once per session (hoisted Astro module). The Lenis instance persists
// across view transitions since it's bound to window scroll. The decision
// follows the latest device, so switching between a mouse and the trackpad flips
// smoothing accordingly.
export function initSmoothScroll(): void {
  const mq = window.matchMedia(DESKTOP)
  let lastHorizontal = 0

  if (mq.matches) start()

  const onWheel = (e: WheelEvent): void => {
    if (!mq.matches) return
    if (e.deltaX !== 0) {
      lastHorizontal = performance.now()
      stop() // horizontal component → trackpad → native scroll
    } else if (performance.now() - lastHorizontal > TRACKPAD_HOLD_MS) {
      start() // sustained vertical-only → mouse wheel → smooth
    }
  }
  window.addEventListener("wheel", onWheel, { capture: true, passive: true })

  mq.addEventListener("change", () => {
    if (mq.matches) start()
    else stop()
  })
}
