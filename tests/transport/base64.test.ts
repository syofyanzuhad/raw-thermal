/**
 * Tests for the native-bridge base64 helpers.
 *
 * Run directly by Node's built-in test runner (`node --test`), so imports carry an explicit
 * `.ts` extension.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { bytesToBase64, base64ToBytes } from '../../src/services/transport/base64.ts'

test('round-trips a payload through base64 unchanged', () => {
  const bytes = new Uint8Array([0x00, 0x1b, 0x40, 0x7f, 0x80, 0xff, 0x0a])
  assert.deepEqual([...base64ToBytes(bytesToBase64(bytes))], [...bytes])
})

test('encodes the ESC/POS initialise sequence the way a printer expects it', () => {
  // Regression guard: a stray newline or a sign flip here silently corrupts every print.
  assert.equal(bytesToBase64(new Uint8Array([0x1b, 0x40])), 'G0A=')
})

test('produces unwrapped output, with no newlines', () => {
  // Android's Base64.DEFAULT wraps at 76 columns. Ours must not: the TS parser tolerates
  // newlines, but emitting them would be a pointless difference between the two sides.
  const encoded = bytesToBase64(new Uint8Array(300).fill(0xab))
  assert.ok(!encoded.includes('\n'), 'base64 output contains a newline')
  assert.ok(!encoded.includes('\r'), 'base64 output contains a carriage return')
})

test('survives a payload larger than the V8 argument-spread limit', () => {
  // Regression: building the binary string with a single spread throws RangeError around
  // 200,000 elements, which a queued PDF can easily exceed.
  const bytes = new Uint8Array(200000)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = i % 256
  }

  let encoded = ''
  assert.doesNotThrow(() => {
    encoded = bytesToBase64(bytes)
  })

  const decoded = base64ToBytes(encoded)
  assert.equal(decoded.length, bytes.length)
  assert.deepEqual([...decoded.subarray(0, 8)], [0, 1, 2, 3, 4, 5, 6, 7])
  // 199996 % 256 === 60, so the tail is 60..63 — a spot check that nothing was truncated or
  // silently shifted at a batch boundary.
  assert.deepEqual([...decoded.subarray(-4)], [60, 61, 62, 63])
})

test('handles an empty payload', () => {
  assert.equal(bytesToBase64(new Uint8Array(0)), '')
  assert.deepEqual([...base64ToBytes('')], [])
})
