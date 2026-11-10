---
layout: home

hero:
  name: Postr
  text: An IndieWeb backend for Node.js
  tagline: A Micropub server, media endpoint and typed post API on a single SQLite file.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Plugins
      link: /guide/plugins

features:
  - title: Micropub, fully
    details: Create, update, delete and undelete, every standard query and a media endpoint. Passes the micropub.rocks server tests.
  - title: Library first
    details: createPostr() returns a typed posts API and a fetch handler that drops into Node, Next.js or Astro.
  - title: Side effects that retry
    details: Webmentions, reference fetching and syndication run on a durable job queue with backoff.
  - title: Plugins
    details: Feeds, a webmention endpoint, and syndication to Telegram, Instagram and WebSub hubs.
---
