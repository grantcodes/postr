const { isRxDocument } = require('rxdb')
const marked = require('marked')
const htmlToText = require('html-to-text')

/**
 * A wrapper function to strip tags from a html string
 * @param {string} html A html string to convert to plaintext
 */
const striptags = (html) =>
  htmlToText.fromString(html, {
    wordwrap: false,
    noLinkBrackets: true,
    uppercaseHeadings: true,
    hideLinkHrefIfSameAsText: true,
  })

/**
 * Get hashtags from a string using a basic regex
 * @param {string} text A text string to scrape for hashtags
 * @param {boolean} includeHash True to include the intial hashtag in the returned strings
 * @returns {array} Array of found hashtags
 */
const getHashtags = (text, inludeHash = false) => {
  var regexp = /\B\#\w\w+\b/g
  const results = text.match(regexp) || []
  if (inludeHash) {
    return results
  }
  return results.map((tag) => tag.substr(1))
}

/**
 * Formats the content of a document. Plain text is run through a markdown parser.
 * HTML is converted to plain text and both formats are stored
 * @param {RxDocument|object} doc An RXDocument or mf2 json post object
 */
module.exports = (doc) => {
  let post = null
  if (isRxDocument(doc)) {
    post = doc._data
  } else {
    post = doc
  }

  let modified = false
  let contents = post.properties.content
  const hashTags = []

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
