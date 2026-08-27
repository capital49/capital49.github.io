import type { Config } from "@keystatic/core"
import { Keystatic } from "@keystatic/core/ui"
import config from "../../keystatic.config"

// Client-only. In cloud mode the admin talks to Keystatic Cloud directly, so
// there is no server route and the site stays static. The 404 page mounts this
// too, so deep links under /keystatic/ (including the OAuth callback) work on
// GitHub Pages.
export default function KeystaticAdmin({ notFound = false }: { notFound?: boolean }) {
  if (notFound && !window.location.pathname.startsWith("/keystatic")) {
    return <p style={{ padding: "2rem", fontFamily: "sans-serif" }}>Page not found.</p>
  }
  // The component takes the unparameterised Config; the typed one is not
  // assignable to it, so widen the same way Keystatic's own integration does.
  return <Keystatic config={config as unknown as Config} />
}
