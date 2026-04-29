# Bible Data + Vue Study Guide

This repository contains CPDV Bible text data in multiple formats plus a Vue app for scripture study.

## Repository contents

- `bible.txt`: source text (CPDV header + verse lines)
- `bible.json`: flat JSON export of all verses
- `bible.xml`: flat XML export of all verses
- `books/`: per-book exports
	- `books/index.json`
	- `books/<book-slug>/book.json`
	- `books/<book-slug>/book.xml`
- `study-guide/`: Vue 3 + Vite app that renders the data as a study tool

## Study guide features

- Book/chapter navigation
- Chapter search
- Global search across all books
- URL state sync for sharing links
	- query params: `book`, `chapter`, `verse`, `q`, `scope`
- Verse-focused study notes:
	- Observation
	- Interpretation
	- Application
	- Prayer
- Notes auto-saved in browser localStorage

## Run the app

```bash
cd study-guide
npm install
npm run dev
```

Build for production:

```bash
cd study-guide
npm run build
```

## Publish on GitHub Pages

This repo includes an automated Pages workflow at `.github/workflows/deploy-pages.yml`.

What it does on each push to `main`:

- Copies `books/` into `study-guide/public/books`
- Builds the Vue app
- Deploys `study-guide/dist` to GitHub Pages

One-time GitHub setup:

1. Push this repository to GitHub.
2. In repository settings, open Pages.
3. Under Build and deployment, choose Source: GitHub Actions.
4. Push to `main` (or run the workflow manually from the Actions tab).

## Notes about canon coverage

Current dataset contains 66 books based on available source text in `bible.txt`.

## License

This repository is licensed under the MIT License. See `LICENSE`.
