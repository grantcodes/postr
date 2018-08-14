const { isRxDocument } = require('rxdb')

/**
 * Sets default properties in any document
 * This includes published date, slug & visibility
 * @param {RxDocument|object} doc An RxDocument
 */
module.exports = doc => {
  if (isRxDocument(doc)) {
    if (doc.get('_id') && !doc.get('properties.mp-slug')) {
      // TODO: generate better unique slugs
      doc.set('properties.mp-slug', [doc._id])
    }
    doc.set('properties.updated', [new Date().toISOString()])
    if (!doc.get('properties.visibility')) {
      doc.set('properties.visibility', ['visible'])
    }
    if (!doc.get('properties.post-status')) {
      doc.set('properties.post-status', 'published')
    }
  } else {
    if (!doc.properties.published) {
      doc.properties.published = [new Date().toISOString()]
    }
    if (doc._id && !doc.properties['mp-slug']) {
      // TODO: This is also very unlikey to have an _id?
      // TODO: generate shorter unique slugs, maybe even generate them from the text content...
      doc.properties['mp-slug'] = [doc._id]
    }
    if (!doc.properties.visibility) {
      doc.properties.visibility = ['visible']
    }
    if (!doc.properties['post-status']) {
      doc.properties['post-status'] = ['published']
    }
    if (doc.properties.created) {
      doc.indexDate = new Date(doc.properties.created).getTime()
    } else if (doc.properties.published) {
      doc.indexDate = new Date(doc.properties.published).getTime()
    }
  }

  return doc
}
