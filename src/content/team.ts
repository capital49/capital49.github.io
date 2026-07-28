// Team page copy. Placeholder text — replace with final copy.

export type TeamMember = {
  name: string
  role: string
  bio: string
}

export const TEAM_HERO = {
  title: "Team",
  subtitle:
    "Operators and founders backing the next generation of technology companies.",
} as const

export const TEAM: readonly TeamMember[] = [
  {
    name: "Partner name",
    role: "Partner",
    bio: "Short description goes here.",
  },
  {
    name: "Partner name",
    role: "Partner",
    bio: "Short description goes here.",
  },
  {
    name: "Partner name",
    role: "Principal",
    bio: "Short description goes here.",
  },
  {
    name: "Partner name",
    role: "Operations",
    bio: "Short description goes here.",
  },
] as const
