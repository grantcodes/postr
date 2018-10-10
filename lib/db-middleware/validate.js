const Ajv = require('ajv')
const getSchema = require('../../schema/postTypes')
const { isRxDocument } = require('rxdb')
const ajv = new Ajv({ schemaId: 'auto', allErrors: true })
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'))

/**
 * Validate a mf2 doc against the correct schema
 * @param {RxDocument|object} doc RxDocument or post mf2 json
 */
module.exports = doc => {
  let post = null
  if (isRxDocument(doc)) {
    post = doc.toMf2()
  } else {
    post = Object.assign({}, doc)
  }

  // Remove database specific keys
  Object.keys(post).forEach(key => {
    if (key.indexOf('_') === 0) {
      delete post[key]
    }
  })

  const schema = getSchema(post)
  if (!schema) {
    throw new Error('Missing schema: ' + JSON.stringify(post.type))
  }
  const validate = ajv.compile(schema)
  const valid = validate(post)
  if (valid) {
    // Still need to check unknown properties are arrays
    Object.values(post.properties).forEach(property => {
      if (!Array.isArray(property)) {
        throw new Error(property + ' is not an array')
      }
    })
  }

  if (!valid) {
    console.log(
      'This document appears to be invalid',
      JSON.stringify(post, null, 2)
    )
    throw new Error('Document is not valid mf2: ' + ajv.errorsText())
  }

  return doc
}
