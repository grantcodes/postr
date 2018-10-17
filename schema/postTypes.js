const hCite = require('./hCite')
const hEntry = require('./hEntry')
const hEvent = require('./hEvent')
// const hItem = require('./hItem')
const hProduct = require('./hProduct')
// const hRating = require('./hRating')
const hRecipe = require('./hRecipe')
// const hReview = require('./hReview')
// const hReviewAggregate = require('./hReviewAggregate')

const getSchema = doc => {
  if (!doc.type || !doc.type[0]) {
    return false
  }
  switch (doc.type[0]) {
    case 'h-entry':
      return hEntry
      break
    case 'h-event':
      return hEvent
      break
    case 'h-cite':
      return hCite
      break
    case 'h-product':
      return hProduct
      break
    case 'h-recipe':
      return hRecipe
      break
    default:
      return false
      break
  }
}

module.exports = getSchema
