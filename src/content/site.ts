// Site-wide constants. All copy lives under src/content/ so the .astro files
// stay markup-only and text changes never require touching a template.

export const SITE = {
  name: "Capital49",
  url: "https://capital49.com",
  description:
    "Capital49 is a venture fund investing in fintech, e-commerce, AI, and B2B software.",
} as const

export const CONTACT_EMAIL = "info@capital49.com"

export type NavLink = { label: string; href: string }

export const NAV_LINKS: readonly NavLink[] = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "Team", href: "/team" },
  { label: "Contact", href: `mailto:${CONTACT_EMAIL}` },
] as const
