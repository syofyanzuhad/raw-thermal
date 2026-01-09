<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logger, type LogEntry, type LogLevel } from '@/services/LogService'

const router = useRouter()

const logs = ref<LogEntry[]>([])
const filterLevel = ref<LogLevel | 'all'>('all')
const searchQuery = ref('')

const stats = computed(() => logger.getStats())

const filteredLogs = computed(() => {
  let result = logs.value

  // Filter by level
  if (filterLevel.value !== 'all') {
    result = result.filter(log => log.level === filterLevel.value)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(log =>
      log.tag.toLowerCase().includes(query) ||
      log.message.toLowerCase().includes(query)
    )
  }

  return result
})

function refreshLogs() {
  logs.value = logger.getLogsReversed()
}

function clearLogs() {
  if (confirm('Clear all logs?')) {
    logger.clearLogs()
    refreshLogs()
  }
}

function exportLogs() {
  const data = logger.exportLogs()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `raw-thermal-logs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function copyLogs() {
  const data = logger.exportLogs()
  navigator.clipboard.writeText(data).then(() => {
    alert('Logs copied to clipboard')
  }).catch(() => {
    alert('Failed to copy logs')
  })
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('id-ID', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'debug': return 'bg-gray-100 text-gray-600'
    case 'info': return 'bg-blue-100 text-blue-700'
    case 'warn': return 'bg-yellow-100 text-yellow-700'
    case 'error': return 'bg-red-100 text-red-700'
  }
}

onMounted(() => {
  refreshLogs()
})
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <button @click="router.back()" class="p-2 -ml-2">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="text-lg font-semibold">Application Logs</h1>
      <button @click="refreshLogs" class="p-2 -mr-2">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>

    <!-- Stats -->
    <div class="card bg-gray-50">
      <div class="grid grid-cols-4 gap-2 text-center text-sm">
        <div>
          <div class="font-semibold text-gray-900">{{ stats.total }}</div>
          <div class="text-xs text-gray-500">Total</div>
        </div>
        <div>
          <div class="font-semibold text-blue-600">{{ stats.byLevel.info }}</div>
          <div class="text-xs text-gray-500">Info</div>
        </div>
        <div>
          <div class="font-semibold text-yellow-600">{{ stats.byLevel.warn }}</div>
          <div class="text-xs text-gray-500">Warn</div>
        </div>
        <div>
          <div class="font-semibold text-red-600">{{ stats.byLevel.error }}</div>
          <div class="text-xs text-gray-500">Error</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-2">
      <select v-model="filterLevel" class="input flex-1">
        <option value="all">All Levels</option>
        <option value="debug">Debug</option>
        <option value="info">Info</option>
        <option value="warn">Warning</option>
        <option value="error">Error</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search..."
        class="input flex-1"
      />
    </div>

    <!-- Actions -->
    <div class="flex gap-2">
      <button @click="copyLogs" class="btn btn-secondary flex-1 text-sm py-2">
        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        Copy
      </button>
      <button @click="exportLogs" class="btn btn-secondary flex-1 text-sm py-2">
        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Export
      </button>
      <button @click="clearLogs" class="btn btn-secondary flex-1 text-sm py-2 text-red-600">
        <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Clear
      </button>
    </div>

    <!-- Log List -->
    <div class="space-y-2">
      <div v-if="filteredLogs.length === 0" class="card text-center text-gray-500 py-8">
        No logs found
      </div>

      <div
        v-for="log in filteredLogs"
        :key="log.id"
        class="card py-2 px-3"
      >
        <div class="flex items-start gap-2">
          <span
            class="text-xs font-medium px-1.5 py-0.5 rounded uppercase"
            :class="getLevelColor(log.level)"
          >
            {{ log.level }}
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span class="font-medium text-gray-700">{{ log.tag }}</span>
              <span>{{ formatTime(log.timestamp) }}</span>
            </div>
            <p class="text-sm text-gray-900 mt-0.5 break-words">{{ log.message }}</p>
            <pre
              v-if="log.data !== undefined"
              class="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded overflow-x-auto"
            >{{ typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Retention Info -->
    <div class="text-xs text-gray-400 text-center pb-4">
      Logs are retained for 7 days (max 500 entries)
    </div>
  </div>
</template>
