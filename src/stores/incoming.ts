import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { IncomingJob } from '@/services/share/incoming'

/**
 * Holds a document that arrived from outside the print screen — a share from another app, or a
 * print job the Android print framework queued while no printer was configured.
 *
 * A store rather than a prop because the two producers live in different places (App.vue's
 * share listener and PrinterView's pending-job handler) and both need to hand the document to
 * the same consumer, FilePrintView.
 */
export const useIncomingStore = defineStore('incoming', () => {
  const job = ref<IncomingJob | null>(null)

  /**
   * Why the last incoming document was rejected.
   *
   * Kept separate from the job so the print screen can explain a refusal instead of looking
   * like nothing happened when the user shares a file we cannot print.
   */
  const problem = ref<string | null>(null)

  function set(next: IncomingJob) {
    problem.value = null
    job.value = next
  }

  function setProblem(reason: string) {
    job.value = null
    problem.value = reason
  }

  /** Read and clear, so one document is only loaded once. */
  function consume(): IncomingJob | null {
    const current = job.value
    job.value = null
    return current
  }

  function clear() {
    job.value = null
    problem.value = null
  }

  return { job, problem, set, setProblem, consume, clear }
})
