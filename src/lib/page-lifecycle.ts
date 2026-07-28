// Per-page lifecycle for Astro's ClientRouter.
//
// `astro:page-load` listeners registered on `document` persist for the whole
// session and fire on every navigation, so page-specific setup leaks onto other
// routes unless it's gated. These helpers gate by route and run a teardown when
// navigating away — on `astro:before-swap`, while the leaving page's DOM is still
// mounted — so GSAP/ScrollTrigger instances tied to that DOM are cleaned up.

export type Cleanup = () => void
type Setup = () => Cleanup | void
type RouteMatcher = string | RegExp | ((pathname: string) => boolean)

// Drop a trailing slash (except root) so "/about" and "/about/" compare equal —
// Astro's default trailingSlash is "ignore", so either can reach the client.
// Exported so React-side route checks agree with these matchers on trailing
// slashes instead of re-implementing the rule.
export function normalizePath(path: string): string {
  return path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path
}

const normalize = normalizePath

function matches(route: RouteMatcher, pathname: string): boolean {
  const path = normalize(pathname)
  if (typeof route === "string") return path === normalize(route)
  if (route instanceof RegExp) return route.test(path)
  return route(path)
}

// Run `setup` each time the app navigates INTO a page matching `route` (and on
// initial load), then run its returned cleanup when navigating away. Use this for
// page-specific scripts so they never fire on other routes.
export function onPage(route: RouteMatcher, setup: Setup): void {
  let cleanup: Cleanup | void
  document.addEventListener("astro:page-load", () => {
    if (matches(route, window.location.pathname)) cleanup = setup()
  })
  document.addEventListener("astro:before-swap", () => {
    cleanup?.()
    cleanup = undefined
  })
}

// Run `setup` on every page (initial load + each navigation), tearing down the
// previous page's instance first. For genuinely global per-page work.
export function onEveryPage(setup: Setup): void {
  let cleanup: Cleanup | void
  document.addEventListener("astro:page-load", () => {
    cleanup = setup()
  })
  document.addEventListener("astro:before-swap", () => {
    cleanup?.()
    cleanup = undefined
  })
}
