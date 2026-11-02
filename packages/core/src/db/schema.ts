import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import type { Mf2Item, Mf2Properties } from '../mf2.ts'

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    /** Permalink path, computed when the post is created or its slug/date changes. */
    path: text('path').notNull().unique(),
    slug: text('slug').notNull(),
    type: text('type').notNull(),
    postType: text('post_type').notNull(),
    status: text('status', { enum: ['published', 'draft'] }).notNull(),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    }).notNull(),
    /** Original ISO string, keeping the author's timezone offset. */
    published: text('published').notNull(),
    /** UTC epoch milliseconds of `published`, used for sorting. */
    publishedAt: integer('published_at').notNull(),
    updated: text('updated').notNull(),
    deletedAt: text('deleted_at'),
    properties: text('properties', { mode: 'json' })
      .$type<Mf2Properties>()
      .notNull(),
    children: text('children', { mode: 'json' }).$type<string[]>(),
  },
  (t) => [
    index('posts_published_at_idx').on(t.publishedAt),
    index('posts_post_type_idx').on(t.postType),
  ],
)

/** Fetched snapshots of external pages that posts reference. */
export const refs = sqliteTable('refs', {
  url: text('url').primaryKey(),
  entry: text('entry', { mode: 'json' }).$type<Mf2Item>(),
  fetchedAt: text('fetched_at').notNull(),
  error: text('error'),
})

export const postRefs = sqliteTable(
  'post_refs',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    /** mf2 property the URL came from, e.g. `in-reply-to`, or `mention` for content links. */
    rel: text('rel').notNull(),
    url: text('url').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.rel, t.url] }),
    index('post_refs_url_idx').on(t.url),
  ],
)

export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** Epoch milliseconds when the job is next due. */
    runAt: integer('run_at').notNull(),
    lastError: text('last_error'),
  },
  (t) => [index('jobs_run_at_idx').on(t.runAt)],
)

export type PostRow = typeof posts.$inferSelect
export type JobRow = typeof jobs.$inferSelect
