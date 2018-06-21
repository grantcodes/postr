const hAdr = require('./hAdr')
const hCard = require('./hCard')
const hGeo = require('./hGeo')

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
        enum: ['h-card'],
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
        'honorific-prefix': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'given-name': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'additional-name': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'family-name': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'sort-string': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'honorific-suffix': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        nickname: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        email: {
          type: 'array',
          items: {
            type: 'string',
            format: 'email',
          },
        },
        logo: {
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
        url: {
          type: 'array',
          items: {
            type: 'string',
            format: 'uri',
          },
        },
        uid: {
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
        adr: {
          type: 'array',
          items: {
            oneOf: [
              {
                type: 'string',
              },
              hAdr,
            ],
          },
        },
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
        tel: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        note: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        bday: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
        key: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        org: {
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
        'job-title': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        role: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        impp: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        sex: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        'gender-identity': {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        anniversary: {
          type: 'array',
          items: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  required: ['type', 'properties'],
  additionalProperties: true,
}
