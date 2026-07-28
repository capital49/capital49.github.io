// Portfolio page copy. Placeholder text — replace with final copy.

export type PortfolioCompany = {
  name: string
  sector: string
  blurb: string
}

export const PORTFOLIO_HERO = {
  title: "Portfolio",
  subtitle:
    "Companies across fintech, e-commerce, AI, and B2B software.",
} as const

export const PORTFOLIO: readonly PortfolioCompany[] = [
  { name: "Company name", sector: "Fintech", blurb: "Short description goes here." },
  { name: "Company name", sector: "E-commerce", blurb: "Short description goes here." },
  { name: "Company name", sector: "AI", blurb: "Short description goes here." },
  { name: "Company name", sector: "B2B Software", blurb: "Short description goes here." },
  { name: "Company name", sector: "Fintech", blurb: "Short description goes here." },
  { name: "Company name", sector: "E-commerce", blurb: "Short description goes here." },
  { name: "Company name", sector: "AI", blurb: "Short description goes here." },
  { name: "Company name", sector: "B2B Software", blurb: "Short description goes here." },
] as const
