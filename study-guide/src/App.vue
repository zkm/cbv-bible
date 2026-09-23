<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  EMPTY_NOTE,
  MAX_GLOBAL_RESULTS,
  SEARCH_SCOPE_CHAPTER,
  SEARCH_SCOPE_GLOBAL,
  STORAGE_KEY,
  buildGroupOptions,
  buildUrlParams,
  ensureNote as ensureNoteUtil,
  filterBooksByGroup,
  filterVersesByQuery,
  parseUrlParams,
  sortBooksByCanon,
  verseMatchesQuery,
} from './utils.js'

const DATA_BASE_URL = `${import.meta.env.BASE_URL}books`
const CATHOLIC_CANON_ORDER = [
  'Genesis',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Kings',
  '2 Kings',
  '1 Chronicles',
  '2 Chronicles',
  'Ezra',
  'Nehemiah',
  'Tobit',
  'Judith',
  'Esther',
  'Additions to Esther',
  '1 Maccabees',
  '2 Maccabees',
  'Job',
  'Psalm',
  'Proverbs',
  'Ecclesiastes',
  'Song of Solomon',
  'Wisdom of Solomon',
  'Sirach',
  'Isaiah',
  'Jeremiah',
  'Lamentations',
  'Baruch',
  'Ezekiel',
  'Daniel',
  'Additions to Daniel',
  'Hosea',
  'Joel',
  'Amos',
  'Obadiah',
  'Jonah',
  'Micah',
  'Nahum',
  'Habakkuk',
  'Zephaniah',
  'Haggai',
  'Zechariah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  '2 Corinthians',
  'Galatians',
  'Ephesians',
  'Philippians',
  'Colossians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Timothy',
  '2 Timothy',
  'Titus',
  'Philemon',
  'Hebrews',
  'James',
  '1 Peter',
  '2 Peter',
  '1 John',
  '2 John',
  '3 John',
  'Jude',
  'Revelation',
]
const BOOK_GROUPS = [
  {
    id: 'all',
    label: 'All books',
    books: null,
  },
  {
    id: 'pentateuch',
    label: 'Pentateuch',
    books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  },
  {
    id: 'historical',
    label: 'Historical books',
    books: [
      'Joshua',
      'Judges',
      'Ruth',
      '1 Samuel',
      '2 Samuel',
      '1 Kings',
      '2 Kings',
      '1 Chronicles',
      '2 Chronicles',
      'Ezra',
      'Nehemiah',
      'Tobit',
      'Judith',
      'Esther',
      'Additions to Esther',
      '1 Maccabees',
      '2 Maccabees',
    ],
  },
  {
    id: 'wisdom',
    label: 'Wisdom books',
    books: [
      'Job',
      'Psalm',
      'Proverbs',
      'Ecclesiastes',
      'Song of Solomon',
      'Wisdom of Solomon',
      'Sirach',
    ],
  },
  {
    id: 'prophets',
    label: 'Prophets',
    books: [
      'Isaiah',
      'Jeremiah',
      'Lamentations',
      'Baruch',
      'Ezekiel',
      'Daniel',
      'Additions to Daniel',
      'Hosea',
      'Joel',
      'Amos',
      'Obadiah',
      'Jonah',
      'Micah',
      'Nahum',
      'Habakkuk',
      'Zephaniah',
      'Haggai',
      'Zechariah',
      'Malachi',
    ],
  },
  {
    id: 'gospels-acts',
    label: 'Gospels & Acts',
    books: ['Matthew', 'Mark', 'Luke', 'John', 'Acts'],
  },
  {
    id: 'pauline',
    label: 'Pauline letters',
    books: [
      'Romans',
      '1 Corinthians',
      '2 Corinthians',
      'Galatians',
      'Ephesians',
      'Philippians',
      'Colossians',
      '1 Thessalonians',
      '2 Thessalonians',
      '1 Timothy',
      '2 Timothy',
      'Titus',
      'Philemon',
      'Hebrews',
    ],
  },
  {
    id: 'catholic-letters',
    label: 'Catholic letters',
    books: ['James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude'],
  },
  {
    id: 'revelation',
    label: 'Revelation',
    books: ['Revelation'],
  },
]

const indexData = ref(null)
const books = ref([])
const selectedSlug = ref('')
const selectedBook = ref(null)
const selectedGroup = ref('all')
const selectedChapterNumber = ref(1)
const searchTerm = ref('')
const searchScope = ref(SEARCH_SCOPE_CHAPTER)
const activeReference = ref('')
const isLoading = ref(true)
const isBookLoading = ref(false)
const isGlobalSearching = ref(false)
const errorMessage = ref('')

const notesByReference = ref({})
const globalResults = ref([])
const globalMatchCount = ref(0)
const globalSearchError = ref('')

const bookCache = new Map()
const globalCorpus = ref([])
const initialRouteState = ref(null)

let bookLoadToken = 0
let globalSearchToken = 0
let corpusPromise = null

function loadNotesFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      notesByReference.value = parsed
    }
  } catch {
    notesByReference.value = {}
  }
}

function saveNotesToStorage() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notesByReference.value))
  } catch {
    // Storage can be blocked or full; notes stay in memory for this session.
  }
}

watch(
  notesByReference,
  () => {
    saveNotesToStorage()
  },
  { deep: true }
)

const chapterOptions = computed(() => {
  return selectedBook.value?.chapters ?? []
})

const orderedBooks = computed(() => sortBooksByCanon(books.value, CATHOLIC_CANON_ORDER))

const filteredBooks = computed(() =>
  filterBooksByGroup(orderedBooks.value, selectedGroup.value, BOOK_GROUPS)
)

const groupOptions = computed(() => buildGroupOptions(orderedBooks.value, BOOK_GROUPS))

const selectedGroupMeta = computed(() => {
  return groupOptions.value.find((group) => group.id === selectedGroup.value) ?? groupOptions.value[0]
})

const currentChapter = computed(() => {
  return (
    chapterOptions.value.find(
      (chapter) => chapter.chapter === selectedChapterNumber.value
    ) ?? null
  )
})

const chapterVerses = computed(() => {
  const verses = currentChapter.value?.verses ?? []
  if (searchScope.value !== SEARCH_SCOPE_CHAPTER) return verses
  return filterVersesByQuery(verses, searchTerm.value)
})

const visibleVerses = computed(() => {
  if (searchScope.value === SEARCH_SCOPE_GLOBAL) return globalResults.value
  return chapterVerses.value
})

const activeVerse = computed(() => {
  if (!activeReference.value) return visibleVerses.value[0] ?? null
  return (
    visibleVerses.value.find((verse) => verse.reference === activeReference.value) ??
    visibleVerses.value[0] ??
    null
  )
})

function ensureNote(reference) {
  return ensureNoteUtil(notesByReference.value, reference)
}

const activeNote = computed(() => {
  const reference = activeVerse.value?.reference
  if (!reference) return EMPTY_NOTE
  return notesByReference.value[reference] ?? EMPTY_NOTE
})

function updateNote(field, value) {
  const reference = activeVerse.value?.reference
  if (!reference) return
  const note = ensureNote(reference)
  note[field] = value
}

async function fetchBook(slug) {
  let book = bookCache.get(slug)
  if (book) return book

  const response = await fetch(`${DATA_BASE_URL}/${slug}/book.json`)
  if (!response.ok) {
    throw new Error(`Unable to load book: ${response.status}`)
  }

  book = await response.json()
  bookCache.set(slug, book)
  return book
}

async function loadBook(slug) {
  if (!slug) return

  const token = ++bookLoadToken

  try {
    isBookLoading.value = true
    errorMessage.value = ''

    const book = await fetchBook(slug)
    if (token !== bookLoadToken) return

    selectedBook.value = book

    const availableChapters = new Set((book.chapters ?? []).map((c) => c.chapter))
    const routeState =
      initialRouteState.value?.slug === slug ? initialRouteState.value : null

    if (routeState && availableChapters.has(routeState.chapter)) {
      selectedChapterNumber.value = routeState.chapter
    } else {
      selectedChapterNumber.value = book.chapters?.[0]?.chapter ?? 1
    }

    const chapterVersesInBook =
      (book.chapters ?? []).find((c) => c.chapter === selectedChapterNumber.value)
        ?.verses ?? []

    const routeRef = routeState?.reference ?? ''

    if (routeRef && chapterVersesInBook.some((v) => v.reference === routeRef)) {
      activeReference.value = routeRef
    } else {
      activeReference.value = ''
    }

    if (routeState) {
      initialRouteState.value = null
    }
  } catch (error) {
    if (token !== bookLoadToken) return
    selectedBook.value = null
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load selected book.'
  } finally {
    if (token === bookLoadToken) {
      isBookLoading.value = false
    }
  }
}

function parseUrlState() {
  const { slug, chapter, reference, query, scope } = parseUrlParams(window.location.search)

  if (query) searchTerm.value = query
  if (scope === SEARCH_SCOPE_GLOBAL || scope === SEARCH_SCOPE_CHAPTER) {
    searchScope.value = scope
  }

  if (slug) {
    initialRouteState.value = { slug, chapter, reference }
  }
}

function syncUrlState() {
  const query = buildUrlParams({
    slug: selectedSlug.value,
    chapter: selectedChapterNumber.value,
    reference: activeReference.value,
    searchTerm: searchTerm.value,
    searchScope: searchScope.value,
  })

  const next = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname
  window.history.replaceState({}, '', next)
}

function ensureGlobalCorpus() {
  if (globalCorpus.value.length > 0) return Promise.resolve()
  if (corpusPromise) return corpusPromise

  corpusPromise = (async () => {
    // Load every book, then flatten in canon order so results are stable
    // regardless of which fetch finishes first.
    const loadedBooks = await Promise.all(
      orderedBooks.value.map((bookMeta) => fetchBook(bookMeta.slug))
    )

    const corpus = []
    orderedBooks.value.forEach((bookMeta, index) => {
      const loaded = loadedBooks[index]
      for (const chapter of loaded.chapters ?? []) {
        for (const verse of chapter.verses ?? []) {
          corpus.push({
            slug: bookMeta.slug,
            book: loaded.book,
            chapter: chapter.chapter,
            verse: verse.verse,
            reference: verse.reference,
            text: verse.text,
          })
        }
      }
    })

    globalCorpus.value = corpus
  })().finally(() => {
    corpusPromise = null
  })

  return corpusPromise
}

async function runGlobalSearch() {
  const token = ++globalSearchToken
  globalSearchError.value = ''

  const query = searchTerm.value.trim().toLowerCase()
  if (searchScope.value !== SEARCH_SCOPE_GLOBAL || !query) {
    globalResults.value = []
    globalMatchCount.value = 0
    isGlobalSearching.value = false
    return
  }

  isGlobalSearching.value = true

  try {
    await ensureGlobalCorpus()
    if (token !== globalSearchToken) return

    const matches = globalCorpus.value.filter((entry) => verseMatchesQuery(entry, query))
    globalMatchCount.value = matches.length
    globalResults.value = matches.slice(0, MAX_GLOBAL_RESULTS)
  } catch (error) {
    if (token !== globalSearchToken) return
    globalResults.value = []
    globalMatchCount.value = 0
    globalSearchError.value =
      error instanceof Error ? error.message : 'Unable to search all books.'
  } finally {
    if (token === globalSearchToken) {
      isGlobalSearching.value = false
    }
  }
}

function jumpToVerse(verse) {
  searchScope.value = SEARCH_SCOPE_CHAPTER

  // The book select only lists books in the active group; widen it if needed.
  if (!filteredBooks.value.some((book) => book.slug === verse.slug)) {
    selectedGroup.value = 'all'
  }

  if (selectedSlug.value === verse.slug) {
    selectedChapterNumber.value = verse.chapter
    activeReference.value = verse.reference
    return
  }

  initialRouteState.value = {
    slug: verse.slug,
    chapter: verse.chapter,
    reference: verse.reference,
  }
  selectedSlug.value = verse.slug
}

async function loadIndex() {
  isLoading.value = true

  try {
    const response = await fetch(`${DATA_BASE_URL}/index.json`)
    if (!response.ok) {
      throw new Error(`Unable to load index: ${response.status}`)
    }

    const index = await response.json()
    indexData.value = index
    books.value = index.books ?? []

    if (books.value.length > 0) {
      const preferredSlug = initialRouteState.value?.slug
      const hasPreferred = books.value.some((b) => b.slug === preferredSlug)
      selectedSlug.value = hasPreferred
        ? preferredSlug
        : orderedBooks.value[0]?.slug || books.value[0].slug
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load book index.'
  } finally {
    isLoading.value = false
  }
}

watch(selectedSlug, async (slug) => {
  await loadBook(slug)
})

watch(filteredBooks, (bookList) => {
  if (bookList.length === 0) return
  const stillAvailable = bookList.some((book) => book.slug === selectedSlug.value)
  if (!stillAvailable) {
    selectedSlug.value = bookList[0].slug
  }
})

watch(selectedChapterNumber, () => {
  // Keep a selection that was set together with the chapter (deep links,
  // search jumps); clear one left over from a different chapter.
  const verses = currentChapter.value?.verses ?? []
  if (!verses.some((verse) => verse.reference === activeReference.value)) {
    activeReference.value = ''
  }
})

watch(searchScope, async () => {
  await runGlobalSearch()
})

watch(searchTerm, async () => {
  if (searchScope.value === SEARCH_SCOPE_GLOBAL) {
    await runGlobalSearch()
  }
})

watch(
  [selectedSlug, selectedChapterNumber, activeReference, searchTerm, searchScope],
  () => {
    syncUrlState()
  }
)

onMounted(async () => {
  parseUrlState()
  loadNotesFromStorage()
  await loadIndex()
  if (searchScope.value === SEARCH_SCOPE_GLOBAL && searchTerm.value.trim()) {
    await runGlobalSearch()
  }
})
</script>

<template>
  <div class="page-shell">
    <a class="skip-link" href="#study-main">Skip to reading and notes</a>

    <header class="hero">
      <p class="eyebrow">Scripture Study Guide</p>
      <h1>Read, reflect, and keep notes verse-by-verse</h1>
      <p class="subtitle">
        Built on the {{ indexData?.translation || 'Bible text data' }} with a
        focused workflow for observation, interpretation, and application.
      </p>
    </header>

    <section class="control-panel" v-if="!isLoading" aria-label="Study controls">
      <label>
        Book
        <select
          v-model="selectedSlug"
          :disabled="isBookLoading"
          aria-label="Book selector"
        >
          <option v-for="book in filteredBooks" :key="book.slug" :value="book.slug">
            {{ book.name }}
          </option>
        </select>
      </label>

      <label>
        Data tools
        <select
          v-model="selectedGroup"
          :disabled="isBookLoading"
          aria-label="Canonical group filter"
        >
          <option v-for="group in groupOptions" :key="group.id" :value="group.id">
            {{ group.displayLabel }}
          </option>
        </select>
      </label>

      <label>
        Chapter
        <select
          v-model.number="selectedChapterNumber"
          :disabled="isBookLoading"
          aria-label="Chapter selector"
        >
          <option
            v-for="chapter in chapterOptions"
            :key="chapter.chapter"
            :value="chapter.chapter"
          >
            {{ chapter.chapter }}
          </option>
        </select>
      </label>

      <label>
        Search scope
        <select
          v-model="searchScope"
          :disabled="isBookLoading"
          aria-label="Search scope"
        >
          <option :value="SEARCH_SCOPE_CHAPTER">Current chapter</option>
          <option :value="SEARCH_SCOPE_GLOBAL">All books</option>
        </select>
      </label>

      <label class="search-label">
        Search text
        <input
          v-model="searchTerm"
          type="search"
          :disabled="isBookLoading"
          placeholder="Try: covenant, mercy, wisdom, Genesis 1:1"
          aria-label="Search verses"
        />
      </label>
    </section>

    <section class="context-strip" v-if="!isLoading && !errorMessage" aria-label="Current study context">
      <p>
        <span class="context-label">Group</span>
        <span class="context-value">{{ selectedGroupMeta?.label }}</span>
      </p>
      <p>
        <span class="context-label">Books in group</span>
        <span class="context-value">{{ selectedGroupMeta?.count }}</span>
      </p>
      <p>
        <span class="context-label">Scope</span>
        <span class="context-value">
          {{ searchScope === SEARCH_SCOPE_GLOBAL ? 'All books' : 'Current chapter' }}
        </span>
      </p>
      <p>
        <span class="context-label">Shown</span>
        <span class="context-value">{{ visibleVerses.length }} verses</span>
      </p>
    </section>

    <section class="status" v-if="isLoading" role="status" aria-live="polite">
      Loading Bible index...
    </section>
    <section class="status error" v-else-if="errorMessage" role="alert">
      {{ errorMessage }}
    </section>
    <section class="status" v-else-if="isBookLoading" role="status" aria-live="polite">
      Loading selected book...
    </section>

    <main id="study-main" class="study-layout" v-else>
      <article class="reading-pane">
        <div class="reading-header">
          <h2>
            {{
              searchScope === SEARCH_SCOPE_GLOBAL
                ? 'Global Search Results'
                : `${selectedBook?.book} ${selectedChapterNumber}`
            }}
          </h2>
          <p>
            {{ visibleVerses.length }} verses shown
            <span v-if="searchScope === SEARCH_SCOPE_GLOBAL && isGlobalSearching">
              (searching...)
            </span>
            <span
              v-else-if="
                searchScope === SEARCH_SCOPE_GLOBAL &&
                globalMatchCount > visibleVerses.length
              "
            >
              (first {{ visibleVerses.length }} of {{ globalMatchCount }} matches; refine your search)
            </span>
          </p>
        </div>

        <p
          v-if="searchScope === SEARCH_SCOPE_GLOBAL && globalSearchError"
          class="status error"
          role="alert"
        >
          {{ globalSearchError }}
        </p>

        <div class="verse-list" v-if="visibleVerses.length">
          <button
            v-for="verse in visibleVerses"
            :key="verse.reference"
            class="verse-item"
            :class="{ active: activeVerse?.reference === verse.reference }"
            :aria-label="`Select verse ${verse.reference}`"
            type="button"
            @click="
              searchScope === SEARCH_SCOPE_GLOBAL
                ? jumpToVerse(verse)
                : (activeReference = verse.reference)
            "
          >
            <span class="verse-number">{{ verse.verse }}</span>
            <span class="verse-text">
              <span
                v-if="searchScope === SEARCH_SCOPE_GLOBAL"
                class="verse-reference"
              >
                {{ verse.reference }}
              </span>
              {{ verse.text }}
            </span>
          </button>
        </div>

        <p v-else-if="!globalSearchError" class="empty-state">
          {{
            searchScope === SEARCH_SCOPE_GLOBAL
              ? 'No global matches found for this search.'
              : 'No verses match this chapter search.'
          }}
        </p>
      </article>

      <aside class="notes-pane">
        <h3>Study Notes</h3>
        <p class="reference-chip" v-if="activeVerse">
          {{ activeVerse.reference }}
        </p>

        <label>
          Observation
          <textarea
            :value="activeNote.observation"
            @input="updateNote('observation', $event.target.value)"
            placeholder="What do you notice in the text?"
          />
        </label>

        <label>
          Interpretation
          <textarea
            :value="activeNote.interpretation"
            @input="updateNote('interpretation', $event.target.value)"
            placeholder="What does this passage mean?"
          />
        </label>

        <label>
          Application
          <textarea
            :value="activeNote.application"
            @input="updateNote('application', $event.target.value)"
            placeholder="How will this shape your actions today?"
          />
        </label>

        <label>
          Prayer
          <textarea
            :value="activeNote.prayer"
            @input="updateNote('prayer', $event.target.value)"
            placeholder="Write a short prayer response."
          />
        </label>
      </aside>
    </main>
  </div>
</template>
