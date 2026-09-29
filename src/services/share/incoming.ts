import { base64ToBytes } from '../transport/base64.ts'
import { getFileType, getFileTypeFromName, type SelectedFile } from '../file/fileTypes.ts'
import { deriveSharedFileName, parseSharedPayload, type SharedPayloadInput } from './sharedPayload.ts'

/** Where an incoming document came from. */
export type IncomingSource = 'share' | 'pending-job'

/**
 * A document handed to us by something outside the app, already converted into the shape the
 * print screen knows how to load.
 */
export interface IncomingJob {
  source: IncomingSource
  /** Native pending-job id, so the job can be cleared once it has actually printed. */
  jobId: string | null
  /** True when the document should print without the user pressing anything. */
  autoPrint: boolean
  file: SelectedFile
}

export interface IncomingJobRequest extends SharedPayloadInput {
  source: IncomingSource
  jobId?: string | null
  autoPrint?: boolean
}

/**
 * Success carries the job; failure carries a message worth showing the user.
 *
 * Returning a reason rather than `null` matters here: "you shared a .zip and we cannot print
 * it" is actionable, whereas a silently ignored share looks like the app is broken.
 */
export type IncomingJobResult =
  | { ok: true; job: IncomingJob }
  | { ok: false; reason: string }

/**
 * Convert a bridge payload into something `useFilePrint().loadFile()` accepts.
 *
 * Pure and dependency-free apart from the byte decoding, so it can be unit tested without a
 * device — which matters, because the whole share path is otherwise only verifiable on
 * hardware.
 */
export function buildIncomingJob(request: IncomingJobRequest): IncomingJobResult {
  const payload = parseSharedPayload(request)

  if (!payload) {
    return { ok: false, reason: 'Nothing was shared with the app' }
  }

  const mimeType = payload.kind === 'file' ? payload.mimeType : 'text/plain'
  // Shared text usually has no file name at all, and when it does (the subject line) it has no
  // extension, so the same naming rule is applied to both kinds.
  const name =
    payload.kind === 'file'
      ? payload.name
      : deriveSharedFileName(payload.title, 'text/plain')

  // Prefer the sender's MIME type, but fall back to the file extension: some apps report
  // application/octet-stream for a .txt, which would otherwise be rejected.
  const type = getFileType(mimeType) ?? getFileTypeFromName(name)
  if (!type) {
    return { ok: false, reason: `Cannot print this file type (${mimeType})` }
  }

  const blob =
    payload.kind === 'file'
      ? new Blob([base64ToBytes(payload.base64)], { type: mimeType })
      : new Blob([payload.text], { type: mimeType })

  return {
    ok: true,
    job: {
      source: request.source,
      jobId: request.jobId ?? null,
      // A queued print job exists because the user already asked to print it, so it should
      // not need a second confirmation once a printer shows up.
      autoPrint: request.autoPrint ?? request.source === 'pending-job',
      file: {
        name,
        type,
        mimeType,
        blob,
        size: blob.size
      }
    }
  }
}
