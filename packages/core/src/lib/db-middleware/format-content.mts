import { createRequire } from 'node:module'
import { isRxDocument } from 'rxdb'

const require = createRequire(import.meta.url)
const marked: any = require('marked')
const htmlToText: any = require('html-to-text')

/**
 * A wrapper function to strip tags from a html string
 */
const striptags = (html: string): string =>
  htmlToText.fromString(html, {
    wordwrap: false,
    noLinkBrackets: true,
    uppercaseHeadings: true,
    hideLinkHrefIfSameAsText: true,
  })

/**
 * Get hashtags from a string using a basic regex
 */
const getHashtags = (text: string, includeHash: boolean = false): string[] => {
  const regexp = /\B\#\w\w+\b/g
  const results = text.match(regexp) || []
  if (includeHash) {
    return results
  }
  return results.map(tag => tag.substr(1))
}

/**
 * Formats the content of a document. Plain text is run through a markdown parser.
 * HTML is converted to plain text and both formats are stored
 */
export default (doc: any): any => {
  let post = null
  if (isRxDocument(doc)) {
    post = doc._data
  } else {
    post = doc
  }

  let modified = false
  const contents = post.properties.content as any[]
  const hashTags: string[] = []

  if (contents && Array.isArray(contents)) {
    contents.forEach((content, i) => {
      if (typeof content === 'string') {
        contents[i] = {
          value: striptags(marked(content)),
          html: marked(content),
        }
        modified = true
      } else if (content.value && !content.html) {
        // This should probably never happen, but might as well handle it
        contents[i] = {
          value: content.value,
          html: marked(content.value),
        }
        modified = true
      } else if (content.html && !content.value) {
        contents[i] = {
          value: striptags(content.html),
          html: content.html,
        }
        modified = true
      }
      if (contents[i].value) {
        hashTags.push(...getHashtags(contents[i].value))
      }
    })
  }

  if (modified && isRxDocument(doc)) {
    // Update the rxdoc
    doc.set('properties.content', contents)
    if (hashTags.length) {
      const existingCats = doc.get('properties.category') || []
      doc.set('properties.category', [
        ...new Set([...existingCats, ...hashTags]),
      ])
    }
  } else if (modified) {
    // Update plain js object
    doc.properties.content = contents
    if (hashTags.length) {
      const existingCats = doc.properties.category || []
      doc.properties.category = [...new Set([...existingCats, ...hashTags])]
    }
  }

  return doc
}
