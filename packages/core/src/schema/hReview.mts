import hCard from './hCard.mjs'
import hGeo from './hGeo.mjs'
import hAdr from './hAdr.mjs'
import hItem from './hItem.mjs'
import hEvent from './hEvent.mjs'

// Circular dependency: hProduct ↔ hReview. CJS returned empty object at this point.
const hProduct: any = {}

export default {
  type: 'object',
  properties: {
    value: { type: 'string' },
    type: {
      type: 'array',
      items: { type: 'string', enum: ['h-review'] },
    },
    properties: {
      type: 'object',
      properties: {
        name: { type: 'array', items: { type: 'string' } },
        item: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              hCard,
              hItem,
              hProduct,
              hEvent,
              hAdr,
              hGeo,
            ],
          },
        },
        author: {
          type: 'array',
          items: { oneOf: [{ type: 'string' }, hCard] },
        },
        published: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
        rating: { type: 'array', items: { type: 'string' } },
        category: { type: 'array', items: { type: 'string' } },
        url: { type: 'array', items: { type: 'string', format: 'uri' } },
        content: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  value: { type: 'string' },
                  html: { type: 'string' },
                },
              },
            ],
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
