/**
 * Tests for turning a bridge payload into a file the print screen can load.
 *
 * This is the join between the two halves of the share path: the native side reports bytes and
 * a MIME type, and this decides what that means. Getting it wrong is invisible in production
 * until a user shares something and nothing happens.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildIncomingJob, type IncomingJobResult } from '../../src/services/share/incoming.ts'

/** Fail with the parser's own explanation instead of a confusing property access. */
function expectJob(result: IncomingJobResult) {
  if (!result.ok) throw new Error(`expected a job, but was refused: ${result.reason}`)
  return result.job
}

test('a shared PDF becomes a printable file', async () => {
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      name: 'invoice.pdf',
      mimeType: 'application/pdf',
      base64: 'G0A=' // 0x1b 0x40
    })
  )

  assert.equal(job.file.type, 'pdf')
  assert.equal(job.file.name, 'invoice.pdf')
  assert.equal(job.file.size, 2)
  assert.deepEqual([...new Uint8Array(await job.file.blob.arrayBuffer())], [0x1b, 0x40])
})

test('a shared image becomes a printable image', () => {
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      name: 'receipt.png',
      mimeType: 'image/png',
      base64: 'G0A='
    })
  )

  assert.equal(job.file.type, 'image')
})

test('shared text becomes a printable text file', async () => {
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      text: 'Total: Rp 50.000'
    })
  )

  assert.equal(job.file.type, 'text')
  assert.equal(job.file.mimeType, 'text/plain')
  // No sender name at all, so a readable placeholder with an extension.
  assert.equal(job.file.name, 'shared.txt')
  assert.equal(await job.file.blob.text(), 'Total: Rp 50.000')
})

test('a shared subject becomes the text file name, with an extension added', () => {
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      text: 'Total: Rp 50.000',
      name: 'Total'
    })
  )

  assert.equal(job.file.name, 'Total.txt')
})

test('a file with an unhelpful MIME type is rescued by its extension', () => {
  // Some apps report application/octet-stream for a .txt, which would otherwise be rejected.
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      name: 'notes.txt',
      mimeType: 'application/octet-stream',
      base64: 'G0A='
    })
  )

  assert.equal(job.file.type, 'text')
})

test('an unprintable file type is refused with a reason', () => {
  const result = buildIncomingJob({
    source: 'share',
    name: 'archive.zip',
    mimeType: 'application/zip',
    base64: 'G0A='
  })

  assert.equal(result.ok, false)
  assert.ok(!result.ok && result.reason.includes('application/zip'), 'reason names the type')
})

test('an empty share is refused with a reason', () => {
  const result = buildIncomingJob({ source: 'share' })

  assert.equal(result.ok, false)
  assert.ok(!result.ok && result.reason.length > 0)
})

test('a queued print job prints without a second confirmation', () => {
  // The user already asked to print it; the only reason it is queued is that no printer was
  // configured at the time.
  const job = expectJob(
    buildIncomingJob({
      source: 'pending-job',
      jobId: '42',
      name: 'document',
      mimeType: 'application/pdf',
      base64: 'G0A='
    })
  )

  assert.equal(job.autoPrint, true)
  assert.equal(job.jobId, '42')
  // The print framework's label has no extension, so one is derived from the MIME type.
  assert.equal(job.file.name, 'document.pdf')
})

test('a shared document waits for the user', () => {
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      name: 'invoice.pdf',
      mimeType: 'application/pdf',
      base64: 'G0A='
    })
  )

  assert.equal(job.autoPrint, false)
  assert.equal(job.jobId, null)
})

test('autoPrint can be forced either way', () => {
  const job = expectJob(
    buildIncomingJob({
      source: 'share',
      text: 'hello',
      autoPrint: true
    })
  )

  assert.equal(job.autoPrint, true)
})
