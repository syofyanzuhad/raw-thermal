/**
 * ESC/POS character code tables (code pages).
 *
 * Why this module exists: thermal printers do not speak UTF-8 by default. ESC/POS solves
 * this with a "character code table" selected by `ESC t n`, and the selected table changes
 * what bytes 0x80-0xFF mean. Text therefore has to be re-encoded per table instead of being
 * handed to TextEncoder, which in browsers can only produce UTF-8.
 *
 * When the printer's code page does not match the bytes we send, non-ASCII text prints as
 * garbage. That is the classic cause of a mangled "Rp" or a broken "é".
 *
 * The byte tables live in ./codepageTables (generated from standard codecs, not typed by hand).
 */

// The `.ts` extension is written explicitly (allowed by `allowImportingTsExtensions`) so this
// module can be executed directly by Node's built-in test runner without a bundler.
import { CODEPAGE_HIGH_TABLES } from './codepageTables.ts'

export type CodepageId =
  | 'utf8'
  | 'cp437'
  | 'cp850'
  | 'cp852'
  | 'cp858'
  | 'cp860'
  | 'cp863'
  | 'cp865'
  | 'cp866'
  | 'wpc1252'
  | 'katakana'

export interface CodepageInfo {
  id: CodepageId
  label: string
  /**
   * Value of `n` for the `ESC t n` command.
   * `null` means no ESC t is sent at all (UTF-8 mode, bytes are passed through unchanged).
   */
  escposTable: number | null
  /** Byte table for 0x80-0xFF. `null` for UTF-8 mode, which uses no table. */
  high: string | null
}

/**
 * The `n` values follow Epson's official ESC/POS "Select character code table" table.
 * Only widely supported values are included; some models also accept 21/22 (Hebrew/Arabic)
 * but not every firmware knows them.
 */
export const CODEPAGES: readonly CodepageInfo[] = [
  { id: 'utf8', label: 'UTF-8 (printer UTF-8 mode)', escposTable: null, high: null },
  { id: 'wpc1252', label: 'WPC1252 - Windows Latin 1', escposTable: 16, high: CODEPAGE_HIGH_TABLES.wpc1252 },
  { id: 'cp850', label: 'CP850 - Multilingual Latin 1', escposTable: 2, high: CODEPAGE_HIGH_TABLES.cp850 },
  { id: 'cp858', label: 'CP858 - Multilingual + Euro', escposTable: 19, high: CODEPAGE_HIGH_TABLES.cp858 },
  { id: 'cp437', label: 'CP437 - USA / Standard Europe', escposTable: 0, high: CODEPAGE_HIGH_TABLES.cp437 },
  { id: 'cp852', label: 'CP852 - Latin 2 (Central Europe)', escposTable: 18, high: CODEPAGE_HIGH_TABLES.cp852 },
  { id: 'cp860', label: 'CP860 - Portuguese', escposTable: 3, high: CODEPAGE_HIGH_TABLES.cp860 },
  { id: 'cp863', label: 'CP863 - Canadian French', escposTable: 4, high: CODEPAGE_HIGH_TABLES.cp863 },
  { id: 'cp865', label: 'CP865 - Nordic', escposTable: 5, high: CODEPAGE_HIGH_TABLES.cp865 },
  { id: 'cp866', label: 'CP866 - Cyrillic', escposTable: 17, high: CODEPAGE_HIGH_TABLES.cp866 },
  { id: 'katakana', label: 'Katakana - Japanese half-width', escposTable: 1, high: CODEPAGE_HIGH_TABLES.katakana }
]

export const DEFAULT_CODEPAGE: CodepageId = 'utf8'

const CODEPAGE_BY_ID = new Map<string, CodepageInfo>(CODEPAGES.map(cp => [cp.id, cp]))

export function isCodepageId(value: string): value is CodepageId {
  return CODEPAGE_BY_ID.has(value)
}

/**
 * `encoding` values written by earlier versions of the app.
 *
 * 'GB2312' maps to UTF-8 because the old implementation never encoded anything itself (it
 * always used TextEncoder, i.e. UTF-8), so UTF-8 is what actually reached the printer.
 */
const LEGACY_CODEPAGE_IDS: Record<string, CodepageId> = {
  'UTF-8': 'utf8',
  'CP437': 'cp437',
  'GB2312': 'utf8'
}

/**
 * Coerce a stored value into a usable code page id.
 *
 * Anything unknown, legacy, or malformed falls back to the default instead of being trusted,
 * so a stale localStorage entry cannot put the app into an unusable state.
 */
export function normalizeCodepageId(value: unknown): CodepageId {
  if (typeof value === 'string') {
    if (isCodepageId(value)) return value
    const migrated = LEGACY_CODEPAGE_IDS[value]
    if (migrated) return migrated
  }
  return DEFAULT_CODEPAGE
}

export function getCodepage(id: CodepageId): CodepageInfo {
  const info = CODEPAGE_BY_ID.get(id)
  if (!info) {
    throw new Error(`Unknown codepage: ${id}`)
  }
  return info
}

/** Codepoint -> byte lookup for the 0x80-0xFF table, built once per code page. */
const reverseCache = new Map<CodepageId, Map<number, number>>()

function getReverseMap(id: CodepageId): Map<number, number> {
  const cached = reverseCache.get(id)
  if (cached) return cached

  const map = new Map<number, number>()
  const high = getCodepage(id).high
  if (high) {
    for (let i = 0; i < high.length; i++) {
      const codePoint = high.charCodeAt(i)
      // \u0000 marks a byte that this code page does not define.
      if (codePoint === 0) continue
      // The first byte that maps to a character wins, so encode(decode(byte)) stays stable
      // even when a code page lists the same character under two bytes.
      if (!map.has(codePoint)) {
        map.set(codePoint, 0x80 + i)
      }
    }
  }

  reverseCache.set(id, map)
  return map
}

/**
 * ASCII stand-in for a character the target code page cannot represent.
 *
 * Two stages: an explicit table first (for symbols whose Unicode decomposition does not help,
 * e.g. "€"), then Unicode decomposition to drop diacritics ("é" -> "e").
 * Returns `null` when there is no sensible stand-in.
 */
const TRANSLITERATION: Record<string, string> = {
  '\u20ac': 'EUR', '\u00a3': 'GBP', '\u00a5': 'JPY', '\u20a9': 'KRW', '\u20bd': 'RUB',
  '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u00ab': '"', '\u00bb': '"',
  '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u2032': "'", '\u2033': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u2010': '-', '\u2011': '-',
  '\u2026': '...', '\u2022': '*', '\u00b7': '.', '\u2219': '.',
  '\u00d7': 'x', '\u00f7': '/', '\u2192': '->', '\u2190': '<-', '\u2194': '<->',
  '\u2248': '~', '\u2260': '!=', '\u2264': '<=', '\u2265': '>=',
  '\u2122': '(TM)', '\u00a9': '(C)', '\u00ae': '(R)',
  '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ', '\u200b': '', '\u00ad': '',
  // Letters that do not decompose into plain ASCII.
  '\u00f8': 'o', '\u00d8': 'O', '\u00df': 'ss', '\u00e6': 'ae', '\u00c6': 'AE',
  '\u0153': 'oe', '\u0152': 'OE', '\u0142': 'l', '\u0141': 'L',
  '\u0111': 'd', '\u0110': 'D', '\u00f0': 'd', '\u00d0': 'D',
  '\u00fe': 'th', '\u00de': 'TH', '\u0131': 'i', '\u0161': 's', '\u0160': 'S',
  '\u017e': 'z', '\u017d': 'Z', '\u010d': 'c', '\u010c': 'C',
  '\u0159': 'r', '\u0158': 'R',
  '\u0105': 'a', '\u0104': 'A', '\u0119': 'e', '\u0118': 'E',
  '\u015f': 's', '\u015e': 'S', '\u0163': 't', '\u0162': 'T',
  '\u0103': 'a', '\u0102': 'A', '\u016f': 'u', '\u016e': 'U'
}

const COMBINING_MARKS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g

export function transliterate(char: string): string | null {
  const direct = TRANSLITERATION[char]
  if (direct !== undefined) return direct

  const decomposed = char.normalize('NFD').replace(COMBINING_MARKS, '')
  if (decomposed === char) return null
  // Only trust the decomposition when it really landed on ASCII.
  return /^[\x20-\x7e]*$/.test(decomposed) ? decomposed : null
}

export interface EncodeTextResult {
  bytes: Uint8Array
  /** Characters missing from the code page with no stand-in; sent as '?' instead. */
  unmapped: string[]
}

/**
 * Encode text into printer bytes for the given code page.
 *
 * For 'utf8' the bytes are passed through unchanged (printers with a UTF-8 mode understand
 * them). For single-byte code pages, characters that are not in the table are first
 * transliterated to ASCII; if that fails they are sent as '?' and reported in `unmapped` so
 * the UI can warn the user instead of silently printing garbage.
 */
export function encodeTextWithReport(text: string, codepage: CodepageId = DEFAULT_CODEPAGE): EncodeTextResult {
  if (codepage === 'utf8') {
    return { bytes: new TextEncoder().encode(text), unmapped: [] }
  }

  const reverse = getReverseMap(codepage)
  const bytes: number[] = []
  const unmapped: string[] = []
  const asciiEncoder = new TextEncoder()

  // Iterate by code point, not code unit, so surrogate pairs (emoji) are not split apart.
  for (const char of text) {
    const codePoint = char.codePointAt(0)!

    if (codePoint < 0x80) {
      bytes.push(codePoint)
      continue
    }

    const mapped = reverse.get(codePoint)
    if (mapped !== undefined) {
      bytes.push(mapped)
      continue
    }

    const fallback = transliterate(char)
    if (fallback !== null) {
      for (const b of asciiEncoder.encode(fallback)) {
        bytes.push(b)
      }
      continue
    }

    if (!unmapped.includes(char)) {
      unmapped.push(char)
    }
    bytes.push(0x3f) // '?'
  }

  return { bytes: new Uint8Array(bytes), unmapped }
}

export function encodeText(text: string, codepage: CodepageId = DEFAULT_CODEPAGE): Uint8Array {
  return encodeTextWithReport(text, codepage).bytes
}
