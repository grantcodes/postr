-- Full-text index of post text, kept in sync by the posts service (src/posts/search.ts).
-- Keyed by post_id rather than rowid so table rebuilds in later migrations cannot desync it.
CREATE VIRTUAL TABLE `posts_fts` USING fts5(
	post_id UNINDEXED,
	name,
	summary,
	content,
	category,
	tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- Backfill, mirroring searchFields() in src/posts/search.ts.
INSERT INTO `posts_fts` (post_id, name, summary, content, category)
SELECT
	p.id,
	coalesce((SELECT group_concat(value, ' ') FROM json_each(p.properties, '$.name') WHERE type = 'text'), ''),
	coalesce((SELECT group_concat(value, ' ') FROM json_each(p.properties, '$.summary') WHERE type = 'text'), ''),
	coalesce((
		SELECT group_concat(
			CASE type
				WHEN 'text' THEN value
				WHEN 'object' THEN coalesce(json_extract(value, '$.value'), json_extract(value, '$.html'))
			END, ' ')
		FROM json_each(p.properties, '$.content')
	), ''),
	coalesce((SELECT group_concat(value, ' ') FROM json_each(p.properties, '$.category') WHERE type = 'text'), '')
FROM `posts` p;
