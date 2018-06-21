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
        enum: ['h-geo'],
      },
    },
    properties: {
      type: 'object',
      properties: {
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
