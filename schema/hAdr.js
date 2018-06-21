const hGeo = require('./hGeo')

module.exports = {
  id: 'hAdr',
  type: 'object',
  properties: {
    value: {
      type: 'string',
    },
    type: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['h-adr'],
      },
    },
    properties: {
      type: 'object',
      properties: {
        'street-address': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'extended-address': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'post-office-box': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        locality: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        region: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'postal-code': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'country-name': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        label: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        geo: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hGeo,
            ],
          },
        },
        latitude: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '[-+]?\\d+(\\.\\d+)?',
          },
        },
        longitude: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '[-+]?\\d+(\\.\\d+)?',
          },
        },
        altitude: {
          type: 'array',
          items: {
            type: 'string',
            pattern: '[-+]?\\d+(\\.\\d+)?',
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
