export const SEARCH_SCOPE_CHAPTER = 'chapter'
export const SEARCH_SCOPE_GLOBAL = 'global'
export const MAX_GLOBAL_RESULTS = 200
export const STORAGE_KEY = 'bible-study-notes-v1'

export const EMPTY_NOTE = Object.freeze({
  observation: '',
  interpretation: '',
  application: '',
  prayer: '',
})

/**
 * Sort a list of book metadata objects by their position in the given canon
 * order array. Books not found in the array are sorted to the end
 * alphabetically.
 *
 * @param {Array<{name: string}>} books
 * @param {string[]} canonOrder
 * @returns {Array<{name: string}>}
 */
export function sortBooksByCanon(books, canonOrder) {
  const rank = new Map(canonOrder.map((name, idx) => [name, idx]))
  return [...books].sort((a, b) => {
    const aRank = rank.has(a.name) ? rank.get(a.name) : Number.MAX_SAFE_INTEGER
    const bRank = rank.has(b.name) ? rank.get(b.name) : Number.MAX_SAFE_INTEGER
    if (aRank !== bRank) return aRank - bRank
    return a.name.localeCompare(b.name)
  })
}

/**
 * Filter an already-ordered list of books to those belonging to a given group.
 * When the group has `books: null` (i.e. "All books"), the full list is
 * returned unchanged.
 *
 * @param {Array<{name: string}>} orderedBooks
 * @param {string} groupId
 * @param {Array<{id: string, books: string[]|null}>} bookGroups
 * @returns {Array<{name: string}>}
 */
export function filterBooksByGroup(orderedBooks, groupId, bookGroups) {
  const group = bookGroups.find((g) => g.id === groupId)
  if (!group || !group.books) return orderedBooks
  const allowed = new Set(group.books)
  return orderedBooks.filter((book) => allowed.has(book.name))
}

/**
 * Filter a list of verse objects to those whose text or reference contains the
 * given query string (case-insensitive). Returns the full list when the query
 * is empty.
 *
 * @param {Array<{text: string, reference: string}>} verses
 * @param {string} query  Raw (un-lowercased) search string
 * @returns {Array<{text: string, reference: string}>}
 */
export function filterVersesByQuery(verses, query) {
  const q = query.trim().toLowerCase()
  if (!q) return verses
  return verses.filter((verse) => {
    const text = String(verse.text || '').toLowerCase()
    const reference = String(verse.reference || '').toLowerCase()
    return text.includes(q) || reference.includes(q)
  })
}

/**
 * Build the group options array including per-group book counts.
 *
 * @param {Array<{name: string}>} orderedBooks
 * @param {Array<{id: string, label: string, books: string[]|null}>} bookGroups
 * @returns {Array<{id, label, books, count, displayLabel}>}
 */
export function buildGroupOptions(orderedBooks, bookGroups) {
  return bookGroups.map((group) => {
    if (!group.books) {
      return {
        ...group,
        count: orderedBooks.length,
        displayLabel: `${group.label} (${orderedBooks.length})`,
      }
    }
    const allowed = new Set(group.books)
    const count = orderedBooks.filter((b) => allowed.has(b.name)).length
    return {
      ...group,
      count,
      displayLabel: `${group.label} (${count})`,
    }
  })
}

/**
 * Parse navigation state from a URL search string.
 *
 * @param {string} search  e.g. window.location.search
 * @returns {{ slug: string, chapter: number|null, reference: string, query: string, scope: string|null }}
 */
export function parseUrlParams(search) {
  const params = new URLSearchParams(search)

  const slug = params.get('book') || ''
  const rawChapter = Number.parseInt(params.get('chapter') || '', 10)
  const chapter = Number.isFinite(rawChapter) ? rawChapter : null
  const reference = params.get('verse') || ''
  const query = params.get('q') || ''
  const scope = params.get('scope') || null

  return { slug, chapter, reference, query, scope }
}

/**
 * Build a URL query string from the current navigation state.
 *
 * @param {{ slug: string, chapter: number, reference: string, searchTerm: string, searchScope: string }} state
 * @returns {string}  Query string (without leading '?'), or empty string
 */
export function buildUrlParams({ slug, chapter, reference, searchTerm, searchScope }) {
  const params = new URLSearchParams()

  if (slug) params.set('book', slug)
  if (chapter) params.set('chapter', String(chapter))
  if (reference) params.set('verse', reference)
  if (searchTerm?.trim()) params.set('q', searchTerm.trim())
  if (searchScope && searchScope !== SEARCH_SCOPE_CHAPTER) {
    params.set('scope', searchScope)
  }

  return params.toString()
}

/**
 * Ensure a note record exists for `reference` in the given notes map and
 * return it. Mutates the map in place.
 *
 * @param {Record<string, object>} notes
 * @param {string} reference
 * @returns {{ observation: string, interpretation: string, application: string, prayer: string }}
 */
export function ensureNote(notes, reference) {
  if (!notes[reference]) {
    notes[reference] = {
      observation: '',
      interpretation: '',
      application: '',
      prayer: '',
    }
  }
  return notes[reference]
}
