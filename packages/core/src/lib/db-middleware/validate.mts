import { createRequire } from 'node:module'
import { isRxDocument } from 'rxdb'
import getPostSchema from '../../schema/postTypes.mjs'
import { replaceMf2 } from '../placeholders.mjs'

const require = createRequire(import.meta.url)
const Ajv: any = require('ajv')
const ajv = new Ajv({ schemaId: 'auto', allErrors: true })
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'))

/**
 * Validate a mf2 doc against the correct schema
 * @param doc RxDocument or post mf2 json
 */
export default function validate(doc: any): any {
  let post = null
  if (isRxDocument(doc)) {
    post = doc.toMf2()
  } else {
    post = replaceMf2(Object.assign({}, doc))
  }

  // Remove database specific keys
  Object.keys(post).forEach(key => {
    if (key.indexOf('_') === 0) {
      delete post[key]
    }
  })

  const schema = getPostSchema(post)
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
      JSON.stringify(post, null, 2),
    )
    throw new Error('Document is not valid mf2: ' + ajv.errorsText())
  }

  return doc
}
