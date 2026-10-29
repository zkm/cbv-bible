# Bible Data + Vue Study Guide

[![Deploy](https://github.com/zkm/cbv-bible/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/zkm/cbv-bible/actions/workflows/deploy-pages.yml)
[![study guide](https://img.shields.io/website?url=https%3A%2F%2Fzkm.github.io%2Fcbv-bible%2F&label=study%20guide)](https://zkm.github.io/cbv-bible/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

![Data: TXT, JSON, XML](https://img.shields.io/badge/data-TXT%20%C2%B7%20JSON%20%C2%B7%20XML-6E6E6E)
![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![Yarn 4](https://img.shields.io/badge/Yarn-4-2C8EBB?logo=yarn&logoColor=white)
![Node.js 22](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![Python data scripts](https://img.shields.io/badge/Python-data%20scripts-3776AB?logo=python&logoColor=white)

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

## App source layout

```
study-guide/src/
  App.vue          # main SPA component
  utils.js         # pure utility functions (sorting, filtering, URL, notes)
  style.css        # design system / global CSS
  main.js          # Vue entry point
  __tests__/
    utils.test.js  # Vitest unit tests for utils.js
```

## Run the app

`study-guide/public/books` is generated and not committed to git, so sync it once before your first `yarn dev` (and again whenever `bible.txt` changes):

```bash
python scripts/rebuild_dataset.py
cd study-guide
yarn install
yarn dev
```

## Run the tests

```bash
cd study-guide
yarn test          # single run
yarn test:watch    # watch mode
```

## Rebuild the dataset

Use the reproducible rebuild script:

```bash
python scripts/rebuild_dataset.py
```

To re-import deuterocanonical entries from public-domain Gutenberg DRB and then rebuild everything:

```bash
python scripts/rebuild_dataset.py --import-deuterocanon
```

This script updates:

- `bible.txt`
- `bible.json`
- `bible.xml`
- `books/`
- `study-guide/public/books/`

Build for production:

```bash
cd study-guide
yarn build
```

## Publish on GitHub Pages

This repo includes an automated Pages workflow at `.github/workflows/deploy-pages.yml`.

What it does on each push to `main`:

- Runs the unit test suite (fails fast on any error)
- Copies `books/` into `study-guide/public/books`
- Builds the Vue app
- Deploys `study-guide/dist` to GitHub Pages

Pull requests and topic branches are covered by `.github/workflows/ci.yml`, which runs the tests without deploying.

One-time GitHub setup:

1. Push this repository to GitHub.
2. In repository settings, open Pages.
3. Under Build and deployment, choose Source: GitHub Actions.
4. Push to `main` (or run the workflow manually from the Actions tab).

## Notes about canon coverage

Current dataset contains 75 entries:

- 66 standard books from the original source text
- 7 deuterocanonical stand-alone books
- 2 additions entries (Esther and Daniel)

The deuterocanonical content in this repository was imported from the
public-domain Douay-Rheims Gutenberg text to satisfy Catholic canon coverage.

The study guide book selector uses Catholic canonical ordering.

## License

This repository is licensed under the MIT License. See `LICENSE`.
