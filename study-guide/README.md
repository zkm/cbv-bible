# Scripture Study Guide (Vue)

Vue 3 + Vite app for reading scripture and keeping verse-by-verse study notes.

## Features

- Book and chapter navigation
- Chapter-only search
- Global search across all books
- URL query-state sync for shareable views
- Per-verse notes persisted to localStorage

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

Deployment is configured from the repository root via `.github/workflows/deploy-pages.yml`.

The workflow copies `../books` into `public/books`, builds this app, and publishes to Pages on push to `main`.

## Data source

The app reads book data from `public/books`.
