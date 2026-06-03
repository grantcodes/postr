export default async function getChildren(this: any): Promise<any> {
  const doc = this
  if (doc.get('cms.children')) {
    try {
      return await doc.populate('cms.children')
    } catch (err) {
      console.log('Error populating children', err)
    }
  }
  return null
}
