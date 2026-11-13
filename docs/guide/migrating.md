# Migrating from 1.x

2.0 is a clean break: SQLite replaces RxDB, Hono replaces Express, and plugins are plain
objects. To move your posts:

1. On 1.x, dump the posts collection:

   ```js
   const collection = await endpoint.getCollection()
   fs.writeFileSync('dump.json', JSON.stringify(await collection.dump()))
   ```

2. Import it, with `TZ` set to the old server's timezone so permalink dates match:

   ```bash
   TZ=Europe/Berlin npx -p @postr/core@alpha postr-import-legacy --dump dump.json --site-url https://example.com \
     --media-url https://example.com/media --database postr.db --dry-run
   ```

   If 1.x ran with `createdDateInPermalinks`, add `--created-date-in-permalinks`.

   Drop `--dry-run` to write the database. Ids, permalinks, dates, received webmentions and
   deleted posts are kept; nothing is re-sent. A deleted post whose permalink another post
   already uses is skipped and listed under `skipped` in the report.

   The CLI only knows the built-in post types. If you use custom ones, import from code with
   `importLegacyPosts(postr, docs, options)`, passing a postr instance created with your plugins.

3. With your 1.x media directory available as `media.dir` (and the same `imageSizes`), add image
   dimensions to the imported photos. This needs `sharp`:

   ```ts
   const postr = createPostr({ ...options, media: { dir, url, imageSizes } })
   console.log(await postr.media.backfill()) // { scanned, recorded, skipped, posts }
   ```

   See [Image dimensions](./getting-started.md#image-dimensions).
