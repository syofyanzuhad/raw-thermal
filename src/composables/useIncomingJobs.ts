import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIncomingStore } from '@/stores/incoming'
import { buildIncomingJob, type IncomingJobRequest } from '@/services/share/incoming'
import {
  SHARED_INTENT_EVENT,
  getSharedPayloadNative,
  isShareIntentSupported
} from '@/services/native/ShareIntentBridge'

/** The route that knows how to preview and print a document. */
const PRINT_ROUTE = '/file-print'

/**
 * Routes documents that arrive from outside the app to the print screen.
 *
 * Mounted once, from App.vue, so a share is picked up no matter which screen the user is on.
 */
export function useIncomingJobs() {
  const router = useRouter()
  const incoming = useIncomingStore()

  /**
   * Validate, store, and navigate. Returns false when the document cannot be printed, in which
   * case the reason is left in the store for the print screen to show.
   */
  async function accept(request: IncomingJobRequest): Promise<boolean> {
    const result = buildIncomingJob(request)

    if (!result.ok) {
      incoming.setProblem(result.reason)
      return false
    }

    incoming.set(result.job)

    // Already on the print screen: the store change is enough, and pushing the current route
    // again would be a redundant navigation.
    if (router.currentRoute.value.path !== PRINT_ROUTE) {
      await router.push(PRINT_ROUTE)
    }

    return true
  }

  /**
   * Pull anything the native side is holding.
   *
   * This is the reliable half of the mechanism: on a cold start the intent is handled before
   * the page exists, so the pushed event is lost, but the payload is still waiting to be
   * collected. Returns false when there was nothing to collect.
   */
  async function collectSharedIntent(): Promise<boolean> {
    const payload = await getSharedPayloadNative()
    if (!payload) return false

    return accept({ ...payload, source: 'share' })
  }

  function handleSharedIntentEvent() {
    void collectSharedIntent()
  }

  onMounted(async () => {
    window.addEventListener(SHARED_INTENT_EVENT, handleSharedIntentEvent)

    // Only meaningful on Android, and only after a cold start launched by a share.
    if (isShareIntentSupported()) {
      await collectSharedIntent()
    }
  })

  onUnmounted(() => {
    window.removeEventListener(SHARED_INTENT_EVENT, handleSharedIntentEvent)
  })

  return { accept, collectSharedIntent }
}
