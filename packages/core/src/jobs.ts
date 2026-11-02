import { asc, eq, lte } from 'drizzle-orm'
import type { Database } from './db/index.ts'
import { jobs } from './db/schema.ts'
import type { Logger } from './options.ts'

export type JobHandler = (payload: any) => Promise<void>

const maxAttempts = 5
const baseDelayMs = 60_000

/** Durable in-process job queue for side effects that should be retried (webmentions, syndication). */
export function createJobQueue(db: Database, log: Logger, autoRun: boolean) {
  const handlers = new Map<string, JobHandler>()
  let running: Promise<number> | null = null
  let timer: NodeJS.Timeout | undefined

  async function processDue(): Promise<number> {
    let processed = 0
    for (;;) {
      const [job] = await db
        .select()
        .from(jobs)
        .where(lte(jobs.runAt, Date.now()))
        .orderBy(asc(jobs.runAt), asc(jobs.id))
        .limit(1)
      if (!job) return processed
      processed++
      const handler = handlers.get(job.type)
      try {
        if (!handler) throw new Error(`No handler for job type ${job.type}`)
        await handler(job.payload)
        await db.delete(jobs).where(eq(jobs.id, job.id))
      } catch (err) {
        const attempts = job.attempts + 1
        const message = err instanceof Error ? err.message : String(err)
        if (attempts >= maxAttempts) {
          log.error(`[postr] job ${job.type} failed permanently: ${message}`)
          await db.delete(jobs).where(eq(jobs.id, job.id))
        } else {
          log.warn(`[postr] job ${job.type} failed (attempt ${attempts}): ${message}`)
          await db
            .update(jobs)
            .set({
              attempts,
              lastError: message,
              runAt: Date.now() + baseDelayMs * 4 ** (attempts - 1),
            })
            .where(eq(jobs.id, job.id))
        }
      }
    }
  }

  /** Runs every job that is due now. Concurrent calls share one run. */
  function runDue(): Promise<number> {
    running ??= processDue().finally(() => {
      running = null
    })
    return running
  }

  return {
    register(type: string, handler: JobHandler) {
      handlers.set(type, handler)
    },
    async enqueue(type: string, payload: unknown) {
      await db.insert(jobs).values({ type, payload, runAt: Date.now() })
      if (autoRun) setImmediate(() => void runDue())
    },
    runDue,
    /** Waits for any in-flight run, then drains due jobs. */
    async idle() {
      await running
      await runDue()
    },
    start() {
      if (!autoRun || timer) return
      timer = setInterval(() => void runDue(), baseDelayMs)
      timer.unref()
      setImmediate(() => void runDue())
    },
    stop() {
      clearInterval(timer)
      timer = undefined
    },
  }
}

export type JobQueue = ReturnType<typeof createJobQueue>
