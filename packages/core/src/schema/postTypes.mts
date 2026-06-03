import hCite from './hCite.mjs'
import hEntry from './hEntry.mjs'
import hEvent from './hEvent.mjs'
import hProduct from './hProduct.mjs'
import hRecipe from './hRecipe.mjs'

export default function getSchema(doc: any): any {
  if (!doc.type || !doc.type[0]) {
    return false
  }
  switch (doc.type[0]) {
    case 'h-entry':
      return hEntry
    case 'h-event':
      return hEvent
    case 'h-cite':
      return hCite
    case 'h-product':
      return hProduct
    case 'h-recipe':
      return hRecipe
    default:
      return false
  }
}
