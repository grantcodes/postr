module.exports = function() {
  const doc = this
  let refs = {}
  const refsArray = doc.get('cms.references') || []

  for (const ref of refsArray) {
    if (ref.properties.url) {
      for (const url of ref.properties.url) {
        refs[url] = ref
      }
    }
  }

  return refs
}
