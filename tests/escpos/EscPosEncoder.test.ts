/**
 * Tests for the ESC/POS encoder.
 *
 * Run directly by Node's built-in test runner (`node --test`), so imports carry an explicit
 * `.ts` extension: Node ESM requires fully specified specifiers.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { EscPosEncoder, createEncoder, wrapText } from '../../src/services/escpos/EscPosEncoder.ts'

test('initialize sends ESC @ alone in utf8 mode', () => {
  assert.deepEqual([...createEncoder('utf8').initialize().encode()], [0x1b, 0x40])
})

test('initialize sends ESC t n after ESC @ for single-byte code pages', () => {
  // Order matters: ESC @ resets the printer's code table, so ESC t has to follow it.
  assert.deepEqual([...createEncoder('cp437').initialize().encode()], [0x1b, 0x40, 0x1b, 0x74, 0x00])
  assert.deepEqual([...createEncoder('wpc1252').initialize().encode()], [0x1b, 0x40, 0x1b, 0x74, 0x10])
  assert.deepEqual([...createEncoder('cp866').initialize().encode()], [0x1b, 0x40, 0x1b, 0x74, 0x11])
})

test('the default encoder stays utf8', () => {
  assert.deepEqual([...createEncoder().initialize().text('é').encode()], [0x1b, 0x40, 0xc3, 0xa9])
})

test('text uses the active code page instead of always UTF-8', () => {
  assert.deepEqual([...createEncoder('cp437').text('é').encode()], [0x82])
  assert.deepEqual(
    [...createEncoder('cp437').text('Rp 50.000').encode()],
    [0x52, 0x70, 0x20, 0x35, 0x30, 0x2e, 0x30, 0x30, 0x30]
  )
})

test('codepage() can switch tables mid-stream', () => {
  const encoder = createEncoder('utf8').initialize().text('a').codepage('cp437').text('é')
  assert.deepEqual([...encoder.encode()], [0x1b, 0x40, 0x61, 0x1b, 0x74, 0x00, 0x82])
})

test('unmapped reports characters the active code page cannot represent', () => {
  const encoder = createEncoder('cp437').initialize().text('中')
  assert.deepEqual(encoder.unmapped, ['中'])

  const clean = createEncoder('cp437').initialize().text('Rp 50.000')
  assert.deepEqual(clean.unmapped, [])
})

test('wrapText breaks at word boundaries', () => {
  assert.deepEqual(wrapText('aa bb cc dd', 5), ['aa bb', 'cc dd'])
})

test('wrapText preserves blank lines', () => {
  assert.deepEqual(wrapText('a\n\nb', 10), ['a', '', 'b'])
})

test('wrapText hard-breaks a word longer than one line', () => {
  assert.deepEqual(wrapText('abcdefgh', 3), ['abc', 'def', 'gh'])
})

test('wrapText normalises CRLF line endings', () => {
  assert.deepEqual(wrapText('a\r\nb', 10), ['a', 'b'])
})

test('wrapText never emits a line wider than the column count', () => {
  const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor'
  for (const columns of [8, 12, 32, 48]) {
    for (const line of wrapText(text, columns)) {
      assert.ok(line.length <= columns, `"${line}" at ${columns} columns`)
    }
  }
})

test('wrapText survives a nonsensical column count', () => {
  assert.deepEqual(wrapText('abc', 0), ['a', 'b', 'c'])
})

test('textBlock wraps the body and terminates every line with a newline', () => {
  const bytes = [...createEncoder('utf8').textBlock('aa bb cc', 5).encode()]
  assert.deepEqual(bytes, [...new TextEncoder().encode('aa bb\ncc\n')])
})

test('image does not throw on a large payload', () => {
  // Regression: `push(...imageData)` used to throw RangeError around 200,000 elements, which
  // an 80mm page taller than ~2777 dots can reach.
  const data = new Uint8Array(200000)
  const encoder = new EscPosEncoder()

  assert.doesNotThrow(() => encoder.image(data, 576, 2778))
  assert.equal(encoder.length, 8 + 200000)
})

test('basic commands emit the right bytes', () => {
  assert.deepEqual([...createEncoder().align('center').encode()], [0x1b, 0x61, 0x01])
  assert.deepEqual([...createEncoder().align('right').encode()], [0x1b, 0x61, 0x02])
  assert.deepEqual([...createEncoder().feed(3).encode()], [0x1b, 0x64, 0x03])
  assert.deepEqual([...createEncoder().cut().encode()], [0x1d, 0x56, 0x00])
  assert.deepEqual([...createEncoder().bold(true).encode()], [0x1b, 0x45, 0x01])
  assert.deepEqual([...createEncoder().setFontSize('double').encode()], [0x1d, 0x21, 0x11])
})
