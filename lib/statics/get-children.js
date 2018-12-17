module.exports = async function() {
  const doc = this
  if (doc.get('cms.children')) {
    try {
      const children = await doc.populate('cms.children')
      return children
    } catch (err) {
      console.log('Error populating children', err)
    }
  }
  return null
}
