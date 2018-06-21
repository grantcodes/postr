const hCard = require('./hCard')
const hGeo = require('./hGeo')
const hAdr = require('./hAdr')

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
        enum: ['h-event'],
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
        summary: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        start: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        end: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        duration: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        description: {
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
        category: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        location: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hGeo,
              hAdr,
              hCard,
            ],
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
