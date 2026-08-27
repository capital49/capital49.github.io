# Capital 49

Source for [capital49.com](https://capital49.com), the website of Capital 49, a venture fund backed by the founders of Airwallex.

Built with [Astro](https://astro.build), React, Tailwind and Three.js. The site is fully static.

## Development

```sh
pnpm install
pnpm dev        # local server at localhost:4321
pnpm build      # static output in dist/
pnpm typecheck  # astro check
```

## Content

Copy, portfolio companies and team members live in `content/` as YAML and are edited at `/keystatic`, which signs in through Keystatic Cloud and commits to this repo. Images uploaded there are written to `public/`.
