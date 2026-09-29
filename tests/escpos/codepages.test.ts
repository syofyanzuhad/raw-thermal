/**
 * Tests for the ESC/POS code page module.
 *
 * Run directly by Node's built-in test runner (`node --test`), with no bundler and no extra
 * test dependency. That is why imports here carry an explicit `.ts` extension: Node ESM
 * requires fully specified specifiers.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CODEPAGES,
  DEFAULT_CODEPAGE,
  encodeText,
  encodeTextWithReport,
  getCodepage,
  isCodepageId,
  normalizeCodepageId,
  transliterate
} from '../../src/services/escpos/codepages.ts'
import { CODEPAGE_HIGH_TABLES } from '../../src/services/escpos/codepageTables.ts'

test('every table holds 128 characters for bytes 0x80-0xFF', () => {
  for (const codepage of CODEPAGES) {
    if (codepage.high === null) continue
    assert.equal(codepage.high.length, 128, codepage.id)
  }
})

test('ESC t n values follow the official Epson table', () => {
  assert.equal(getCodepage('cp437').escposTable, 0)
  assert.equal(getCodepage('katakana').escposTable, 1)
  assert.equal(getCodepage('cp850').escposTable, 2)
  assert.equal(getCodepage('cp860').escposTable, 3)
  assert.equal(getCodepage('cp863').escposTable, 4)
  assert.equal(getCodepage('cp865').escposTable, 5)
  assert.equal(getCodepage('wpc1252').escposTable, 16)
  assert.equal(getCodepage('cp866').escposTable, 17)
  assert.equal(getCodepage('cp852').escposTable, 18)
  assert.equal(getCodepage('cp858').escposTable, 19)
  // UTF-8 mode sends no ESC t at all.
  assert.equal(getCodepage('utf8').escposTable, null)
})

test('known bytes map to the expected characters', () => {
  assert.equal(CODEPAGE_HIGH_TABLES.cp437.charCodeAt(0x82 - 0x80), 0x00e9) // e-acute
  assert.equal(CODEPAGE_HIGH_TABLES.cp437.charCodeAt(0x9b - 0x80), 0x00a2) // cent
  assert.equal(CODEPAGE_HIGH_TABLES.cp850.charCodeAt(0x81 - 0x80), 0x00fc) // u-umlaut
  assert.equal(CODEPAGE_HIGH_TABLES.cp858.charCodeAt(0xd5 - 0x80), 0x20ac) // euro
  assert.equal(CODEPAGE_HIGH_TABLES.wpc1252.charCodeAt(0x80 - 0x80), 0x20ac) // euro
  assert.equal(CODEPAGE_HIGH_TABLES.wpc1252.charCodeAt(0xe9 - 0x80), 0x00e9) // e-acute
  assert.equal(CODEPAGE_HIGH_TABLES.cp866.charCodeAt(0x80 - 0x80), 0x0410) // Cyrillic A
  assert.equal(CODEPAGE_HIGH_TABLES.katakana.charCodeAt(0xa1 - 0x80), 0xff61)
})

test('undefined slots stay empty instead of being filled with a guess', () => {
  // CP1252 genuinely does not define 0x81.
  assert.equal(CODEPAGE_HIGH_TABLES.wpc1252.charCodeAt(0x81 - 0x80), 0)
  assert.equal(CODEPAGE_HIGH_TABLES.katakana.charCodeAt(0), 0)
})

test('ASCII text passes through every single-byte code page unchanged', () => {
  const ascii = 'Rp 50.000\nTerima kasih\n'
  const expected = [...new TextEncoder().encode(ascii)]

  for (const codepage of CODEPAGES) {
    if (codepage.high === null) continue
    assert.deepEqual([...encodeText(ascii, codepage.id)], expected, codepage.id)
  }
})

test('Latin-1 characters encode to the right code page byte', () => {
  assert.deepEqual([...encodeText('é', 'cp437')], [0x82])
  assert.deepEqual([...encodeText('é', 'wpc1252')], [0xe9])
  assert.deepEqual([...encodeText('ü', 'cp850')], [0x81])
  assert.deepEqual([...encodeText('А', 'cp866')], [0x80])
})

test('round-trip: every character in a table comes back as the same character', () => {
  for (const codepage of CODEPAGES) {
    const high: string | null = codepage.high
    if (high === null) continue

    for (let i = 0; i < high.length; i++) {
      const char: string | undefined = high[i]
      if (char === undefined || char === '') continue
      const codePoint: number | undefined = char.codePointAt(0)
      if (codePoint === undefined || codePoint === 0) continue

      const encoded = encodeText(char, codepage.id)
      const label = `${codepage.id} 0x${(0x80 + i).toString(16)}`

      assert.equal(encoded.length, 1, label)
      const byte: number | undefined = encoded[0]
      assert.notEqual(byte, undefined, label)
      assert.equal(high.charCodeAt(byte! - 0x80), codePoint, label)
    }
  }
})

test('UTF-8 mode passes bytes through unchanged', () => {
  assert.deepEqual([...encodeText('中文', 'utf8')], [0xe4, 0xb8, 0xad, 0xe6, 0x96, 0x87])
  assert.deepEqual([...encodeText('é', 'utf8')], [0xc3, 0xa9])
})

test('transliteration is used before falling back to a question mark', () => {
  // Katakana only has ASCII plus half-width katakana, so accented Latin must fall back to
  // its base letter.
  assert.deepEqual([...encodeText('é', 'katakana')], [0x65]) // e
  assert.deepEqual([...encodeText('ü', 'katakana')], [0x75]) // u
  assert.deepEqual([...encodeText('ñ', 'katakana')], [0x6e]) // n
})

test('currency symbols are transliterated only when the code page lacks them', () => {
  // CP437 has no euro sign.
  assert.deepEqual([...encodeText('€', 'cp437')], [...new TextEncoder().encode('EUR')])
  // CP858 has one at 0xD5, so it must be used directly.
  assert.deepEqual([...encodeText('€', 'cp858')], [0xd5])
})

test('emoji (surrogate pairs) are not split and are reported', () => {
  const result = encodeTextWithReport('a😀b', 'cp437')
  assert.deepEqual([...result.bytes], [0x61, 0x3f, 0x62])
  assert.deepEqual(result.unmapped, ['😀'])
})

test('an unmappable character is reported only once', () => {
  const result = encodeTextWithReport('中中中', 'cp437')
  assert.deepEqual([...result.bytes], [0x3f, 0x3f, 0x3f])
  assert.deepEqual(result.unmapped, ['中'])
})

test('transliterate returns null when there is no stand-in', () => {
  assert.equal(transliterate('中'), null)
  assert.equal(transliterate('é'), 'e')
  assert.equal(transliterate('€'), 'EUR')
  assert.equal(transliterate('a'), null) // ASCII needs no transliteration
})

test('isCodepageId rejects legacy and unknown values', () => {
  assert.equal(isCodepageId('cp437'), true)
  assert.equal(isCodepageId('utf8'), true)
  assert.equal(isCodepageId('UTF-8'), false)
  assert.equal(isCodepageId('GB2312'), false)
  assert.equal(isCodepageId(''), false)
})

test('normalizeCodepageId keeps valid ids untouched', () => {
  for (const codepage of CODEPAGES) {
    assert.equal(normalizeCodepageId(codepage.id), codepage.id)
  }
})

test('normalizeCodepageId migrates values written by older versions', () => {
  assert.equal(normalizeCodepageId('UTF-8'), 'utf8')
  assert.equal(normalizeCodepageId('CP437'), 'cp437')
  // GB2312 never actually encoded anything, so it behaved as UTF-8 all along.
  assert.equal(normalizeCodepageId('GB2312'), 'utf8')
})

test('normalizeCodepageId falls back to the default for anything unusable', () => {
  assert.equal(normalizeCodepageId('CP999'), DEFAULT_CODEPAGE)
  assert.equal(normalizeCodepageId(''), DEFAULT_CODEPAGE)
  assert.equal(normalizeCodepageId(undefined), DEFAULT_CODEPAGE)
  assert.equal(normalizeCodepageId(null), DEFAULT_CODEPAGE)
  assert.equal(normalizeCodepageId(42), DEFAULT_CODEPAGE)
  assert.equal(normalizeCodepageId({ encoding: 'cp437' }), DEFAULT_CODEPAGE)
})

test('the default stays utf8 so existing behaviour does not change', () => {
  assert.equal(DEFAULT_CODEPAGE, 'utf8')
  assert.deepEqual([...encodeText('é')], [0xc3, 0xa9])
})
