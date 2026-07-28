// Home page copy. Placeholder text — replace with final copy.

export type ScrollStatement = {
  title: string
  body: string
}

export const HOME_HERO = {
  title: "Capital49",
  subtitle:
    "A venture fund founded by the founders of Airwallex, backing companies in fintech, e-commerce, AI, and B2B software.",
} as const

// Statements spaced down the [data-scene-scroll] track on the home page. The 3D
// mark's rotation and z-travel scrub against that same track.
export const SCROLL_STATEMENTS: readonly ScrollStatement[] = [
  {
    title: "Statement one goes here",
    body: "Short description goes here. One or two lines of supporting copy.",
  },
  {
    title: "Statement two goes here",
    body: "Short description goes here. One or two lines of supporting copy.",
  },
  {
    title: "Statement three goes here",
    body: "Short description goes here. One or two lines of supporting copy.",
  },
] as const
