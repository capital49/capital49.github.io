import { collection, config, fields, singleton } from "@keystatic/core"

// Content the client edits at /keystatic. Copy lives in content/*.yaml, one
// file per portfolio company and team member, and images land in public/.

const section = (label: string) =>
  fields.object(
    {
      label: fields.text({ label: "Rail label", description: "Short name shown in the side rail" }),
      headline: fields.text({ label: "Headline" }),
      body: fields.text({ label: "Body", multiline: true }),
    },
    { label },
  )

const pageHeader = (label: string) =>
  fields.object(
    {
      description: fields.text({ label: "Meta description", multiline: true }),
      heading: fields.text({ label: "Heading" }),
      lede: fields.text({ label: "Lede", multiline: true }),
    },
    { label },
  )

export default config({
  storage: { kind: "cloud" },
  cloud: { project: "capital-49/capital49-landing" },
  ui: { brand: { name: "Capital 49" } },

  singletons: {
    site: singleton({
      label: "Site settings",
      path: "content/site",
      schema: {
        contactEmail: fields.text({ label: "Contact email" }),
        linkedin: fields.url({ label: "LinkedIn URL", validation: { isRequired: true } }),
        mapUrl: fields.url({ label: "Map link", validation: { isRequired: true } }),
        latitude: fields.number({
          label: "Latitude",
          description: "Decimal degrees; negative for south",
          validation: { isRequired: true },
        }),
        longitude: fields.number({
          label: "Longitude",
          description: "Decimal degrees; negative for west",
          validation: { isRequired: true },
        }),
        footerNote: fields.text({ label: "Footer note" }),
      },
    }),

    home: singleton({
      label: "Home page",
      path: "content/home",
      schema: {
        description: fields.text({ label: "Meta description", multiline: true }),
        hero: fields.object(
          {
            label: fields.text({ label: "Rail label" }),
            title: fields.text({ label: "Title" }),
          },
          { label: "01 — Hero" },
        ),
        deviation: section("02 — Deviation"),
        dawn: fields.object(
          {
            label: fields.text({ label: "Rail label" }),
            headline: fields.text({ label: "Headline" }),
            focus: fields.array(fields.text({ label: "Focus area" }), {
              label: "Focus areas",
              itemLabel: (props) => props.value,
            }),
          },
          { label: "03 — Dawn" },
        ),
        lineage: fields.object(
          {
            label: fields.text({ label: "Rail label" }),
            headline: fields.text({ label: "Headline" }),
            body: fields.text({ label: "Body", multiline: true }),
            stats: fields.array(
              fields.object({
                value: fields.text({ label: "Value" }),
                label: fields.text({ label: "Label" }),
              }),
              { label: "Stats", itemLabel: (props) => props.fields.value.value },
            ),
          },
          { label: "04 — Lineage" },
        ),
        network: section("05 — Network"),
        contact: fields.object(
          {
            label: fields.text({ label: "Rail label" }),
            headline: fields.text({ label: "Headline" }),
          },
          { label: "06 — Contact" },
        ),
      },
    }),

    pages: singleton({
      label: "Portfolio & team pages",
      path: "content/pages",
      schema: {
        portfolio: pageHeader("Portfolio page"),
        team: pageHeader("Team page"),
      },
    }),
  },

  collections: {
    portfolio: collection({
      label: "Portfolio companies",
      path: "content/portfolio/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Name" } }),
        url: fields.url({ label: "Website", validation: { isRequired: true } }),
        logo: fields.image({
          label: "Logo",
          description: "SVG or PNG on a transparent background; it is rendered in white",
          directory: "public/logos/portfolio",
          publicPath: "/logos/portfolio/",
          validation: { isRequired: true },
        }),
      },
    }),

    team: collection({
      label: "Team members",
      path: "content/team/*",
      slugField: "name",
      schema: {
        name: fields.slug({ name: { label: "Name" } }),
        role: fields.text({ label: "Role" }),
        bio: fields.text({ label: "Bio", multiline: true }),
        photo: fields.image({
          label: "Photo",
          description: "Portrait, 3:4; shown in greyscale",
          directory: "public/team",
          publicPath: "/team/",
          validation: { isRequired: true },
        }),
        order: fields.integer({
          label: "Order",
          description: "Lower numbers appear first",
          validation: { isRequired: true },
        }),
      },
    }),
  },
})
