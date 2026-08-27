import { createReader } from "@keystatic/core/reader"
import config from "../../keystatic.config"

// Build-time access to the YAML in content/. Pages call these in frontmatter.
export const reader = createReader(process.cwd(), config)

type Singletons = typeof reader.singletons

export async function singleton<K extends keyof Singletons>(key: K) {
  const value = await reader.singletons[key].read()
  if (!value) throw new Error(`Missing content/${key}.yaml`)
  return value as NonNullable<Awaited<ReturnType<Singletons[K]["read"]>>>
}

// "37.7916° N  122.3930° W", as shown in the header next to the map link.
export function formatCoordinates({ latitude, longitude }: { latitude: number; longitude: number }) {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? "S" : "N"}`
  const lng = `${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`
  return `${lat}\u00a0\u00a0${lng}`
}

export async function portfolio() {
  const entries = await reader.collections.portfolio.all()
  return entries.sort((a, b) => a.slug.localeCompare(b.slug)).map((e) => e.entry)
}

export async function team() {
  const entries = await reader.collections.team.all()
  return entries.map((e) => e.entry).sort((a, b) => a.order - b.order)
}
