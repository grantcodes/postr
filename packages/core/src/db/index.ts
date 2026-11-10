import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export function openDatabase(path: string) {
  const client = new DatabaseSync(path)
  client.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  const db = drizzle({ client })
  migrate(db, { migrationsFolder })
  return db
}

export type Database = ReturnType<typeof openDatabase>
