# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This repo has two parts:
1. A CPDV (Catholic Public Domain Version) Bible text dataset, exported in multiple formats.
2. `study-guide/`, a Vue 3 + Vite SPA that reads that dataset for scripture reading and verse-by-verse study notes.

The dataset is generated: `bible.txt` is the single source of truth, and `bible.json`, `bible.xml`, `books/`, and `study-guide/public/books/` are all derived from it by `scripts/rebuild_dataset.py`. Never hand-edit the generated JSON/XML files or `books/**` — edit `bible.txt` and rerun the rebuild script.

`study-guide/public/books/` is gitignored (it's just a mirror of `books/`), so run `python scripts/rebuild_dataset.py` once after cloning — and again whenever `bible.txt` changes — before `yarn dev` will have data to serve. CI syncs it automatically before testing/building; local dev does not.

## Commands

### Study guide app (run from `study-guide/`)

```bash
yarn install
yarn dev            # dev server
yarn test           # vitest single run (used in CI)
yarn test:watch     # vitest watch mode
yarn build           # production build (outputs to dist/)
yarn preview
```

To run a single test file: `yarn vitest run src/__tests__/utils.test.js`. There is currently only one test file (`utils.test.js`), which covers `src/utils.js`.

### Dataset rebuild (run from repo root, requires Python 3)

```bash
python scripts/rebuild_dataset.py                     # regenerate bible.json/xml, books/, study-guide/public/books from bible.txt
python scripts/rebuild_dataset.py --import-deuterocanon  # also re-fetch/re-merge deuterocanonical books from Gutenberg DRB into bible.txt first
```

`--import-deuterocanon` downloads from Project Gutenberg (network access required the first time) and caches to `.tmp/drb-8300.txt`; later runs reuse the cache unless `--refresh-source` is passed.

## Architecture

### Dataset pipeline (`scripts/rebuild_dataset.py`)

- Parses `bible.txt` (header: abbreviation + translation name, then tab-separated `Book Chapter:Verse\tText` lines) into a flat list of verse dicts.
- `--import-deuterocanon` mode: fetches the public-domain Douay-Rheims text from Gutenberg, extracts deuterocanonical books/additions via regex against chapter headers (`SOURCE_BOOK_MAP`, `REQUIRED_CATHOLIC_ENTRIES`), maps Esther ch.11-16 → "Additions to Esther" and Daniel ch.13-14 → "Additions to Daniel", merges them into the verse list (replacing any prior entries for those books), and rewrites `bible.txt`.
- Always writes: `bible.json`/`bible.xml` (flat exports) and `books/<slug>/book.json`+`book.xml` (per-book, grouped into chapters) plus `books/index.json` (book directory with slugs/counts). Finally syncs `books/` → `study-guide/public/books/` (mirrors, does not merge).
- Current canon coverage: 75 books/entries — 66 standard + 7 deuterocanonical books + 2 "Additions to" entries (Esther, Daniel).

### Study guide app (`study-guide/src/`)

Single-component SPA (`App.vue`) backed by pure functions in `utils.js`; there is no router, store, or component tree beyond the one file.

- **Data loading**: fetches `${BASE_URL}books/index.json` for the book list, then lazily fetches each `books/<slug>/book.json` on selection, caching results in an in-memory `Map` (`bookCache`). Global search additionally builds a flattened in-memory corpus of every verse across every book (`ensureGlobalCorpus`), fetched once and cached.
- **Canonical ordering**: `App.vue` hardcodes `CATHOLIC_CANON_ORDER` (book display order) and `BOOK_GROUPS` (Pentateuch/Historical/Wisdom/Prophets/Gospels & Acts/Pauline/Catholic letters/Revelation), independent of the dataset's own ordering. Adding/renaming a book in the dataset requires updating both arrays here to keep it visible in the group filter and sorted correctly.
- **URL state sync**: two-way sync between reactive state (`selectedSlug`, `selectedChapterNumber`, `activeReference`, `searchTerm`, `searchScope`) and query params (`book`, `chapter`, `verse`, `q`, `scope`) via `parseUrlParams`/`buildUrlParams` in `utils.js`, using `history.replaceState` (no hard navigation). On load, `initialRouteState` holds the parsed target until the matching book/chapter/verse is confirmed present, then is cleared.
- **Notes**: per-verse notes (`observation`/`interpretation`/`application`/`prayer`) keyed by verse `reference`, stored in `notesByReference`, persisted to `localStorage` under `STORAGE_KEY` on every deep change via a `watch`.
- **Search has two independent modes** controlled by `searchScope`: chapter-scope filters the currently loaded chapter's verses client-side (`filterVersesByQuery`); global-scope searches the full in-memory corpus and caps results at `MAX_GLOBAL_RESULTS` (200). Clicking a global result (`jumpToVerse`) switches scope back to chapter and loads that verse's book/chapter.
- `utils.js` is kept dependency-free and pure specifically so it's unit-testable in isolation from Vue — new logic that doesn't need reactivity should go there, not in `App.vue`.

### CI/CD (`.github/workflows/`)

- `ci.yml`: runs on PRs and non-main pushes — runs `yarn test`, then a separate build-check job that copies `books/` into `study-guide/public/books` and runs `yarn build`.
- `deploy-pages.yml`: runs on push to `main` — tests, copies `books/` into `study-guide/public/books`, builds, and deploys `study-guide/dist` to GitHub Pages.
- Both workflows manually sync `books/` → `study-guide/public/books` before building, since that directory is gitignored (not committed) — this mirrors what `rebuild_dataset.py`'s `sync_books_to_app` does locally.
