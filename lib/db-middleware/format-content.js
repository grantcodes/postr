const { isRxDocument } = require('rxdb')
const marked = require('marked')
const htmlToText = require('html-to-text')

const striptags = html =>
  htmlToText.fromString(html, {
    wordwrap: false,
    noLinkBrackets: true,
    uppercaseHeadings: true,
    hideLinkHrefIfSameAsText: true,
  })

module.exports = doc => {
  let post = null
  if (isRxDocument(doc)) {
    post = doc._data
  } else {
    post = doc
  }

  let modified = false
  let contents = post.properties.content

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
    })
  }

  if (modified && isRxDocument(doc)) {
    // Update the rxdoc
    doc.set('properties.content', contents)
  } else if (modified) {
    // Update plain js object
    doc.properties.content = contents
  }

  return doc
}
