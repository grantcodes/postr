module.exports = function() {
  const doc = this
  let refs = {}
  const refsArray = doc.get('cms.references') || []
  refsArray.forEach(ref => {
    if (ref.properties.url) {
      ref.properties.url.forEach(url => {
        refs[url] = ref
      })
    }
  })
  return refs
}
