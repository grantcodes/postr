const hCard = require('./hCard')

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
        enum: ['h-recipe'],
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
        ingredient: {
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
        yield: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        instructions: {
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
        duration: {
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
        summary: {
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
        author: {
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
        published: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        nutrition: {
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
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
