import { useEffect, useState } from "react"
import { normalizePath } from "@/lib/page-lifecycle"

// The current route, as React state.
//
// The canvas mounts once under `transition:persist`, so React never re-renders on
// navigation — Astro swaps the DOM around it and the island's props never change.
// Mirror `window.location.pathname` into state on `astro:page-load` instead, which
// is the one signal that does fire on every navigation (and on initial load).
//
// Paths go through `normalizePath` so route comparisons here agree with `onPage`
// in page-lifecycle on trailing slashes.
export function useAstroRoute(): string {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window === "undefined" ? "/" : normalizePath(window.location.pathname)
  )

  useEffect(() => {
    const sync = () => setPathname(normalizePath(window.location.pathname))
    document.addEventListener("astro:page-load", sync)
    return () => document.removeEventListener("astro:page-load", sync)
  }, [])

  return pathname
}
