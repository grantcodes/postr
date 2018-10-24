const { isRxDocument } = require('rxdb')
const moment = require('moment')
const createSlug = require('speakingurl')
const placeholders = require('../placeholders')
const postTypeDiscovery = require('../post-type-discovery')

const generateSlug = post => {
  let slugString = moment().format('hh-mm-ss')
  if (post.properties.name && post.properties.name[0]) {
    slugString = post.properties.name[0]
  } else if (post.properties.summary && post.properties.summary[0]) {
    slugString = post.properties.summary[0]
  } else if (post.properties.content && post.properties.content[0]) {
    const content = post.properties.content[0]
    if (typeof content === 'string') {
      slugString = content
    } else if (typeof content === 'object' && content.value) {
      slugString = content.value
    }
  }
  return createSlug(slugString, {
    truncate: 50,
  })
}

/**
 * Sets default properties in any document
 * This includes published date, slug & visibility
 * @param {RxDocument|object} doc An RxDocument
 */
module.exports = doc => {
  if (isRxDocument(doc)) {
    if (!doc.get('properties.mp-slug')) {
      doc.set('properties.mp-slug', [generateSlug(doc.toMf2())])
    }
    doc.set('properties.updated', [new Date().toISOString()])
    if (!doc.get('properties.visibility')) {
      doc.set('properties.visibility', ['visible'])
    }
    if (!doc.get('properties.post-status')) {
      doc.set('properties.post-status', 'published')
    }
    if (doc.get('children')) {
      doc.set(
        'children',
        doc.get('children').map(child => placeholders.add(child))
      )
    }
    if (doc.get('properties.photo')) {
      doc.set(
        'properties.photo',
        doc.get('properties.photo').map(url => placeholders.add(url))
      )
    }
    if (doc.get('properties.video')) {
      doc.set(
        'properties.video',
        doc.get('properties.video').map(url => placeholders.add(url))
      )
    }
    if (doc.get('properties.audio')) {
      doc.set(
        'properties.audio',
        doc.get('properties.audio').map(url => placeholders.add(url))
      )
    }
    if (!doc.get('cms')) {
      doc.set('cms', {})
    }
    doc.set('cms.postType', postTypeDiscovery(doc.toMf2()))
  } else {
    if (!doc.properties.published) {
      doc.properties.published = [new Date().toISOString()]
    }
    if (!doc.properties['mp-slug']) {
      doc.properties['mp-slug'] = [generateSlug(doc)]
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
    if (doc.children) {
      doc.children = doc.children.map(child => placeholders.add(child))
    }
    if (doc.properties.photo) {
      doc.properties.photo = doc.properties.photo.map(url =>
        placeholders.add(url)
      )
    }
    if (doc.properties.video) {
      doc.properties.video = doc.properties.video.map(url =>
        placeholders.add(url)
      )
    }
    if (doc.properties.audio) {
      doc.properties.audio = doc.properties.audio.map(url =>
        placeholders.add(url)
      )
    }
    if (!doc.cms) {
      doc.cms = {}
    }
    doc.cms.postType = postTypeDiscovery(doc)
  }

  return doc
}
