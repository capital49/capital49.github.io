// Shared `prefers-reduced-motion` query. The hero/reveal DOM inits and the React
// canvas hooks branch on this at setup time to drop transform-based motion
// (slides, scrubbed 3D moves) while keeping the opacity fades that aid
// comprehension.
export const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
