/**
 * Tests for the share-intent payload parser.
 *
 * This is the code that decides whether a share from Gmail/Word is text or a document, and
 * whether the bytes are trustworthy. It only ever runs on a device in production, so the tests
 * are the main evidence that it behaves.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseSharedPayload,
  deriveSharedFileName,
  extensionForMimeType,
  type SharedFilePayload,
  type SharedPayloadInput,
  type SharedTextPayload
} from '../../src/services/share/sharedPayload.ts'

/** Narrow to a file payload, failing loudly rather than with a confusing property access. */
function asFile(input: SharedPayloadInput): SharedFilePayload {
  const result = parseSharedPayload(input)
  if (result?.kind !== 'file') {
    throw new Error(`expected a file payload, got ${result?.kind ?? 'nothing'}`)
  }
  return result
}

function asText(input: SharedPayloadInput): SharedTextPayload {
  const result = parseSharedPayload(input)
  if (result?.kind !== 'text') {
    throw new Error(`expected a text payload, got ${result?.kind ?? 'nothing'}`)
  }
  return result
}

test('a payload with bytes is treated as a file', () => {
  const result = parseSharedPayload({
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    base64: 'G0A='
  })

  assert.deepEqual(result, {
    kind: 'file',
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    base64: 'G0A='
  })
})

test('file bytes win over the accompanying text', () => {
  // Gmail shares a PDF with EXTRA_TEXT set to the subject line. Printing the subject instead
  // of the attachment would be the wrong guess.
  const file = asFile({
    text: 'Fwd: your invoice',
    name: 'invoice.pdf',
    mimeType: 'application/pdf',
    base64: 'G0A='
  })

  assert.equal(file.name, 'invoice.pdf')
})

test('base64 wrapped by another app is accepted and normalised', () => {
  // Android's Base64.DEFAULT wraps at 76 columns, so a payload from another app can contain
  // newlines even though we always emit unwrapped output ourselves.
  const file = asFile({ base64: 'G0\nA=', mimeType: 'application/pdf' })

  assert.equal(file.base64, 'G0A=')
})

test('undecodable base64 falls back to the text', () => {
  const text = asText({ text: 'hello', base64: 'not base64!' })

  assert.equal(text.text, 'hello')
})

test('undecodable base64 with no text yields nothing', () => {
  assert.equal(parseSharedPayload({ base64: 'abc' }), null) // length 3 is not a multiple of 4
  assert.equal(parseSharedPayload({ base64: '####' }), null) // wrong alphabet
  assert.equal(parseSharedPayload({ base64: '   ' }), null) // whitespace only
})

test('a text share keeps its body and strips a BOM', () => {
  const text = asText({ text: '\uFEFFTotal: Rp 50.000', name: 'Total' })

  assert.equal(text.text, 'Total: Rp 50.000')
  assert.equal(text.title, 'Total')
})

test('a text share with no subject has no title', () => {
  assert.equal(asText({ text: 'hello' }).title, null)
})

test('whitespace-only text is not worth printing', () => {
  assert.equal(parseSharedPayload({ text: '   \n\t ' }), null)
  assert.equal(parseSharedPayload({}), null)
  assert.equal(parseSharedPayload({ text: null, base64: null }), null)
})

test('a file name without an extension gets one from the MIME type', () => {
  // The Android print framework labels jobs "document", with no extension, so the preview
  // would otherwise show an extensionless blob.
  assert.equal(deriveSharedFileName('document', 'application/pdf'), 'document.pdf')
  assert.equal(deriveSharedFileName('', 'application/pdf'), 'shared.pdf')
  assert.equal(deriveSharedFileName(null, 'image/jpeg'), 'shared.jpg')
})

test('an existing extension is left alone', () => {
  assert.equal(deriveSharedFileName('scan.PNG', 'image/jpeg'), 'scan.PNG')
  assert.equal(deriveSharedFileName('notes.txt', 'text/plain'), 'notes.txt')
})

test('unknown MIME types fall back to .bin', () => {
  assert.equal(extensionForMimeType('application/zip'), 'bin')
  assert.equal(extensionForMimeType('APPLICATION/PDF'), 'pdf')
  assert.equal(deriveSharedFileName('archive', 'application/zip'), 'archive.bin')
})

test('a file with no MIME type is reported as octet-stream, not as text', () => {
  // The extension-based rescue happens one layer up, in buildIncomingJob.
  const file = asFile({ name: 'notes.txt', base64: 'G0A=' })

  assert.equal(file.mimeType, 'application/octet-stream')
  assert.equal(file.name, 'notes.txt')
})
