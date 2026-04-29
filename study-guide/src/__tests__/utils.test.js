import { describe, expect, it } from 'vitest'
import {
  EMPTY_NOTE,
  SEARCH_SCOPE_CHAPTER,
  SEARCH_SCOPE_GLOBAL,
  buildGroupOptions,
  buildUrlParams,
  ensureNote,
  filterBooksByGroup,
  filterVersesByQuery,
  parseUrlParams,
  sortBooksByCanon,
} from '../utils.js'

// ---------------------------------------------------------------------------
// sortBooksByCanon
// ---------------------------------------------------------------------------
describe('sortBooksByCanon', () => {
  const CANON = ['Genesis', 'Exodus', 'Leviticus']

  it('sorts books according to the canon order', () => {
    const books = [
      { name: 'Leviticus' },
      { name: 'Genesis' },
      { name: 'Exodus' },
    ]
    const result = sortBooksByCanon(books, CANON)
    expect(result.map((b) => b.name)).toEqual(['Genesis', 'Exodus', 'Leviticus'])
  })

  it('places unlisted books after canon books, sorted alphabetically', () => {
    const books = [
      { name: 'Zebediah' },
      { name: 'Alpha' },
      { name: 'Genesis' },
    ]
    const result = sortBooksByCanon(books, CANON)
    expect(result[0].name).toBe('Genesis')
    expect(result[1].name).toBe('Alpha')
    expect(result[2].name).toBe('Zebediah')
  })

  it('does not mutate the original array', () => {
    const books = [{ name: 'Exodus' }, { name: 'Genesis' }]
    const original = [...books]
    sortBooksByCanon(books, CANON)
    expect(books).toEqual(original)
  })

  it('returns an empty array when given an empty array', () => {
    expect(sortBooksByCanon([], CANON)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// filterBooksByGroup
// ---------------------------------------------------------------------------
describe('filterBooksByGroup', () => {
  const BOOK_GROUPS = [
    { id: 'all', label: 'All books', books: null },
    { id: 'pentateuch', label: 'Pentateuch', books: ['Genesis', 'Exodus'] },
    { id: 'wisdom', label: 'Wisdom', books: ['Job', 'Psalms'] },
  ]

  const orderedBooks = [
    { name: 'Genesis' },
    { name: 'Exodus' },
    { name: 'Job' },
    { name: 'Psalms' },
  ]

  it('returns all books for the "all" group', () => {
    expect(filterBooksByGroup(orderedBooks, 'all', BOOK_GROUPS)).toEqual(orderedBooks)
  })

  it('filters to only books in the selected group', () => {
    const result = filterBooksByGroup(orderedBooks, 'pentateuch', BOOK_GROUPS)
    expect(result.map((b) => b.name)).toEqual(['Genesis', 'Exodus'])
  })

  it('returns all books when groupId is not found', () => {
    expect(filterBooksByGroup(orderedBooks, 'nonexistent', BOOK_GROUPS)).toEqual(orderedBooks)
  })
})

// ---------------------------------------------------------------------------
// filterVersesByQuery
// ---------------------------------------------------------------------------
describe('filterVersesByQuery', () => {
  const verses = [
    { reference: 'Genesis 1:1', text: 'In the beginning God created the heavens and the earth.' },
    { reference: 'John 3:16', text: 'For God so loved the world.' },
    { reference: 'Psalm 23:1', text: 'The Lord is my shepherd.' },
  ]

  it('returns all verses when query is empty', () => {
    expect(filterVersesByQuery(verses, '')).toEqual(verses)
  })

  it('returns all verses when query is only whitespace', () => {
    expect(filterVersesByQuery(verses, '   ')).toEqual(verses)
  })

  it('matches by text content (case-insensitive)', () => {
    const result = filterVersesByQuery(verses, 'GOD')
    expect(result).toHaveLength(2)
    expect(result[0].reference).toBe('Genesis 1:1')
    expect(result[1].reference).toBe('John 3:16')
  })

  it('matches by reference (case-insensitive)', () => {
    const result = filterVersesByQuery(verses, 'genesis')
    expect(result).toHaveLength(1)
    expect(result[0].reference).toBe('Genesis 1:1')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterVersesByQuery(verses, 'zzznomatch')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildGroupOptions
// ---------------------------------------------------------------------------
describe('buildGroupOptions', () => {
  const BOOK_GROUPS = [
    { id: 'all', label: 'All books', books: null },
    { id: 'pentateuch', label: 'Pentateuch', books: ['Genesis', 'Exodus'] },
  ]

  const orderedBooks = [{ name: 'Genesis' }, { name: 'Exodus' }, { name: 'Job' }]

  it('counts all books for the "all" group', () => {
    const opts = buildGroupOptions(orderedBooks, BOOK_GROUPS)
    const allGroup = opts.find((o) => o.id === 'all')
    expect(allGroup.count).toBe(3)
    expect(allGroup.displayLabel).toBe('All books (3)')
  })

  it('counts only matching books for named groups', () => {
    const opts = buildGroupOptions(orderedBooks, BOOK_GROUPS)
    const pent = opts.find((o) => o.id === 'pentateuch')
    expect(pent.count).toBe(2)
    expect(pent.displayLabel).toBe('Pentateuch (2)')
  })

  it('preserves other group fields', () => {
    const opts = buildGroupOptions(orderedBooks, BOOK_GROUPS)
    expect(opts[1].label).toBe('Pentateuch')
    expect(opts[1].id).toBe('pentateuch')
  })
})

// ---------------------------------------------------------------------------
// parseUrlParams
// ---------------------------------------------------------------------------
describe('parseUrlParams', () => {
  it('parses all fields from a query string', () => {
    const result = parseUrlParams('?book=genesis&chapter=3&verse=Genesis+3:1&q=light&scope=global')
    expect(result.slug).toBe('genesis')
    expect(result.chapter).toBe(3)
    expect(result.reference).toBe('Genesis 3:1')
    expect(result.query).toBe('light')
    expect(result.scope).toBe('global')
  })

  it('returns defaults when string is empty', () => {
    const result = parseUrlParams('')
    expect(result.slug).toBe('')
    expect(result.chapter).toBeNull()
    expect(result.reference).toBe('')
    expect(result.query).toBe('')
    expect(result.scope).toBeNull()
  })

  it('returns null chapter when chapter param is not a number', () => {
    const result = parseUrlParams('?chapter=abc')
    expect(result.chapter).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildUrlParams
// ---------------------------------------------------------------------------
describe('buildUrlParams', () => {
  it('builds a full query string', () => {
    const qs = buildUrlParams({
      slug: 'genesis',
      chapter: 1,
      reference: 'Genesis 1:1',
      searchTerm: 'light',
      searchScope: SEARCH_SCOPE_GLOBAL,
    })
    const params = new URLSearchParams(qs)
    expect(params.get('book')).toBe('genesis')
    expect(params.get('chapter')).toBe('1')
    expect(params.get('verse')).toBe('Genesis 1:1')
    expect(params.get('q')).toBe('light')
    expect(params.get('scope')).toBe('global')
  })

  it('omits scope param when scope is chapter (the default)', () => {
    const qs = buildUrlParams({
      slug: 'genesis',
      chapter: 1,
      reference: '',
      searchTerm: '',
      searchScope: SEARCH_SCOPE_CHAPTER,
    })
    const params = new URLSearchParams(qs)
    expect(params.has('scope')).toBe(false)
  })

  it('omits whitespace-only searchTerm', () => {
    const qs = buildUrlParams({
      slug: 'genesis',
      chapter: 1,
      reference: '',
      searchTerm: '   ',
      searchScope: SEARCH_SCOPE_CHAPTER,
    })
    const params = new URLSearchParams(qs)
    expect(params.has('q')).toBe(false)
  })

  it('returns empty string when state is empty', () => {
    const qs = buildUrlParams({
      slug: '',
      chapter: 0,
      reference: '',
      searchTerm: '',
      searchScope: SEARCH_SCOPE_CHAPTER,
    })
    expect(qs).toBe('')
  })
})

// ---------------------------------------------------------------------------
// ensureNote
// ---------------------------------------------------------------------------
describe('ensureNote', () => {
  it('creates a blank note when the reference does not exist', () => {
    const notes = {}
    const note = ensureNote(notes, 'Genesis 1:1')
    expect(note).toEqual({ observation: '', interpretation: '', application: '', prayer: '' })
    expect(notes['Genesis 1:1']).toBe(note)
  })

  it('returns the existing note without overwriting', () => {
    const notes = { 'Genesis 1:1': { observation: 'existing', interpretation: '', application: '', prayer: '' } }
    const note = ensureNote(notes, 'Genesis 1:1')
    expect(note.observation).toBe('existing')
  })

  it('does not mutate notes for a different reference', () => {
    const notes = { 'John 3:16': { observation: 'kept', interpretation: '', application: '', prayer: '' } }
    ensureNote(notes, 'Genesis 1:1')
    expect(notes['John 3:16'].observation).toBe('kept')
  })
})

// ---------------------------------------------------------------------------
// EMPTY_NOTE
// ---------------------------------------------------------------------------
describe('EMPTY_NOTE', () => {
  it('has all four note fields as empty strings', () => {
    expect(EMPTY_NOTE).toEqual({ observation: '', interpretation: '', application: '', prayer: '' })
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(EMPTY_NOTE)).toBe(true)
  })
})
