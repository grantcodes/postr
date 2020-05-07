const mf2ToJf2 = (item) => {
  let jf2 = {}

  // Convert type
  if (item.type) {
    jf2.type = item.type[0].replace('h-', '')
  }

  // Add uid
  if (item.properties.url) {
    jf2.uid = item.properties.url[0]
  }

  // Convert properties
  for (const property in item.properties) {
    if (item.properties.hasOwnProperty(property)) {
      if (Array.isArray(item.properties[property])) {
        let arrayValue = item.properties[property].map((value) => {
          if (typeof value === 'string') {
            return value
          }

          if (typeof value === 'object') {
            if (value.type && value.properties) {
              // Handle nested mf2
              return mf2ToJf2(value)
            }

            if (property === 'content' && value.html && value.value) {
              return {
                html: value.html,
                text: value.value,
              }
            }

            // Handle photos with alts
            if (property === 'photo' && value.value) {
              return value.value
            }
          }
        })
        if (arrayValue.length === 1) {
          jf2[property] = arrayValue[0]
        } else {
          jf2[property] = arrayValue
        }
      } else {
        console.log(
          property + ' property is not an array:',
          item.properties[property]
        )
      }
    }
  }

  // Convert references to jf2
  if (item.references) {
    jf2.references = {}
    for (const ref in item.references) {
      if (item.references.hasOwnProperty(ref)) {
        const mf2 = item.references[ref]
        jf2.references[ref] = mf2ToJf2(mf2)
      }
    }
    if (Object.keys(jf2.references).length === 0) {
      delete jf2.references
    }
  }

  // If there are children they should be expanded
  if (item.children) {
    // TODO: Handle expanding children
    jf2.children = item.children
  }

  // Delete unneeded properties
  delete jf2['post-status']
  delete jf2['mp-slug']
  delete jf2.visibility
  delete jf2['syndicate-to']

  return jf2
}

module.exports = mf2ToJf2
