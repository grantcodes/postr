const hCard = require('./hCard')
const hGeo = require('./hGeo')
const hAdr = require('./hAdr')
const hItem = require('./hItem')
const hProduct = require('./hProduct')
const hEvent = require('./hEvent')
const hRating = require('./hRating')

module.exports = {
  type: 'object',
  properties: {
    value: {
      type: 'string',
    },
    type: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['h-review-aggregate'],
      },
    },
    properties: {
      type: 'object',
      properties: {
        name: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        rating: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hRating,
            ],
          },
        },
        item: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hCard,
              hItem,
              hProduct,
              hEvent,
              hAdr,
              hGeo,
            ],
          },
        },
        average: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        best: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        worst: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        count: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        votes: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        category: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        url: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
