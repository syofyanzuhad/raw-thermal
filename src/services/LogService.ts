/**
 * Application logging service with retention policy
 * Logs are stored in localStorage and automatically pruned
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  tag: string
  message: string
  data?: unknown
}

interface LogConfig {
  maxEntries: number      // Maximum number of log entries to retain
  maxAgeDays: number      // Maximum age of log entries in days
  storageKey: string      // localStorage key
}

const DEFAULT_CONFIG: LogConfig = {
  maxEntries: 500,
  maxAgeDays: 7,
  storageKey: 'app_logs'
}

class LogService {
  private config: LogConfig
  private logs: LogEntry[] = []
  private initialized = false

  constructor(config: Partial<LogConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initialize the log service, loading existing logs from storage
   */
  init(): void {
    if (this.initialized) return

    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (stored) {
        this.logs = JSON.parse(stored)
        this.applyRetention()
      }
    } catch (e) {
      console.error('[LogService] Failed to load logs:', e)
      this.logs = []
    }

    this.initialized = true
  }

  /**
   * Add a log entry
   */
  log(level: LogLevel, tag: string, message: string, data?: unknown): void {
    if (!this.initialized) this.init()

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      tag,
      message,
      data
    }

    this.logs.push(entry)
    this.applyRetention()
    this.save()

    // Also log to console for debugging
    const consoleFn = level === 'error' ? console.error
                    : level === 'warn' ? console.warn
                    : level === 'debug' ? console.debug
                    : console.log
    consoleFn(`[${tag}] ${message}`, data ?? '')
  }

  /**
   * Convenience methods for different log levels
   */
  debug(tag: string, message: string, data?: unknown): void {
    this.log('debug', tag, message, data)
  }

  info(tag: string, message: string, data?: unknown): void {
    this.log('info', tag, message, data)
  }

  warn(tag: string, message: string, data?: unknown): void {
    this.log('warn', tag, message, data)
  }

  error(tag: string, message: string, data?: unknown): void {
    this.log('error', tag, message, data)
  }

  /**
   * Get all logs, optionally filtered by level
   */
  getLogs(level?: LogLevel): LogEntry[] {
    if (!this.initialized) this.init()

    if (level) {
      return this.logs.filter(log => log.level === level)
    }
    return [...this.logs]
  }

  /**
   * Get logs in reverse chronological order (newest first)
   */
  getLogsReversed(level?: LogLevel): LogEntry[] {
    return this.getLogs(level).reverse()
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
    this.save()
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Get log statistics
   */
  getStats(): { total: number; byLevel: Record<LogLevel, number>; oldestDate: Date | null; newestDate: Date | null } {
    const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 }

    for (const log of this.logs) {
      byLevel[log.level]++
    }

    const firstLog = this.logs[0]
    const lastLog = this.logs[this.logs.length - 1]

    return {
      total: this.logs.length,
      byLevel,
      oldestDate: firstLog ? new Date(firstLog.timestamp) : null,
      newestDate: lastLog ? new Date(lastLog.timestamp) : null
    }
  }

  /**
   * Apply retention policy - remove old entries and limit total count
   */
  private applyRetention(): void {
    const now = Date.now()
    const maxAge = this.config.maxAgeDays * 24 * 60 * 60 * 1000

    // Remove entries older than maxAgeDays
    this.logs = this.logs.filter(log => (now - log.timestamp) < maxAge)

    // Keep only the most recent maxEntries
    if (this.logs.length > this.config.maxEntries) {
      this.logs = this.logs.slice(-this.config.maxEntries)
    }
  }

  /**
   * Save logs to localStorage
   */
  private save(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.logs))
    } catch (e) {
      console.error('[LogService] Failed to save logs:', e)
      // If storage is full, try removing oldest half
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        this.logs = this.logs.slice(Math.floor(this.logs.length / 2))
        try {
          localStorage.setItem(this.config.storageKey, JSON.stringify(this.logs))
        } catch {
          // Give up
        }
      }
    }
  }

  /**
   * Generate a unique ID for log entries
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Singleton instance
export const logger = new LogService()

// Initialize on import
logger.init()
