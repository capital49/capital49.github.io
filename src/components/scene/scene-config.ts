// Geometry and pose constants for the Capital49 mark.
//
// The mark is I Ching hexagram 49 (革 Gé, "Revolution"): six stacked lines, each
// solid (yang) or broken (yin). Measured off
// public/logos/Capital49-logo-square-black.png (1140x1141): bar width 455px, bar
// height 41px, row pitch 82.8px, centre gap 71px, total height 456px — a perfect
// square. Every ratio below is that measurement divided by the bar width, so the
// mark is defined in units of "one bar wide" and MARK_WIDTH is the only size knob.
//
// Deliberately free of any `three` import: this module is pure numbers, so an
// .astro file can read it at build time without dragging WebGL into SSR.

// bottom→top; true = yang (solid), false = yin (broken)
// solid, broken, solid, solid, solid, broken = Li below, Dui above = hexagram 49
export const HEXAGRAM_LINES = [true, false, true, true, true, false] as const

export const BAR_HEIGHT = 0.09 // 41 / 455
export const ROW_PITCH = 0.182 // 82.8 / 455
export const GAP_RATIO = 0.156 // 71 / 455
export const BAR_DEPTH = 0.09
export const MARK_WIDTH = 4.2 // the only size knob

// How far the mark travels toward the camera across a full page scroll.
export const SCROLL_Z_TRAVEL = 5.5

// Pointer parallax limits, in radians at full cursor deflection.
export const POINTER_YAW = 0.28
export const POINTER_PITCH = 0.22

export type Bar = { key: string; x: number; y: number; width: number }

// One entry per drawn rectangle: 4 solid lines + 2 broken lines × 2 halves = 8.
// Centred by construction — the rows are laid out symmetrically about y = 0, and
// the total span (5 * ROW_PITCH + BAR_HEIGHT = 1.000) is exactly the bar width,
// so the mark stays the square the logo file is.
export function buildBars(): Bar[] {
  const bars: Bar[] = []
  const segment = (1 - GAP_RATIO) / 2

  HEXAGRAM_LINES.forEach((isYang, i) => {
    const y = (i - (HEXAGRAM_LINES.length - 1) / 2) * ROW_PITCH
    if (isYang) {
      bars.push({ key: `line-${i}`, x: 0, y, width: 1 })
      return
    }
    const offset = (GAP_RATIO + segment) / 2
    bars.push({ key: `line-${i}-l`, x: -offset, y, width: segment })
    bars.push({ key: `line-${i}-r`, x: offset, y, width: segment })
  })

  return bars
}

export type ScenePose = {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
}

// Where the mark sits on each route. The canvas is mounted once under
// `transition:persist`, so navigation does not remount it — the scene tweens
// between these poses instead. The mark visibly travels from the page it left to
// the page it arrives on, which is the whole dividend of a persistent canvas over
// a per-page one: no reload, no re-reveal, one continuous object.
export const SCENE_POSES: Record<string, ScenePose> = {
  "/": { position: [0, -0.4, 0], rotation: [0, -0.35, 0], scale: 1 },
  "/portfolio": {
    position: [-4.4, 1.2, -3],
    rotation: [0.12, 0.85, -0.1],
    scale: 0.62,
  },
  "/team": {
    position: [4.4, 1.2, -3],
    rotation: [0.12, -0.85, 0.1],
    scale: 0.62,
  },
}
