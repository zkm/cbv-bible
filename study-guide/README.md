# Scripture Study Guide (Vue)

Vue 3 + Vite app for reading scripture and keeping verse-by-verse study notes.

## Features

- Book and chapter navigation
- Chapter-only search
- Global search across all books
- URL query-state sync for shareable views
- Per-verse notes persisted to localStorage
- Book selector ordered by Catholic canon

## Source layout

```
src/
  App.vue          # main SPA component
  utils.js         # pure utility functions (sorting, filtering, URL, notes)
  style.css        # design system / global CSS
  main.js          # Vue entry point
  __tests__/
    utils.test.js  # Vitest unit tests for utils.js
```

## Development

```bash
yarn install
yarn dev
```

## Tests

```bash
yarn test          # single run (used in CI)
yarn test:watch    # interactive watch mode
```

## Build

```bash
yarn build
yarn preview
```

## GitHub Pages

Deployment is configured from the repository root via `.github/workflows/deploy-pages.yml`.

The workflow runs tests, copies `../books` into `public/books`, builds this app, and publishes to Pages on push to `main`. Pull requests are validated by `.github/workflows/ci.yml`.

## Data source

The app reads book data from `public/books`.
