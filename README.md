# Postr

## What is this?

This is a nodejs IndieWeb backend, mainly consisting of a micropub endpoint that can be run as a module in an express project.

It includes a bunch of cool features (or I think they're cool anyway...)

### Features

- Supports micropub posting, actions and queries
- Media endpoint
- Automatically downloads images to your local media folder
- Image resizing
- Markdown parsing
- Automatic webmention sending
- Grabs referenced urls as microformats2
- Highly extensible via middleware
- Supports multiple database adapters
- Realtime updates and data replication

## Example Site

An example site is available to play around with on glitch at https://glitch.com/~postr

## Install

```bash
npm install @postr/core
```

## Usage

```js
const express = require('express')
const micropubEndpoint = require('@postr/core')
const app = express()
const myEndpoint = micropubEndpoint(/_config_/)

app.use('/micropub', myEndpoint.router)
app.listen(80)
```

### Config

Configuration can be passed as an object when using postr as a JavaScript module.

#### Options

```js
const options = {
  permalinkPattern: ':siteBaseUrl/:year/:month/:day/:slug', // (String) What your site permalinks look like. Written in express style. Must include year month and day at the moment
  sendWebmentions: true, // (Boolean) Send webmentions automatically or not
  formatContent: true, // (Boolean) Whether or not to format plain text content
  getRefs: true, // (Boolean) Enables parsing of referenced urls
  downloadExternalMedia: true, // (Boolean) Whether or not to download referenced media files (`photo`, `audio` and `video` properties). They will be saved to the default media endpoint
  syndication: [], // (Array) - Your syndication providers that will be returned in micropub config queries
  mediaDir: __dirname + '/../media', // (String) The local media directory
  dbName: 'micropubendpoint', // (String) The database name. Note: Must adhere to RxDB rules
  dbAdapter: 'leveldb', // (String|Object) The database adapter. Note: To use a different adapter you must also load the appropriate RxDB plugin
  imageSizes: {}, // (Object) A set of sizes to scale images to. should be in the format `{name: [width, height]}` eg. `{thumbnail: [200, 200], large: [1800, 0]}`, Note: If you pass 0 as the height the image will retain its original ratio
  siteBaseUrl: '', // (String)* The base url of your website with no trailing slash. Eg. `https://grant.codes`
  endpointBaseUrl: '', // (String)* The base url of this media endpoint with no trailing slash. Eg. `https://micropub.grant.codes` or `https://grant.codes/micropub`
  mediaBaseUrl: '', // (String)* The base url of your media folder. You should statically serve the `mediaDir` and set this option to the url
  dbPassword: '', // (String)* The database password
  tokenEndpoint: '', // (String)* Your token endpoint. Used for authenticating requests
  dangerousDevMode: false, // (Boolean) Set to true and the endpoint will skip checking tokens. It may do more in the future
  mediaEndpoint: '', // (String) If you want to post media to a different media endpoint pass the url here and all file storage will be handled by your media endpoint. No image resizing will be done.
}
```
