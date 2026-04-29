<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const STORAGE_KEY = 'bible-study-notes-v1'
const SEARCH_SCOPE_CHAPTER = 'chapter'
const SEARCH_SCOPE_GLOBAL = 'global'
const MAX_GLOBAL_RESULTS = 200
const DATA_BASE_URL = `${import.meta.env.BASE_URL}books`

const EMPTY_NOTE = Object.freeze({
  observation: '',
  interpretation: '',
  application: '',
  prayer: '',
})

const indexData = ref(null)
const books = ref([])
const selectedSlug = ref('')
const selectedBook = ref(null)
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

const bookCache = new Map()
const globalCorpus = ref([])
const initialRouteState = ref(null)
const skipNextChapterReset = ref(false)

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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notesByReference.value))
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

const currentChapter = computed(() => {
  return (
    chapterOptions.value.find(
      (chapter) => chapter.chapter === selectedChapterNumber.value
    ) ?? null
  )
})

const chapterVerses = computed(() => {
  const verses = currentChapter.value?.verses ?? []
  const query = searchTerm.value.trim().toLowerCase()

  if (searchScope.value !== SEARCH_SCOPE_CHAPTER || !query) return verses

  return verses.filter((verse) => {
    const text = String(verse.text || '').toLowerCase()
    const reference = String(verse.reference || '').toLowerCase()
    return text.includes(query) || reference.includes(query)
  })
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
  if (!notesByReference.value[reference]) {
    notesByReference.value[reference] = {
      observation: '',
      interpretation: '',
      application: '',
      prayer: '',
    }
  }
  return notesByReference.value[reference]
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

async function loadBook(slug) {
  if (!slug) return

  try {
    isBookLoading.value = true
    errorMessage.value = ''

    let book = bookCache.get(slug)
    if (!book) {
      const response = await fetch(`${DATA_BASE_URL}/${slug}/book.json`)

      if (!response.ok) {
        throw new Error(`Unable to load book: ${response.status}`)
      }

      book = await response.json()
      bookCache.set(slug, book)
    }

    selectedBook.value = book

    const availableChapters = new Set((book.chapters ?? []).map((c) => c.chapter))
    if (!availableChapters.has(selectedChapterNumber.value)) {
      selectedChapterNumber.value = book.chapters?.[0]?.chapter ?? 1
    }

    if (
      initialRouteState.value &&
      initialRouteState.value.slug === slug &&
      Number.isFinite(initialRouteState.value.chapter)
    ) {
      const routeChapter = initialRouteState.value.chapter
      if (availableChapters.has(routeChapter)) {
        selectedChapterNumber.value = routeChapter
      }
    }

    const chapterVersesInBook =
      (book.chapters ?? []).find((c) => c.chapter === selectedChapterNumber.value)
        ?.verses ?? []

    const routeRef =
      initialRouteState.value && initialRouteState.value.slug === slug
        ? initialRouteState.value.reference
        : ''

    if (routeRef && chapterVersesInBook.some((v) => v.reference === routeRef)) {
      activeReference.value = routeRef
    } else {
      activeReference.value = ''
    }

    if (initialRouteState.value?.slug === slug) {
      initialRouteState.value = null
    }
  } catch (error) {
    selectedBook.value = null
    errorMessage.value =
      error instanceof Error ? error.message : 'Unable to load selected book.'
  } finally {
    isBookLoading.value = false
  }
}

function parseUrlState() {
  const params = new URLSearchParams(window.location.search)

  const slug = params.get('book') || ''
  const chapter = Number.parseInt(params.get('chapter') || '', 10)
  const reference = params.get('verse') || ''
  const query = params.get('q') || ''
  const scope = params.get('scope')

  if (query) searchTerm.value = query
  if (scope === SEARCH_SCOPE_GLOBAL || scope === SEARCH_SCOPE_CHAPTER) {
    searchScope.value = scope
  }

  if (slug) {
    initialRouteState.value = {
      slug,
      chapter: Number.isFinite(chapter) ? chapter : null,
      reference,
    }
  }
}

function syncUrlState() {
  const params = new URLSearchParams()

  if (selectedSlug.value) params.set('book', selectedSlug.value)
  if (selectedChapterNumber.value) {
    params.set('chapter', String(selectedChapterNumber.value))
  }
  if (activeReference.value) params.set('verse', activeReference.value)
  if (searchTerm.value.trim()) params.set('q', searchTerm.value.trim())
  if (searchScope.value !== SEARCH_SCOPE_CHAPTER) {
    params.set('scope', searchScope.value)
  }

  const query = params.toString()
  const next = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname
  window.history.replaceState({}, '', next)
}

async function ensureGlobalCorpus() {
  if (globalCorpus.value.length > 0) return

  const corpus = []

  await Promise.all(
    books.value.map(async (bookMeta) => {
      let loaded = bookCache.get(bookMeta.slug)
      if (!loaded) {
        const response = await fetch(`${DATA_BASE_URL}/${bookMeta.slug}/book.json`)
        if (!response.ok) return
        loaded = await response.json()
        bookCache.set(bookMeta.slug, loaded)
      }

      if (!loaded) return

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
  )

  globalCorpus.value = corpus
}

async function runGlobalSearch() {
  if (searchScope.value !== SEARCH_SCOPE_GLOBAL) {
    globalResults.value = []
    return
  }

  const query = searchTerm.value.trim().toLowerCase()
  if (!query) {
    globalResults.value = []
    return
  }

  isGlobalSearching.value = true

  try {
    await ensureGlobalCorpus()

    globalResults.value = globalCorpus.value
      .filter((entry) => {
        const text = String(entry.text || '').toLowerCase()
        const reference = String(entry.reference || '').toLowerCase()
        return text.includes(query) || reference.includes(query)
      })
      .slice(0, MAX_GLOBAL_RESULTS)
  } finally {
    isGlobalSearching.value = false
  }
}

function jumpToVerse(verse) {
  searchScope.value = SEARCH_SCOPE_CHAPTER

  if (selectedSlug.value === verse.slug) {
    skipNextChapterReset.value = true
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
      selectedSlug.value = hasPreferred ? preferredSlug : books.value[0].slug
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

watch(selectedChapterNumber, () => {
  if (skipNextChapterReset.value) {
    skipNextChapterReset.value = false
    return
  }
  activeReference.value = ''
})

watch(searchScope, async (scope) => {
  if (scope === SEARCH_SCOPE_CHAPTER) {
    globalResults.value = []
    return
  }
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
    <header class="hero">
      <p class="eyebrow">Scripture Study Guide</p>
      <h1>Read, reflect, and keep notes verse-by-verse</h1>
      <p class="subtitle">
        Built on the {{ indexData?.translation || 'Bible text data' }} with a
        focused workflow for observation, interpretation, and application.
      </p>
    </header>

    <section class="control-panel" v-if="!isLoading">
      <label>
        Book
        <select v-model="selectedSlug" :disabled="isBookLoading">
          <option v-for="book in books" :key="book.slug" :value="book.slug">
            {{ book.name }}
          </option>
        </select>
      </label>

      <label>
        Chapter
        <select v-model.number="selectedChapterNumber" :disabled="isBookLoading">
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
        <select v-model="searchScope" :disabled="isBookLoading">
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
        />
      </label>
    </section>

    <section class="status" v-if="isLoading">Loading Bible index...</section>
    <section class="status error" v-else-if="errorMessage">{{ errorMessage }}</section>
    <section class="status" v-else-if="isBookLoading">Loading selected book...</section>

    <main class="study-layout" v-else>
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
          </p>
        </div>

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

        <p v-else class="empty-state">
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
