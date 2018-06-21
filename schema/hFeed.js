const hCard = require('./hCard')
const hEntry = require('./hEntry')

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
        enum: ['h-feed'],
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
        url: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
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
        children: {
          type: 'array',
          items: hEntry,
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
