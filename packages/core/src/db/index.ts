import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** Opens and migrates the database; `readOnly` skips WAL setup and migrations. */
export function openDatabase(path: string, { readOnly = false } = {}) {
  const client = new DatabaseSync(path, { readOnly })
  client.exec(
    readOnly
      ? 'PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;'
      : 'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;'
  )
  const db = drizzle({ client })
  if (!readOnly) migrate(db, { migrationsFolder })
  return db
}

export type Database = ReturnType<typeof openDatabase>
