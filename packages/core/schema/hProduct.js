const hCard = require('./hCard')
const hReview = require('./hReview')
const hReviewAggregate = require('./hReviewAggregate')

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
        enum: ['h-product'],
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
        photo: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
                format: 'uri',
              },
              {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                    format: 'uri',
                  },
                  alt: {
                    type: 'string',
                  },
                },
              },
            ],
          },
        },
        brand: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hCard,
            ],
          },
        },
        category: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        description: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                  },
                  html: {
                    type: 'string',
                  },
                },
              },
            ],
          },
        },
        url: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        identifier: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
        review: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hReview,
              hReviewAggregate,
            ],
          },
        },
        price: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
