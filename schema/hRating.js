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
        enum: ['h-rating'],
      },
    },
    properties: {
      type: 'object',
      properties: {
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
        count: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        name: {
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
