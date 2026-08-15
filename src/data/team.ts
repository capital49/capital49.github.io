// Content sourced from capital49.com/team.
export interface TeamMember {
  name: string
  role: string
  bio: string
  img: string
}

export const TEAM_TAGLINE = "Conviction-led. Partnership-driven."
export const TEAM_INTRO =
  "We form views early, move with confidence, and stay close to the founders who trust us with their hardest chapters."

export const TEAM: TeamMember[] = [
  {
    name: "Jack Zhang",
    role: "Founder",
    bio: "Jack is the co-founder and CEO of Airwallex. He established the company to build the economic infrastructure that enables modern businesses to grow globally — Airwallex now operates across 100+ countries and processes over US$100 billion in annual payment volume.",
    img: "/team/jack.avif",
  },
  {
    name: "Christopher Cheng",
    role: "Partner",
    bio: "Chris leads Capital 49's investment strategy. He began his career in investment banking before moving through private equity and operating roles, then joined SoftBank's Vision Fund. Most recently he led fintech and SaaS investments at Obvious Ventures, backing companies including Medable, Synop and Brightside.",
    img: "/team/chris.avif",
  },
  {
    name: "Philipp Seifert",
    role: "Partner",
    bio: "Philipp co-leads Capital 49's investment strategy with a focus on AI infrastructure and applications. Previously a Partner at 468 Capital, he invested in Poetiq AI, Entangl, Sygaldry and Brev (acquired by NVIDIA); at Sapphire Ventures his investments included Braze (IPO), Segment (acquired by Twilio) and DataRobot. He began his career at Goldman Sachs and is a Kauffman Fellows Class 28 member.",
    img: "/team/philipp.png",
  },
  {
    name: "Kai Wu",
    role: "Partner",
    bio: "Kai is the Global Chief Revenue Officer of Airwallex. He previously advised on fintech investment across China at Boston Consulting Group, and invested in the TMT and fintech sectors at Bertelsmann Asia Investments.",
    img: "/team/kai.avif",
  },
]
