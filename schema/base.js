module.exports = {
  version: 1,
  id: 'post',
  type: 'object',
  properties: {
    type: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    properties: {
      type: 'object',
    },
    indexDate: {
      type: 'integer',
      index: true,
    },
    cms: {
      type: 'object',
      properties: {
        children: {
          type: 'array',
          ref: 'posts',
          items: {
            type: 'string',
          },
        },
      },
    },
  },
  required: ['type', 'properties', 'indexDate'],
  // disableKeyCompression: true,
  // additionalProperties: true,
}
