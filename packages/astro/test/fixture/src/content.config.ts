import { defineCollection } from 'astro:content'
import { postrLoader } from '../../../src/index.ts'

export const collections = {
  posts: defineCollection({
    loader: postrLoader({
      database: process.env.POSTR_FIXTURE_DB ?? '',
      siteUrl: 'https://example.com',
    }),
  }),
}
